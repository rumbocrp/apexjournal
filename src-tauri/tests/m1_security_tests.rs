use std::collections::HashMap;
use std::time::Duration;
use tempfile::tempdir;
use zeroize::Zeroizing;

use apex_journal::crypto::{
    keychain::mock_impl::MockBiometricKeyStore, BiometricKeyStore, KeyDerivationEngine, SecureKey,
    SecurePragmaBuilder, SecureSecretString, ARGON2_M_COST, ARGON2_P_COST, ARGON2_T_COST,
    KEY_LEN, SALT_LEN,
};
use apex_journal::db::{DatabaseManager, MigrationManager};
use apex_journal::state::VaultState;

#[test]
fn test_argon2id_derivation_determinism_and_parameters() {
    let salt = KeyDerivationEngine::generate_salt();
    assert_eq!(salt.len(), SALT_LEN);

    let password = "UltraSecurePassword#2026!";
    let key1 = KeyDerivationEngine::derive_master_key(password, &salt).expect("KDF 1 failed");
    let key2 = KeyDerivationEngine::derive_master_key(password, &salt).expect("KDF 2 failed");

    // 1. Determinism
    assert_eq!(key1.as_bytes(), key2.as_bytes());
    assert_eq!(key1.as_bytes().len(), KEY_LEN);

    // 2. Sensitivity to password
    let key_diff_pass = KeyDerivationEngine::derive_master_key("UltraSecurePassword#2026?", &salt).unwrap();
    assert_ne!(key1.as_bytes(), key_diff_pass.as_bytes());

    // 3. Sensitivity to salt
    let mut salt_diff = salt;
    salt_diff[0] ^= 0xFF;
    let key_diff_salt = KeyDerivationEngine::derive_master_key(password, &salt_diff).unwrap();
    assert_ne!(key1.as_bytes(), key_diff_salt.as_bytes());

    // 4. Custom parameter verification
    let custom_key = KeyDerivationEngine::derive_key_with_params(
        password.as_bytes(),
        &salt,
        ARGON2_M_COST,
        ARGON2_T_COST,
        ARGON2_P_COST,
    ).unwrap();
    assert_eq!(key1.as_bytes(), custom_key.as_bytes());
}

#[test]
fn test_sqlcipher_raw_disk_binary_encryption_inspection() {
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("apex_journal.db");

    let salt = KeyDerivationEngine::generate_salt();
    let password = "SecretMasterPassword!99";
    let key = KeyDerivationEngine::derive_master_key(password, &salt).unwrap();

    let secret_payload = "CONFIDENTIAL_FINANCIAL_TRANSACTION_PAYLOAD_987654321";

    // 1. Create encrypted database and write payload
    {
        let mut conn = DatabaseManager::open_encrypted(&db_path, &key).expect("Failed to open encrypted db");
        MigrationManager::run_migrations(&mut conn).expect("Failed to run migrations");

        // Insert foreign key dependency first
        conn.execute(
            "INSERT INTO categories (id, name, type) VALUES (?1, ?2, ?3)",
            rusqlite::params!["cat-consulting", "Consulting Income", "INCOME"],
        ).expect("Failed to insert category");

        conn.execute(
            "INSERT INTO transactions (id, date, type, category_id, amount, currency, exchange_rate, base_amount, status, notes) 
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
            rusqlite::params![
                "tx-test-01",
                "2026-08-30",
                "INCOME",
                "cat-consulting",
                50000.0,
                "USD",
                1.0,
                50000.0,
                "CLEARED",
                secret_payload,
            ],
        ).expect("Failed to insert secret payload");

        DatabaseManager::checkpoint_and_close(conn).expect("Failed checkpoint and close");
    }

    // 2. Read raw binary bytes from disk
    let raw_bytes = std::fs::read(&db_path).expect("Failed to read raw db file");
    assert!(raw_bytes.len() >= 4096, "Database file must be at least 1 page (4096 bytes)");

    // 3. Verify SQLite magic header is ABSENT
    let sqlite_magic = b"SQLite format 3\0";
    assert_ne!(
        &raw_bytes[0..16],
        sqlite_magic,
        "SQLCipher database MUST NOT contain standard unencrypted SQLite header"
    );

    // 4. Verify no plaintext strings exist in the raw ciphertext file
    let raw_file_content_as_lossy_str = String::from_utf8_lossy(&raw_bytes);
    assert!(
        !raw_file_content_as_lossy_str.contains(secret_payload),
        "Plaintext payload leaked to disk in raw database file!"
    );
    assert!(
        !raw_file_content_as_lossy_str.contains("CREATE TABLE"),
        "DDL statements leaked to disk!"
    );
    assert!(
        !raw_file_content_as_lossy_str.contains("transactions"),
        "Table names leaked to disk!"
    );

    // 5. Verify high Shannon Entropy of ciphertext (> 7.80 bits/byte out of 8.0)
    let mut byte_counts = HashMap::new();
    for &b in &raw_bytes {
        *byte_counts.entry(b).or_insert(0usize) += 1;
    }
    let total_len = raw_bytes.len() as f64;
    let mut entropy = 0.0f64;
    for &count in byte_counts.values() {
        let p = (count as f64) / total_len;
        entropy -= p * p.log2();
    }
    println!("Calculated Raw DB Shannon Entropy: {:.4} / 8.0000", entropy);
    assert!(
        entropy > 7.80,
        "Shannon entropy too low ({:.4}): ciphertext does not resemble random bytes",
        entropy
    );

    // 6. Attempt reading with standard unencrypted rusqlite connection without PRAGMA key
    {
        let plain_conn = rusqlite::Connection::open(&db_path).expect("File open succeeded");
        let query_result: Result<i64, _> = plain_conn.query_row("SELECT count(*) FROM sqlite_master;", [], |r| r.get(0));
        assert!(
            query_result.is_err(),
            "Unencrypted standard SQLite read on SQLCipher database MUST FAIL"
        );
        let err_msg = query_result.err().unwrap().to_string().to_lowercase();
        assert!(
            err_msg.contains("not a database") || err_msg.contains("encrypted"),
            "Error should indicate not a database or encrypted, got: {}",
            err_msg
        );
    }
}

