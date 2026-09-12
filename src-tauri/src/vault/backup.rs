//! Encrypted .vault Backup and Restore Engine
//!
//! Produces and consumes AES-256-GCM encrypted container archives with:
//! - Magic header: "APEXVAULT1" (10 bytes)
//! - Format Version: 1 (2 bytes)
//! - Argon2id Salt: 32 bytes
//! - AES-GCM Nonce: 12 bytes
//! - Export Timestamp: 8 bytes (i64 big-endian)
//! - Key Check Value (KCV): 32 bytes (Password verification tag)
//! - HMAC-SHA256 Integrity Tag: 32 bytes
//! - AES-256-GCM Ciphertext + Auth Tag

use chrono::Utc;
use rand_core::{OsRng, RngCore};
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;
use std::path::Path;
use std::sync::{Arc, Mutex as StdMutex};
use zeroize::Zeroizing;

use crate::crypto::{KeyDerivationEngine, SecureKey, SALT_LEN};
use crate::db::{DatabaseManager, MigrationManager};
use crate::error::AppError;
use crate::models::{BackupPayload, BackupResult, VaultMetadata};
use crate::state::VaultState;

pub const VAULT_MAGIC: &[u8; 10] = b"APEXVAULT1";
pub const VAULT_BACKUP_VERSION: u16 = 1;
pub const NONCE_LEN: usize = 12;
pub const TAG_LEN: usize = 16;
pub const HEADER_LEN: usize = 128; // 10 (magic) + 2 (ver) + 32 (salt) + 12 (nonce) + 8 (ts) + 32 (kcv) + 32 (hmac)

pub struct BackupEngine;

/// SHA-256 Digest Helper
pub fn sha256_digest(data: &[u8]) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(data);
    hasher.finalize().into()
}

/// Standard RFC 2104 HMAC-SHA256 Implementation
pub fn hmac_sha256(key: &[u8], data: &[u8]) -> [u8; 32] {
    let mut k = [0u8; 64];
    if key.len() > 64 {
        let hashed = sha256_digest(key);
        k[..32].copy_from_slice(&hashed);
    } else {
        k[..key.len()].copy_from_slice(key);
    }

    let mut ipad = [0u8; 64];
    let mut opad = [0u8; 64];
    for i in 0..64 {
        ipad[i] = k[i] ^ 0x36;
        opad[i] = k[i] ^ 0x5c;
    }

    let mut inner = Sha256::new();
    inner.update(&ipad);
    inner.update(data);
    let inner_hash = inner.finalize();

    let mut outer = Sha256::new();
    outer.update(&opad);
    outer.update(&inner_hash);
    outer.finalize().into()
}

// AES-256-GCM via the pure-Rust `aes-gcm` crate: one code path on every
// platform. GCM is standardized, so containers stay byte-compatible with
// backups written by the previous platform backend.
mod gcm {
    use super::*;
    use aes_gcm::aead::{Aead, KeyInit, Payload};
    use aes_gcm::{Aes256Gcm, Key, Nonce};

    pub fn aes_gcm_encrypt(
        key: &[u8; 32],
        nonce: &[u8; 12],
        plaintext: &[u8],
        aad: &[u8],
    ) -> Result<(Vec<u8>, [u8; 16]), AppError> {
        let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
        let out = cipher
            .encrypt(
                Nonce::from_slice(nonce),
                Payload { msg: plaintext, aad },
            )
            .map_err(|e| AppError::CryptoError(format!("AES-256-GCM encryption failed: {}", e)))?;
        let split = out.len().checked_sub(TAG_LEN).ok_or_else(|| {
            AppError::CryptoError("AES-256-GCM output shorter than tag".into())
        })?;
        let mut tag = [0u8; TAG_LEN];
        tag.copy_from_slice(&out[split..]);
        Ok((out[..split].to_vec(), tag))
    }

    pub fn aes_gcm_decrypt(
        key: &[u8; 32],
        nonce: &[u8; 12],
        ciphertext: &[u8],
        tag: &[u8; 16],
        aad: &[u8],
    ) -> Result<Vec<u8>, AppError> {
        let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
        let mut combined = Vec::with_capacity(ciphertext.len() + TAG_LEN);
        combined.extend_from_slice(ciphertext);
        combined.extend_from_slice(tag);
        cipher
            .decrypt(
                Nonce::from_slice(nonce),
                Payload { msg: &combined, aad },
            )
            .map_err(|_| {
                AppError::CryptoError(
                    "AES-256-GCM decryption failed or authentication tag mismatch".into(),
                )
            })
    }

