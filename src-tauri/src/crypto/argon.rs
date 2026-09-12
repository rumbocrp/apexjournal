//! Argon2id Key Derivation Engine
//!
//! Provides deterministic 256-bit master key derivation using Argon2id with:
//! m=64MB (65536 KiB), t=3, p=4, and 32-byte cryptographically secure salts.

use argon2::{Algorithm, Argon2, Params, Version};
use rand_core::{OsRng, RngCore};
use zeroize::Zeroizing;

use crate::crypto::zeroize_bytes::SecureKey;
use crate::error::AppError;

pub const SALT_LEN: usize = 32;
pub const KEY_LEN: usize = 32;
pub const ARGON2_M_COST: u32 = 65536; // 64 MB memory cost
pub const ARGON2_T_COST: u32 = 3;     // 3 iterations
pub const ARGON2_P_COST: u32 = 4;     // 4 parallel threads

pub struct KeyDerivationEngine;

impl KeyDerivationEngine {
    /// Generate a 32-byte cryptographically secure random salt using OS CSPRNG
    pub fn generate_salt() -> [u8; SALT_LEN] {
        let mut salt = [0u8; SALT_LEN];
        OsRng.fill_bytes(&mut salt);
        salt
    }

    /// Derive a 256-bit raw encryption key wrapped in a SecureKey container
    pub fn derive_master_key(
        password: &str,
        salt: &[u8; SALT_LEN],
    ) -> Result<SecureKey, AppError> {
        Self::derive_key_with_params(password.as_bytes(), salt, ARGON2_M_COST, ARGON2_T_COST, ARGON2_P_COST)
    }

    /// Derive key with explicit custom parameters
    pub fn derive_key_with_params(
        password: &[u8],
        salt: &[u8; SALT_LEN],
        m_cost: u32,
        t_cost: u32,
        p_cost: u32,
    ) -> Result<SecureKey, AppError> {
        let params = Params::new(m_cost, t_cost, p_cost, Some(KEY_LEN))
            .map_err(|e| AppError::CryptoError(format!("Argon2 params configuration error: {}", e)))?;

        let argon2 = Argon2::new(Algorithm::Argon2id, Version::V0x13, params);

        let mut raw_key = Zeroizing::new([0u8; KEY_LEN]);
        argon2
            .hash_password_into(password, salt, raw_key.as_mut())
            .map_err(|e| AppError::CryptoError(format!("Argon2 key derivation failed: {}", e)))?;

        Ok(SecureKey::new(raw_key))
    }

    /// Format derived key into hex string for SQLCipher PRAGMA key = "x'...'"
    pub fn format_sqlcipher_hex_pragma(key: &SecureKey) -> Zeroizing<String> {
        let hex_str = hex::encode(key.as_bytes());
        Zeroizing::new(format!("PRAGMA key = \"x'{}'\";", hex_str))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_argon2_derivation_deterministic() {
        let salt = [42u8; SALT_LEN];
        let pass = "CorrectHorseBatteryStaple!123";
        let key1 = KeyDerivationEngine::derive_master_key(pass, &salt).unwrap();
        let key2 = KeyDerivationEngine::derive_master_key(pass, &salt).unwrap();
        assert_eq!(key1.as_bytes(), key2.as_bytes());
        assert_eq!(key1.as_bytes().len(), 32);
    }

    #[test]
    fn test_argon2_derivation_distinct_passwords() {
        let salt = [42u8; SALT_LEN];
        let key1 = KeyDerivationEngine::derive_master_key("Password123!", &salt).unwrap();
        let key2 = KeyDerivationEngine::derive_master_key("Password124!", &salt).unwrap();
        assert_ne!(key1.as_bytes(), key2.as_bytes());
    }

    #[test]
    fn test_argon2_derivation_distinct_salts() {
        let salt1 = [1u8; SALT_LEN];
        let salt2 = [2u8; SALT_LEN];
        let key1 = KeyDerivationEngine::derive_master_key("Password123!", &salt1).unwrap();
        let key2 = KeyDerivationEngine::derive_master_key("Password123!", &salt2).unwrap();
        assert_ne!(key1.as_bytes(), key2.as_bytes());
    }
}