#[test]
fn test_zeroize_memory_clearing() {
    let raw_buf = Zeroizing::new([0xFEu8; 32]);
    let sec_key = SecureKey::new(raw_buf.clone());

    // Verify debug formatting is redacted
    let debug_repr = format!("{:?}", sec_key);
    assert!(debug_repr.contains("[REDACTED 256-bit]"));
    assert!(!debug_repr.contains("254"));

    let sec_string = SecureSecretString::new("Passphrase123".into());
    assert_eq!(format!("{}", sec_string), "[REDACTED]");
    assert_eq!(format!("{:?}", sec_string), "SecureSecretString([REDACTED])");

    let pragma = SecurePragmaBuilder::build_key_pragma(&sec_key);
    assert!(pragma.starts_with("PRAGMA key = \"x'"));
    assert!(pragma.ends_with("'\";"));
    assert_eq!(pragma.len(), 16 + 64 + 3);

    drop(sec_key);
    drop(sec_string);
    drop(pragma);
    drop(raw_buf);
}

#[tokio::test]
async fn test_inactivity_auto_lock_enforcement() {
    let dir = tempdir().unwrap();
    let vault_dir = dir.path().join("vault");

    let state = VaultState::new(vault_dir.clone());
    assert!(!state.is_initialized().await);
    assert!(!state.is_unlocked().await);

    // Setup vault with 1 minute auto-lock (we will simulate timeout)
    let status = state.setup_vault("TestPassword#123", false, 1).await.expect("Vault setup failed");
    assert!(status.initialized);
    assert!(status.unlocked);
    assert_eq!(status.auto_lock_minutes, 1);

    // Test with_connection works when unlocked (6 default seeded categories)
    let count: i64 = state.with_connection(|conn| {
        let cnt: i64 = conn.query_row("SELECT count(*) FROM categories;", [], |r| r.get(0))?;
        Ok(cnt)
    }).await.expect("with_connection failed");
    assert_eq!(count, 6);

    // Manually force timeout by altering last_activity in inner state
    {
        let mut inner = state.inner.lock().await;
        inner.last_activity = std::time::Instant::now() - Duration::from_secs(120);
    }

    // Now check_inactivity should trigger lock
    let locked = state.check_inactivity().await;
    assert!(locked, "check_inactivity should return true when timed out");
    assert!(!state.is_unlocked().await);

    // Attempting with_connection should return error
    let fail_result = state.with_connection(|conn| {
        let cnt: i64 = conn.query_row("SELECT count(*) FROM categories;", [], |r| r.get(0))?;
        Ok(cnt)
    }).await;
    assert!(fail_result.is_err());

    // Re-unlocking with valid password
    let unlock_res = state.unlock_with_password("TestPassword#123").await.expect("Re-unlock failed");
    assert!(unlock_res.unlocked);

    // with_connection should work again
    let count_after: i64 = state.with_connection(|conn| {
        let cnt: i64 = conn.query_row("SELECT count(*) FROM categories;", [], |r| r.get(0))?;
        Ok(cnt)
    }).await.expect("with_connection failed after re-unlock");
    assert_eq!(count_after, 6);

    // Test explicit lock
    state.lock().await.expect("Explicit lock failed");
    assert!(!state.is_unlocked().await);
}