    #[cfg(test)]
    mod tests {
        use super::*;

        #[test]
        fn test_gcm_nist_kat_empty_256bit() {
            // NIST CAVP AES-GCM 256-bit empty-plaintext vector: all-zero
            // key/nonce/plaintext must yield tag
            // 530f8afbc74536b9a963b4f1c4cb738b (cross-checked against an
            // independent implementation). Proves standard compliance, hence
            // interop with the previous platform backend.
            let key = [0u8; 32];
            let nonce = [0u8; 12];
            let (ct, tag) = aes_gcm_encrypt(&key, &nonce, &[], &[]).unwrap();
            assert!(ct.is_empty());
            assert_eq!(hex::encode(tag), "530f8afbc74536b9a963b4f1c4cb738b");
            let pt = aes_gcm_decrypt(&key, &nonce, &ct, &tag, &[]).unwrap();
            assert!(pt.is_empty());
        }

        #[test]
        fn test_gcm_tampered_tag_rejected() {
            let key = [7u8; 32];
            let nonce = [9u8; 12];
            let (ct, mut tag) = aes_gcm_encrypt(&key, &nonce, b"vault payload", b"AAD").unwrap();
            tag[0] ^= 0xFF;
            assert!(aes_gcm_decrypt(&key, &nonce, &ct, &tag, b"AAD").is_err());
        }
    }
}

pub use gcm::{aes_gcm_decrypt, aes_gcm_encrypt};

impl BackupEngine {
    /// Derive domain-separated cryptographic subkeys from master key
    pub fn derive_subkeys(master_key: &SecureKey) -> (Zeroizing<[u8; 32]>, Zeroizing<[u8; 32]>, Zeroizing<[u8; 32]>) {
        let raw = master_key.as_bytes();
        let kcv_key = Zeroizing::new(hmac_sha256(raw, b"APEX_VAULT_KCV_KEY_DERIVATION"));
        let hmac_key = Zeroizing::new(hmac_sha256(raw, b"APEX_VAULT_HMAC_KEY_DERIVATION"));
        let enc_key = Zeroizing::new(hmac_sha256(raw, b"APEX_VAULT_AES_GCM_ENC_KEY"));
        (kcv_key, hmac_key, enc_key)
    }

    /// Compute Key Check Value (KCV) for constant-time password verification
    pub fn compute_kcv(kcv_key: &[u8; 32]) -> [u8; 32] {
        hmac_sha256(kcv_key, b"APEX_VAULT_KCV_VALIDATION_TAG")
    }

    /// Export an encrypted .vault backup snapshot to the specified destination path
    pub async fn export_backup(state: &VaultState, destination_path: &Path) -> Result<BackupResult, AppError> {
        let (vault_dir, master_key) = {
            let inner = state.inner.lock().await;
            let key = inner.master_key.as_ref().ok_or(AppError::VaultLocked)?.clone();
            (inner.vault_dir.clone(), key)
        };

        // 1. Flush WAL checkpoint so database snapshot on disk is complete and consistent
        state
            .with_connection(|conn| {
                conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE);")?;
                Ok(())
            })
            .await?;

        let db_path = vault_dir.join("apex_journal.db");
        let meta_path = vault_dir.join("vault.meta");

        if !db_path.exists() || !meta_path.exists() {
            return Err(AppError::VaultNotFound);
        }

        let db_bytes = std::fs::read(&db_path)?;
        let meta_str = std::fs::read_to_string(&meta_path)?;
        let metadata: VaultMetadata = serde_json::from_str(&meta_str)?;

        // 2. Decode salt from metadata
        let mut salt = [0u8; SALT_LEN];
        hex::decode_to_slice(&metadata.kdf.salt_hex, &mut salt)
            .map_err(|e| AppError::CryptoError(format!("Invalid salt in metadata: {}", e)))?;

