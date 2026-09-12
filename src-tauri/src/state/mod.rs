pub mod watchdog;

use rusqlite::Connection;
use std::path::PathBuf;
use std::sync::{Arc, Mutex as StdMutex};
use std::time::Instant;
use tokio::sync::Mutex;

use crate::crypto::{create_biometric_key_store, BiometricKeyStore, KeyDerivationEngine, SecureKey, SALT_LEN};
use crate::db::{DatabaseManager, MigrationManager};
use crate::error::AppError;
use crate::models::{KdfMeta, VaultMetadata, VaultStatus};

/// Shared DB handle. The outer tokio Mutex guards session metadata only;
/// query work runs on blocking threads under the inner std Mutex, so a slow
/// aggregation never stalls the async executor (watchdog, touch, status).
pub type DbConn = Arc<StdMutex<Connection>>;

pub struct SessionInner {
    pub conn: Option<DbConn>,
    pub master_key: Option<SecureKey>,
    pub last_activity: Instant,
    pub auto_lock_timeout_secs: u64,
    pub vault_dir: PathBuf,
    pub biometric_store: Arc<dyn BiometricKeyStore>,
}

#[derive(Clone)]
pub struct VaultState {
    pub inner: Arc<Mutex<SessionInner>>,
}

impl VaultState {
    pub fn new(vault_dir: PathBuf) -> Self {
        let biometric_store = create_biometric_key_store();
        Self::new_with_biometric(vault_dir, biometric_store)
    }

    pub fn new_with_biometric(vault_dir: PathBuf, biometric_store: Arc<dyn BiometricKeyStore>) -> Self {
        Self {
            inner: Arc::new(Mutex::new(SessionInner {
                conn: None,
                master_key: None,
                last_activity: Instant::now(),
                auto_lock_timeout_secs: 15 * 60,
                vault_dir,
                biometric_store,
            })),
        }
    }

    pub async fn is_initialized(&self) -> bool {
        let inner = self.inner.lock().await;
        let meta_path = inner.vault_dir.join("vault.meta");
        let db_path = inner.vault_dir.join("apex_journal.db");
        meta_path.exists() && db_path.exists()
    }

    pub async fn is_unlocked(&self) -> bool {
        let inner = self.inner.lock().await;
        inner.conn.is_some()
    }

    pub async fn get_metadata(&self) -> Result<VaultMetadata, AppError> {
        let inner = self.inner.lock().await;
        let meta_path = inner.vault_dir.join("vault.meta");
        if !meta_path.exists() {
            return Err(AppError::VaultNotFound);
        }
        let data = std::fs::read_to_string(meta_path)?;
        let meta: VaultMetadata = serde_json::from_str(&data)?;
        Ok(meta)
    }

    pub async fn get_status(&self) -> VaultStatus {
        let initialized = self.is_initialized().await;
        let unlocked = self.is_unlocked().await;
        let inner = self.inner.lock().await;

        let (auto_lock_minutes, biometrics_enabled) = if initialized {
            let meta_path = inner.vault_dir.join("vault.meta");
            if let Ok(data) = std::fs::read_to_string(meta_path) {
                if let Ok(meta) = serde_json::from_str::<VaultMetadata>(&data) {
                    (meta.auto_lock_minutes, meta.biometrics_enabled)
                } else {
                    (15, false)
                }
            } else {
                (15, false)
            }
        } else {
            (15, true)
        };

        let biometric_available = if initialized {
            biometrics_enabled && inner.biometric_store.is_available()
        } else {
            inner.biometric_store.is_available()
        };

        VaultStatus {
            initialized,
            unlocked,
            biometric_available,
            auto_lock_minutes,
        }
    }


    pub async fn setup_vault(
        &self,
        password: &str,
        enable_biometrics: bool,
        auto_lock_minutes: u64,
    ) -> Result<VaultStatus, AppError> {
        let mut inner = self.inner.lock().await;
        let meta_path = inner.vault_dir.join("vault.meta");
        if meta_path.exists() {
            return Err(AppError::AlreadyInitialized);
        }

        std::fs::create_dir_all(&inner.vault_dir)?;

        // 1. Generate salt and derive master key
        let salt = KeyDerivationEngine::generate_salt();
        let salt_hex = hex::encode(salt);
        let derived_key = KeyDerivationEngine::derive_master_key(password, &salt)?;

        // 2. Create and initialize database with migrations
        let db_path = inner.vault_dir.join("apex_journal.db");
        let mut conn = DatabaseManager::open_encrypted(&db_path, &derived_key)?;
        MigrationManager::run_migrations(&mut conn)?;

        // 3. Write metadata file
        let now = chrono::Utc::now().to_rfc3339();
        let metadata = VaultMetadata {
            version: 1,
            kdf: KdfMeta {
                algorithm: "Argon2id".into(),
                version: 19,
                m_cost: 65536,
                t_cost: 3,
                p_cost: 4,
                salt_hex,
            },
            biometrics_enabled: enable_biometrics,
            auto_lock_minutes,
            created_at: now.clone(),
            updated_at: now,
        };
        let meta_json = serde_json::to_string_pretty(&metadata)?;
        std::fs::write(&meta_path, meta_json)?;

        // 4. Optionally save to Keychain / biometric store
        if enable_biometrics && inner.biometric_store.is_available() {
            let _ = inner.biometric_store.store_vault_key(&derived_key);
        }

        let biometric_available = inner.biometric_store.is_available();

        // 5. Update session state
        inner.conn = Some(Arc::new(StdMutex::new(conn)));
        inner.master_key = Some(derived_key);
        inner.last_activity = Instant::now();
        inner.auto_lock_timeout_secs = auto_lock_minutes * 60;

        Ok(VaultStatus {
            initialized: true,
            unlocked: true,
            biometric_available,
            auto_lock_minutes,
        })
    }