#[tokio::test]
async fn test_concurrent_with_connection_access() {
    let dir = tempdir().unwrap();
    let vault_dir = dir.path().join("vault");

    let state = VaultState::new(vault_dir.clone());
    state.setup_vault("ConcurPassword!1", false, 15).await.expect("Setup failed");

    // Spawn 20 concurrent tasks performing inserts and reads
    let mut handles = Vec::new();
    for i in 0..20 {
        let state_clone = state.clone();
        let handle = tokio::spawn(async move {
            state_clone.with_connection(move |conn| {
                let id = format!("cat-concurrent-{}", i);
                let name = format!("Category {}", i);
                conn.execute(
                    "INSERT INTO categories (id, name, type) VALUES (?1, ?2, 'INCOME')",
                    rusqlite::params![id, name],
                )?;
                Ok(())
            }).await
        });
        handles.push(handle);
    }

    for handle in handles {
        let res = handle.await.expect("Tokio task join failed");
        assert!(res.is_ok(), "Concurrent insert failed: {:?}", res);
    }

    // Verify all 20 rows + 6 default seeded categories are present = 26
    let total_categories: i64 = state.with_connection(|conn| {
        let cnt: i64 = conn.query_row("SELECT count(*) FROM categories;", [], |r| r.get(0))?;
        Ok(cnt)
    }).await.expect("Query failed");

    assert_eq!(total_categories, 26);
}

#[tokio::test]
async fn test_slow_query_does_not_block_session_touch() {
    let dir = tempdir().unwrap();
    let vault_dir = dir.path().join("vault");

    let state = VaultState::new(vault_dir.clone());
    state.setup_vault("NonBlockPassword!1", false, 15).await.expect("Setup failed");

    // A 500ms database operation runs on the blocking pool. Session liveness
    // (touch) must not queue behind it on the async executor.
    let slow_state = state.clone();
    let slow = tokio::spawn(async move {
        slow_state
            .with_connection(|conn| {
                std::thread::sleep(Duration::from_millis(500));
                let cnt: i64 =
                    conn.query_row("SELECT count(*) FROM categories;", [], |r| r.get(0))?;
                Ok(cnt)
            })
            .await
    });

    tokio::time::sleep(Duration::from_millis(50)).await;
    let start = std::time::Instant::now();
    state.touch().await;
    let touch_elapsed = start.elapsed();
    assert!(
        touch_elapsed.as_millis() < 400,
        "touch() blocked behind slow query: {:?}",
        touch_elapsed
    );

    let slow_count: i64 = slow.await.expect("join").expect("slow query");
    assert_eq!(slow_count, 6);
}

#[test]
fn test_mock_biometric_key_store_lifecycle() {
    let store = MockBiometricKeyStore::new();
    assert!(store.is_available());

    let raw = Zeroizing::new([0x88u8; 32]);
    let sec_key = SecureKey::new(raw);

    store.store_vault_key(&sec_key).expect("Store failed");
    let retrieved = store.retrieve_vault_key().expect("Retrieve failed");
    assert_eq!(sec_key.as_bytes(), retrieved.as_bytes());

    store.delete_vault_key().expect("Delete failed");
    assert!(store.retrieve_vault_key().is_err());
}