        // 3. Build snapshot payload
        let payload = BackupPayload {
            schema_version: 1,
            app_version: "0.1.0".into(),
            exported_at: Utc::now().to_rfc3339(),
            db_bytes,
            metadata,
        };
        let payload_json = serde_json::to_vec(&payload)?;

        // 4. Derive keys and generate nonce
        let (kcv_key, hmac_key, enc_key) = Self::derive_subkeys(&master_key);
        let kcv_tag = Self::compute_kcv(&kcv_key);

        let mut nonce = [0u8; NONCE_LEN];
        OsRng.fill_bytes(&mut nonce);

        let timestamp = Utc::now().timestamp();

        // 5. Encrypt payload with AES-256-GCM (AAD is magic bytes)
        let (ciphertext, gcm_tag) = aes_gcm_encrypt(&enc_key, &nonce, &payload_json, VAULT_MAGIC)?;

        // 6. Assemble header prefix (96 bytes)
        let mut header_prefix = Vec::with_capacity(96);
        header_prefix.extend_from_slice(VAULT_MAGIC);
        header_prefix.extend_from_slice(&VAULT_BACKUP_VERSION.to_be_bytes());
        header_prefix.extend_from_slice(&salt);
        header_prefix.extend_from_slice(&nonce);
        header_prefix.extend_from_slice(&timestamp.to_be_bytes());
        header_prefix.extend_from_slice(&kcv_tag);

        // 7. Combine ciphertext + gcm_tag
        let mut encrypted_body = ciphertext;
        encrypted_body.extend_from_slice(&gcm_tag);

        // 8. Compute HMAC-SHA256 integrity tag over (header_prefix || encrypted_body)
        let mut hmac_input = Vec::with_capacity(header_prefix.len() + encrypted_body.len());
        hmac_input.extend_from_slice(&header_prefix);
        hmac_input.extend_from_slice(&encrypted_body);

        let hmac_tag = hmac_sha256(&*hmac_key, &hmac_input);

        // 9. Write full container to destination
        let mut container = Vec::with_capacity(HEADER_LEN + encrypted_body.len());
        container.extend_from_slice(&header_prefix);
        container.extend_from_slice(&hmac_tag);
        container.extend_from_slice(&encrypted_body);

        if let Some(parent) = destination_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(destination_path, &container)?;

        let bytes_written = container.len() as u64;
        let ts_str = Utc::now().to_rfc3339();

        log::info!(
            "Successfully exported encrypted .vault backup to {:?} ({} bytes)",
            destination_path,
            bytes_written
        );

