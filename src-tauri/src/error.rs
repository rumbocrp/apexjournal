use serde::{Serialize, Serializer};
use thiserror::Error;

#[derive(Error, Debug)]
pub enum AppError {
    #[error("Vault is locked")]
    VaultLocked,

    #[error("Session timed out due to inactivity: {0}")]
    SessionLocked(String),

    #[error("Invalid master password")]
    InvalidPassword,

    #[error("Vault is already initialized")]
    AlreadyInitialized,

    #[error("Vault not found. Please setup a master password.")]
    VaultNotFound,

    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("Cryptographic error: {0}")]
    CryptoError(String),

    #[error("Keychain error: {0}")]
    KeychainError(String),

    #[error("Validation error: {0}")]
    ValidationError(String),

    #[error("Not found: {0}")]
    NotFound(String),

    #[error("IO error: {0}")]
    IoError(String),

    #[error("Lock poisoned or synchronization error: {0}")]
    SyncError(String),

    #[error("Integrity violation: {0}")]
    IntegrityViolation(String),
}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        use serde::ser::SerializeStruct;
        let mut state = serializer.serialize_struct("AppError", 2)?;
        let code = match self {
            AppError::VaultLocked => "VAULT_LOCKED",
            AppError::SessionLocked(_) => "SESSION_LOCKED",
            AppError::InvalidPassword => "INVALID_PASSWORD",
            AppError::AlreadyInitialized => "ALREADY_INITIALIZED",
            AppError::VaultNotFound => "VAULT_NOT_FOUND",
            AppError::DatabaseError(_) => "DATABASE_ERROR",
            AppError::CryptoError(_) => "CRYPTO_ERROR",
            AppError::KeychainError(_) => "KEYCHAIN_ERROR",
            AppError::ValidationError(_) => "VALIDATION_ERROR",
            AppError::NotFound(_) => "NOT_FOUND",
            AppError::IoError(_) => "IO_ERROR",
            AppError::SyncError(_) => "SYNC_ERROR",
            AppError::IntegrityViolation(_) => "INTEGRITY_VIOLATION",
        };
        state.serialize_field("code", code)?;
        state.serialize_field("message", &self.to_string())?;
        state.end()
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(err: rusqlite::Error) -> Self {
        match &err {
            rusqlite::Error::SqliteFailure(code, Some(msg)) => {
                let msg_lower = msg.to_lowercase();
                if msg_lower.contains("file is not a database")
                    || msg_lower.contains("file is encrypted")
                    || msg_lower.contains("file is not a database or is encrypted")
                    || msg_lower.contains("authentication")
                {
                    AppError::InvalidPassword
                } else {
                    AppError::DatabaseError(format!("{:?}: {}", code, msg))
                }
            }
            _ => {
                let err_str = err.to_string().to_lowercase();
                if err_str.contains("file is not a database")
                    || err_str.contains("file is encrypted")
                {
                    AppError::InvalidPassword
                } else {
                    AppError::DatabaseError(err.to_string())
                }
            }
        }
    }
}

impl From<std::io::Error> for AppError {
    fn from(err: std::io::Error) -> Self {
        AppError::IoError(err.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(err: serde_json::Error) -> Self {
        AppError::ValidationError(err.to_string())
    }
}
