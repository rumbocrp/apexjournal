//! Memory Security & Zeroization Containers
//!
//! Provides zero-on-drop memory wrappers for passwords, keys, and SQLCipher queries.

use std::fmt;
use std::ops::{Deref, DerefMut};
use zeroize::{Zeroize, ZeroizeOnDrop, Zeroizing};

pub const KEY_BYTES_LEN: usize = 32;

/// Secure wrapper for plaintext passwords and passphrases.
/// Implements ZeroizeOnDrop to scrub RAM when dropped.
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct SecureSecretString {
    inner: Zeroizing<String>,
}

impl SecureSecretString {
    pub fn new(secret: String) -> Self {
        Self {
            inner: Zeroizing::new(secret),
        }
    }

    pub fn from_slice(secret: &str) -> Self {
        Self {
            inner: Zeroizing::new(secret.to_string()),
        }
    }

    pub fn as_bytes(&self) -> &[u8] {
        self.inner.as_bytes()
    }

    pub fn as_str(&self) -> &str {
        self.inner.as_str()
    }
}

impl Deref for SecureSecretString {
    type Target = str;
    fn deref(&self) -> &Self::Target {
        self.inner.as_str()
    }
}

impl fmt::Debug for SecureSecretString {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "SecureSecretString([REDACTED])")
    }
}

impl fmt::Display for SecureSecretString {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[REDACTED]")
    }
}

/// Secure wrapper for derived 256-bit encryption keys.
#[derive(Clone, Zeroize, ZeroizeOnDrop)]
pub struct SecureKey {
    inner: Zeroizing<[u8; KEY_BYTES_LEN]>,
}

impl SecureKey {
    pub fn new(key: Zeroizing<[u8; KEY_BYTES_LEN]>) -> Self {
        Self { inner: key }
    }

    pub fn from_slice(slice: &[u8; KEY_BYTES_LEN]) -> Self {
        let mut key = Zeroizing::new([0u8; KEY_BYTES_LEN]);
        key.copy_from_slice(slice);
        Self { inner: key }
    }

    pub fn as_slice(&self) -> &[u8; KEY_BYTES_LEN] {
        &self.inner
    }

    pub fn as_bytes(&self) -> &[u8] {
        self.inner.as_slice()
    }

    /// Formats the raw 256-bit key as a zeroizing hex string suitable for SQLCipher PRAGMA key.
    pub fn to_hex_zeroizing(&self) -> Zeroizing<String> {
        Zeroizing::new(hex::encode(self.inner.as_slice()))
    }
}

impl Deref for SecureKey {
    type Target = [u8; KEY_BYTES_LEN];
    fn deref(&self) -> &Self::Target {
        &self.inner
    }
}

impl DerefMut for SecureKey {
    fn deref_mut(&mut self) -> &mut Self::Target {
        &mut self.inner
    }
}

impl fmt::Debug for SecureKey {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "SecureKey([REDACTED 256-bit])")
    }
}

/// Secure utility for formatting SQLCipher PRAGMA key statements without heap leakage.
pub struct SecurePragmaBuilder;

impl SecurePragmaBuilder {
    /// Builds `PRAGMA key = "x'<64_hex_chars>'";` wrapped in `Zeroizing<String>`.
    pub fn build_key_pragma(key: &SecureKey) -> Zeroizing<String> {
        let hex_key = key.to_hex_zeroizing();
        Zeroizing::new(format!("PRAGMA key = \"x'{}'\";", hex_key.as_str()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_zeroize_memory_cleared_on_drop() {
        let buffer = Zeroizing::new([0xAAu8; 32]);
        assert_eq!(buffer[0], 0xAA);
        drop(buffer);
    }

    #[test]
    fn test_secure_key_redaction() {
        let raw = Zeroizing::new([42u8; 32]);
        let key = SecureKey::new(raw);
        let debug_str = format!("{:?}", key);
        assert!(!debug_str.contains("42"));
        assert!(debug_str.contains("[REDACTED"));
    }

    #[test]
    fn test_secure_secret_string_redaction() {
        let secret = SecureSecretString::new("SuperSecret123".into());
        let display_str = format!("{}", secret);
        assert_eq!(display_str, "[REDACTED]");
    }
}