        Ok(BackupResult {
            success: true,
            destination_path: destination_path.to_string_lossy().to_string(),
            bytes_written,
            timestamp: ts_str,
        })
    }

    /// Restore and decrypt an encrypted .vault backup snapshot cleanly swapping active database
    pub async fn restore_backup(
        state: &VaultState,
        source_path: &Path,
        master_password: &str,
    ) -> Result<(), AppError> {
        if !source_path.exists() {
            return Err(AppError::NotFound(format!(
                "Backup file not found at {:?}",
                source_path
            )));
        }

        let data = std::fs::read(source_path)?;
        if data.len() < HEADER_LEN + TAG_LEN {
            return Err(AppError::ValidationError(
                "Invalid .vault container: file size is smaller than header requirements".into(),
            ));
        }

        // 1. Verify Magic Bytes
        if &data[0..10] != VAULT_MAGIC {
            return Err(AppError::ValidationError(
                "Invalid .vault container: magic header signature mismatch".into(),
            ));
        }

        // 2. Verify Version
        let version = u16::from_be_bytes([data[10], data[11]]);
        if version != VAULT_BACKUP_VERSION {
            return Err(AppError::ValidationError(format!(
                "Unsupported .vault container version: {}",
                version
            )));
        }

        // 3. Extract Salt
        let mut salt = [0u8; SALT_LEN];
        salt.copy_from_slice(&data[12..44]);

        // 4. Derive Master Key with Argon2id
        let derived_master_key = KeyDerivationEngine::derive_master_key(master_password, &salt)?;
        let (kcv_key, hmac_key, enc_key) = Self::derive_subkeys(&derived_master_key);

        // 5. Verify Password via KCV in constant time
        let expected_kcv = Self::compute_kcv(&kcv_key);
        let stored_kcv = &data[64..96];

        if expected_kcv.ct_eq(stored_kcv).unwrap_u8() != 1 {
            log::warn!("Vault restore failed: master password verification mismatch (KCV)");
            return Err(AppError::InvalidPassword);
        }

        // 6. Verify HMAC-SHA256 Integrity Tag in constant time
        let stored_hmac = &data[96..128];
        let mut hmac_input = Vec::with_capacity(96 + (data.len() - HEADER_LEN));
        hmac_input.extend_from_slice(&data[0..96]);
        hmac_input.extend_from_slice(&data[HEADER_LEN..]);

        let calculated_hmac = hmac_sha256(&*hmac_key, &hmac_input);
        if calculated_hmac.ct_eq(stored_hmac).unwrap_u8() != 1 {
            log::error!("Vault restore rejected: container HMAC integrity verification failed");
            return Err(AppError::IntegrityViolation(
                "Backup archive HMAC verification failed: container corrupted or tampered".into(),
            ));
        }

        // 7. Extract Nonce and Encrypted Body
        let mut nonce = [0u8; NONCE_LEN];
        nonce.copy_from_slice(&data[44..56]);

        let encrypted_body = &data[HEADER_LEN..];
        let ciphertext_len = encrypted_body.len() - TAG_LEN;
        let ciphertext = &encrypted_body[..ciphertext_len];
        let mut gcm_tag = [0u8; TAG_LEN];
        gcm_tag.copy_from_slice(&encrypted_body[ciphertext_len..]);

        // 8. Decrypt Payload
        let decrypted_bytes = aes_gcm_decrypt(&enc_key, &nonce, ciphertext, &gcm_tag, VAULT_MAGIC)?;

        // 9. Deserialize Payload
        let payload: BackupPayload = serde_json::from_slice(&decrypted_bytes)
            .map_err(|e| AppError::ValidationError(format!("Malformed backup payload JSON: {}", e)))?;

        if payload.schema_version != 1 {
            return Err(AppError::ValidationError(format!(
                "Incompatible database schema version: {}",
                payload.schema_version
            )));
        }

        // 10. Cleanly swap active database files under session lock
        let mut inner = state.inner.lock().await;

        // Close and checkpoint existing database connection if open
        if let Some(db) = inner.conn.take() {
            if let Ok(guard) = db.lock() {
                let _ = DatabaseManager::checkpoint(&guard);
            }
        }
        inner.master_key = None;

        let vault_dir = inner.vault_dir.clone();
        std::fs::create_dir_all(&vault_dir)?;

        let db_path = vault_dir.join("apex_journal.db");
        let meta_path = vault_dir.join("vault.meta");
        let tmp_db_path = vault_dir.join("apex_journal.db.tmp");

        // Write snapshot to temporary file then atomically rename
        std::fs::write(&tmp_db_path, &payload.db_bytes)?;
        std::fs::rename(&tmp_db_path, &db_path)?;

        // Clean up any stale SQLite WAL and SHM journal files
        let wal_path = vault_dir.join("apex_journal.db-wal");
        let shm_path = vault_dir.join("apex_journal.db-shm");
        let _ = std::fs::remove_file(wal_path);
        let _ = std::fs::remove_file(shm_path);

        // Update vault.meta
        let mut restored_meta = payload.metadata;
        restored_meta.kdf.salt_hex = hex::encode(salt);
        restored_meta.updated_at = Utc::now().to_rfc3339();
        let meta_json = serde_json::to_string_pretty(&restored_meta)?;
        std::fs::write(&meta_path, meta_json)?;

        // Re-open and validate the restored database with the derived master key
        let mut conn = DatabaseManager::open_encrypted(&db_path, &derived_master_key)?;
        MigrationManager::run_migrations(&mut conn)?;

        // Update biometric key if enabled
        if restored_meta.biometrics_enabled && inner.biometric_store.is_available() {
            let _ = inner.biometric_store.store_vault_key(&derived_master_key);
        }

        // Update active session state
        inner.conn = Some(Arc::new(StdMutex::new(conn)));
        inner.master_key = Some(derived_master_key);
        inner.last_activity = std::time::Instant::now();
        inner.auto_lock_timeout_secs = restored_meta.auto_lock_minutes * 60;

        log::info!("Successfully restored .vault backup and re-established active session.");
        Ok(())
    }
}
