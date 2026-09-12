//! SQLCipher Encrypted Connection Manager

use rusqlite::{Connection, OpenFlags};
use std::path::Path;

use crate::crypto::{SecureKey, SecurePragmaBuilder};
use crate::error::AppError;

pub struct DatabaseManager;

impl DatabaseManager {
    /// Opens or creates an AES-256 encrypted SQLCipher database with raw PRAGMA key.
    pub fn open_encrypted<P: AsRef<Path>>(
        path: P,
        raw_key: &SecureKey,
    ) -> Result<Connection, AppError> {
        let db_path = path.as_ref();

        // Ensure parent directory exists
        if let Some(parent) = db_path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| AppError::IoError(format!("Failed to create vault directory: {}", e)))?;
        }

        let conn = Connection::open_with_flags(
            db_path,
            OpenFlags::SQLITE_OPEN_READ_WRITE | OpenFlags::SQLITE_OPEN_CREATE,
        )?;

        // 1. Inject raw hex key inside Zeroizing container
        let pragma_key_sql = SecurePragmaBuilder::build_key_pragma(raw_key);
        conn.execute_batch(&pragma_key_sql)?;

        // 2. Configure SQLCipher Page Encryption PRAGMAs
        conn.execute_batch("
            PRAGMA cipher_page_size = 4096;
            PRAGMA kdf_iter = 1;
            PRAGMA cipher_hmac_algorithm = HMAC_SHA512;
            PRAGMA cipher_default_kdf_algorithm = PBKDF2_HMAC_SHA512;
            PRAGMA journal_mode = WAL;
            PRAGMA synchronous = NORMAL;
            PRAGMA foreign_keys = ON;
        ")?;

        // 3. Authenticate Key by reading SQLite master page
        // If the key is invalid or ciphertext is corrupted, this query fails with SQLITE_NOTADB
        let _table_count: i64 = conn
            .query_row("SELECT count(*) FROM sqlite_master;", [], |row| row.get(0))
            .map_err(|err| {
                log::error!("SQLCipher decryption validation failed: {}", err);
                AppError::InvalidPassword
            })?;

        Ok(conn)
    }

    /// Checkpoint and flush WAL pages before closing or locking
    pub fn checkpoint_and_close(conn: Connection) -> Result<(), AppError> {
        Self::checkpoint(&conn)?;
        drop(conn);
        Ok(())
    }

    /// Flush WAL pages through a shared reference. Used where the connection
    /// is held behind `Arc<std::sync::Mutex<_>>` and cannot be moved out.
    pub fn checkpoint(conn: &Connection) -> Result<(), AppError> {
        conn.execute_batch("PRAGMA wal_checkpoint(PASSIVE);")?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    use zeroize::Zeroizing;
    use crate::crypto::KeyDerivationEngine;
    use crate::db::migrations::MigrationManager;

    #[test]
    fn test_open_encrypted_and_validate_key() {
        let dir = tempdir().unwrap();
        let db_path = dir.path().join("test_encrypted.db");

        let salt = KeyDerivationEngine::generate_salt();
        let pass = "CorrectPassword123!";
        let key = KeyDerivationEngine::derive_master_key(pass, &salt).unwrap();

        // 1. Open fresh database and run migrations
        {
            let mut conn = DatabaseManager::open_encrypted(&db_path, &key).expect("Failed to open db with correct key");
            MigrationManager::run_migrations(&mut conn).expect("Failed migrations");
            conn.execute(
                "INSERT INTO categories (id, name, type) VALUES (?1, ?2, ?3)",
                rusqlite::params!["cat-custom-1", "Consulting", "INCOME"],
            ).expect("Failed insert");
            DatabaseManager::checkpoint_and_close(conn).expect("Failed checkpoint");
        }

        // 2. Re-open with correct key
        {
            let conn = DatabaseManager::open_encrypted(&db_path, &key).expect("Failed to reopen db with correct key");
            let name: String = conn.query_row(
                "SELECT name FROM categories WHERE id = 'cat-custom-1'",
                [],
                |r| r.get(0),
            ).expect("Failed query");
            assert_eq!(name, "Consulting");
            DatabaseManager::checkpoint_and_close(conn).expect("Failed checkpoint");
        }

        // 3. Attempt open with incorrect key - MUST FAIL
        {
            let wrong_raw = Zeroizing::new([0x99u8; 32]);
            let wrong_key = SecureKey::new(wrong_raw);
            let result = DatabaseManager::open_encrypted(&db_path, &wrong_key);
            assert!(result.is_err());
            match result.err().unwrap() {
                AppError::InvalidPassword => (),
                other => panic!("Expected AppError::InvalidPassword, got {:?}", other),
            }
        }
    }
}