    pub async fn unlock_with_password(&self, password: &str) -> Result<VaultStatus, AppError> {
        let mut inner = self.inner.lock().await;
        let meta_path = inner.vault_dir.join("vault.meta");
        if !meta_path.exists() {
            return Err(AppError::VaultNotFound);
        }

        let meta_data = std::fs::read_to_string(&meta_path)?;
        let meta: VaultMetadata = serde_json::from_str(&meta_data)?;

        let mut salt = [0u8; SALT_LEN];
        hex::decode_to_slice(&meta.kdf.salt_hex, &mut salt)
            .map_err(|e| AppError::CryptoError(format!("Invalid salt hex in metadata: {}", e)))?;

        let derived_key = KeyDerivationEngine::derive_master_key(password, &salt)?;
        let db_path = inner.vault_dir.join("apex_journal.db");

        let mut conn = DatabaseManager::open_encrypted(&db_path, &derived_key)?;
        MigrationManager::run_migrations(&mut conn)?;

        let biometric_available = inner.biometric_store.is_available();

        inner.conn = Some(Arc::new(StdMutex::new(conn)));
        inner.master_key = Some(derived_key);
        inner.last_activity = Instant::now();
        inner.auto_lock_timeout_secs = meta.auto_lock_minutes * 60;

        Ok(VaultStatus {
            initialized: true,
            unlocked: true,
            biometric_available,
            auto_lock_minutes: meta.auto_lock_minutes,
        })
    }

    pub async fn unlock_with_key(&self, key: SecureKey) -> Result<VaultStatus, AppError> {
        let mut inner = self.inner.lock().await;
        let meta_path = inner.vault_dir.join("vault.meta");
        if !meta_path.exists() {
            return Err(AppError::VaultNotFound);
        }

        let meta_data = std::fs::read_to_string(&meta_path)?;
        let meta: VaultMetadata = serde_json::from_str(&meta_data)?;
        let db_path = inner.vault_dir.join("apex_journal.db");

        let mut conn = DatabaseManager::open_encrypted(&db_path, &key)?;
        MigrationManager::run_migrations(&mut conn)?;

        let biometric_available = inner.biometric_store.is_available();

        inner.conn = Some(Arc::new(StdMutex::new(conn)));
        inner.master_key = Some(key);
        inner.last_activity = Instant::now();
        inner.auto_lock_timeout_secs = meta.auto_lock_minutes * 60;

        Ok(VaultStatus {
            initialized: true,
            unlocked: true,
            biometric_available,
            auto_lock_minutes: meta.auto_lock_minutes,
        })
    }

    pub async fn unlock_with_biometric(&self) -> Result<VaultStatus, AppError> {
        let key = {
            let inner = self.inner.lock().await;
            inner.biometric_store.retrieve_vault_key()?
        };
        self.unlock_with_key(key).await
    }

    pub async fn lock(&self) -> Result<(), AppError> {
        let mut inner = self.inner.lock().await;
        if let Some(db) = inner.conn.take() {
            // Brief std-mutex hold for the checkpoint only; in-flight blocking
            // workers keep their own Arc clone and drain naturally.
            if let Ok(guard) = db.lock() {
                let _ = DatabaseManager::checkpoint(&guard);
            }
        }
        inner.master_key = None; // SecureKey drops and zeroizes
        Ok(())
    }

    pub async fn touch(&self) {
        let mut inner = self.inner.lock().await;
        inner.last_activity = Instant::now();
    }

    pub async fn check_inactivity(&self) -> bool {
        let mut inner = self.inner.lock().await;
        if inner.conn.is_some() && inner.auto_lock_timeout_secs > 0 {
            if inner.last_activity.elapsed().as_secs() >= inner.auto_lock_timeout_secs {
                log::info!("Vault inactivity timeout reached. Locking vault...");
                if let Some(db) = inner.conn.take() {
                    if let Ok(guard) = db.lock() {
                        let _ = DatabaseManager::checkpoint(&guard);
                    }
                }
                inner.master_key = None;
                return true;
            }
        }
        false
    }

    pub async fn with_connection<F, T>(&self, f: F) -> Result<T, AppError>
    where
        F: FnOnce(&Connection) -> Result<T, AppError> + Send + 'static,
        T: Send + 'static,
    {
        // Session metadata under the async mutex; the guard is released before
        // any database work so slow queries never stall the executor.
        let db: DbConn = {
            let mut inner = self.inner.lock().await;

            if inner.conn.is_some() && inner.auto_lock_timeout_secs > 0 {
                if inner.last_activity.elapsed().as_secs() >= inner.auto_lock_timeout_secs {
                    if let Some(stale) = inner.conn.take() {
                        if let Ok(guard) = stale.lock() {
                            let _ = DatabaseManager::checkpoint(&guard);
                        }
                    }
                    inner.master_key = None;
                    return Err(AppError::SessionLocked("Session timed out due to inactivity".into()));
                }
            }

            inner.last_activity = Instant::now();
            inner.conn.clone().ok_or(AppError::VaultLocked)?
        };

        // Synchronous rusqlite work runs on the blocking pool behind a plain
        // std mutex. Concurrent commands still serialize on the single
        // connection (correct), but touch/status/watchdog stay responsive.
        tokio::task::spawn_blocking(move || {
            let guard = db
                .lock()
                .map_err(|_| AppError::SyncError("Database lock poisoned".into()))?;
            f(&guard)
        })
        .await
        .map_err(|e| AppError::SyncError(format!("Database worker failed: {}", e)))?
    }
}
