//! macOS Keychain & Touch ID Biometric Bridge
//!
//! Provides hardware-backed secure key storage with Touch ID / Keychain access
//! and a fallback mock bridge for headless CI environments and non-macOS platforms.

use std::sync::Arc;
use zeroize::Zeroizing;

use crate::crypto::zeroize_bytes::SecureKey;
use crate::error::AppError;

pub const KEYCHAIN_SERVICE: &str = "com.apexjournal.app";
pub const KEYCHAIN_ACCOUNT: &str = "master_vault_key";

/// Abstract interface for biometric / secure hardware key storage.
pub trait BiometricKeyStore: Send + Sync {
    /// Checks if biometric / secure keychain storage is available on the current device.
    fn is_available(&self) -> bool;

    /// Securely stores the 256-bit vault key in Keychain.
    fn store_vault_key(&self, key: &SecureKey) -> Result<(), AppError>;

    /// Prompts user (Touch ID / passcode) and retrieves the 256-bit vault key.
    fn retrieve_vault_key(&self) -> Result<SecureKey, AppError>;

    /// Deletes the vault key from Keychain.
    fn delete_vault_key(&self) -> Result<(), AppError>;
}

// -----------------------------------------------------------------------------
// macOS Native Keychain Implementation
// -----------------------------------------------------------------------------
#[cfg(target_os = "macos")]
pub mod macos_impl {
    use super::*;
    use security_framework::passwords::{delete_generic_password, get_generic_password, set_generic_password};
    use objc2::runtime::{AnyClass, AnyObject, Bool};
    use objc2::msg_send;
    use objc2_foundation::{NSError, NSString};
    use block2::RcBlock;
    use std::sync::mpsc;
    use std::sync::Mutex;

    pub struct MacOsKeychain;

    impl MacOsKeychain {
        pub fn new() -> Self {
            Self
        }

        /// Checks whether Touch ID biometric evaluation is supported on this hardware.
        pub fn is_touch_id_supported() -> bool {
            unsafe {
                let cls = match AnyClass::get(c"LAContext") {
                    Some(cls) => cls,
                    None => return false,
                };
                let context: *mut AnyObject = msg_send![cls, new];
                if context.is_null() {
                    return false;
                }
                let mut error: *mut NSError = std::ptr::null_mut();
                // LAPolicyDeviceOwnerAuthenticationWithBiometrics = 1
                let can_eval: Bool = msg_send![context, canEvaluatePolicy: 1isize, error: &mut error];
                let _: () = msg_send![context, release];
                can_eval.as_bool()
            }
        }

        /// Prompts the native macOS Touch ID biometric dialog.
        pub fn prompt_touch_id(reason: &str) -> Result<(), AppError> {
            let (tx, rx) = mpsc::channel();
            let tx_mutex = Mutex::new(tx);

            unsafe {
                let cls = AnyClass::get(c"LAContext")
                    .ok_or_else(|| AppError::KeychainError("LAContext class not available on this macOS system".into()))?;
                let context: *mut AnyObject = msg_send![cls, new];
                if context.is_null() {
                    return Err(AppError::KeychainError("Failed to initialize macOS LocalAuthentication context".into()));
                }

                let reason_ns = NSString::from_str(reason);

                let reply_block = RcBlock::new(move |success: Bool, error_ptr: *mut NSError| {
                    if success.as_bool() {
                        if let Ok(guard) = tx_mutex.lock() {
                            let _ = guard.send(Ok(()));
                        }
                    } else {
                        let err_msg = if !error_ptr.is_null() {
                            let desc: objc2::rc::Retained<NSString> = msg_send![error_ptr, localizedDescription];
                            desc.to_string()
                        } else {
                            "Touch ID authentication cancelled or failed".to_string()
                        };
                        if let Ok(guard) = tx_mutex.lock() {
                            let _ = guard.send(Err(AppError::KeychainError(err_msg)));
                        }
                    }
                });

                // LAPolicyDeviceOwnerAuthenticationWithBiometrics = 1
                let _: () = msg_send![
                    context,
                    evaluatePolicy: 1isize,
                    localizedReason: &*reason_ns,
                    reply: &*reply_block
                ];

                let result = rx.recv().map_err(|e| {
                    AppError::KeychainError(format!("Channel error awaiting Touch ID response: {}", e))
                })?;

                let _: () = msg_send![context, release];
                result
            }
        }
    }

    impl Default for MacOsKeychain {
        fn default() -> Self {
            Self::new()
        }
    }

    impl BiometricKeyStore for MacOsKeychain {
        fn is_available(&self) -> bool {
            if std::env::var("APEX_MOCK_KEYCHAIN").unwrap_or_default() == "1" {
                return true;
            }
            Self::is_touch_id_supported()
        }

        fn store_vault_key(&self, key: &SecureKey) -> Result<(), AppError> {
            // Delete existing item if present to avoid errSecDuplicateItem
            let _ = delete_generic_password(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);

            set_generic_password(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT, key.as_bytes())
                .map_err(|e| AppError::KeychainError(format!("Failed to store key in macOS Keychain: {}", e)))?;

            log::info!("Stored master vault key in macOS Keychain successfully.");
            Ok(())
        }

        fn retrieve_vault_key(&self) -> Result<SecureKey, AppError> {
            // 1. Verify key exists in Keychain first
            let password_bytes = get_generic_password(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT)
                .map_err(|e| AppError::KeychainError(format!("No master key in Keychain or access denied: {}", e)))?;

            if password_bytes.len() != 32 {
                return Err(AppError::KeychainError(format!(
                    "Invalid key length retrieved from Keychain: expected 32 bytes, got {}",
                    password_bytes.len()
                )));
            }

            // 2. If mock mode is not active, prompt native Touch ID biometric
            if std::env::var("APEX_MOCK_KEYCHAIN").unwrap_or_default() != "1" {
                Self::prompt_touch_id("Desbloquea tu bóveda de ApexJournal con Touch ID")?;
            }

            let mut key_arr = Zeroizing::new([0u8; 32]);
            key_arr.copy_from_slice(&password_bytes);
            Ok(SecureKey::new(key_arr))
        }

        fn delete_vault_key(&self) -> Result<(), AppError> {
            let _ = delete_generic_password(KEYCHAIN_SERVICE, KEYCHAIN_ACCOUNT);
            log::info!("Deleted master vault key from macOS Keychain.");
            Ok(())
        }
    }
}


// -----------------------------------------------------------------------------
// Mock Biometric Bridge (for Headless CI, Non-macOS, & Unit Tests)
// -----------------------------------------------------------------------------
pub mod mock_impl {
    use super::*;
    use std::sync::RwLock;

    pub struct MockBiometricKeyStore {
        storage: RwLock<Option<Zeroizing<[u8; 32]>>>,
        available: bool,
    }

    impl MockBiometricKeyStore {
        pub fn new() -> Self {
            Self {
                storage: RwLock::new(None),
                available: true,
            }
        }

        pub fn new_with_availability(available: bool) -> Self {
            Self {
                storage: RwLock::new(None),
                available,
            }
        }
    }

    impl Default for MockBiometricKeyStore {
        fn default() -> Self {
            Self::new()
        }
    }

    impl BiometricKeyStore for MockBiometricKeyStore {
        fn is_available(&self) -> bool {
            self.available
        }

        fn store_vault_key(&self, key: &SecureKey) -> Result<(), AppError> {
            if !self.available {
                return Err(AppError::KeychainError("Biometric hardware not available".into()));
            }
            let mut lock = self.storage.write().map_err(|e| AppError::SyncError(e.to_string()))?;
            let mut stored = Zeroizing::new([0u8; 32]);
            stored.copy_from_slice(key.as_bytes());
            *lock = Some(stored);
            Ok(())
        }

        fn retrieve_vault_key(&self) -> Result<SecureKey, AppError> {
            if !self.available {
                return Err(AppError::KeychainError("Biometric hardware not available".into()));
            }
            let lock = self.storage.read().map_err(|e| AppError::SyncError(e.to_string()))?;
            match lock.as_ref() {
                Some(stored) => {
                    let mut key_arr = Zeroizing::new([0u8; 32]);
                    key_arr.copy_from_slice(stored.as_slice());
                    Ok(SecureKey::new(key_arr))
                }
                None => Err(AppError::KeychainError("No master key found in Keychain".into())),
            }
        }

        fn delete_vault_key(&self) -> Result<(), AppError> {
            let mut lock = self.storage.write().map_err(|e| AppError::SyncError(e.to_string()))?;
            *lock = None;
            Ok(())
        }
    }
}

/// Factory function returning the appropriate key store implementation
pub fn create_biometric_key_store() -> Arc<dyn BiometricKeyStore> {
    if std::env::var("APEX_MOCK_KEYCHAIN").unwrap_or_default() == "1" {
        return Arc::new(mock_impl::MockBiometricKeyStore::new());
    }

    #[cfg(target_os = "macos")]
    {
        Arc::new(macos_impl::MacOsKeychain::new())
    }

    #[cfg(not(target_os = "macos"))]
    {
        // No native biometric bridge on Linux/Windows: report unavailable so
        // the UI hides Touch ID controls and status stays honest.
        // Headless CI can still opt into the mock via APEX_MOCK_KEYCHAIN=1 above.
        Arc::new(mock_impl::MockBiometricKeyStore::new_with_availability(false))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mock_biometric_key_store_operations() {
        let store = mock_impl::MockBiometricKeyStore::new();
        assert!(store.is_available());

        let raw = Zeroizing::new([77u8; 32]);
        let key = SecureKey::new(raw);

        // Store
        store.store_vault_key(&key).expect("Store failed");

        // Retrieve
        let retrieved = store.retrieve_vault_key().expect("Retrieve failed");
        assert_eq!(key.as_bytes(), retrieved.as_bytes());

        // Delete
        store.delete_vault_key().expect("Delete failed");
        assert!(store.retrieve_vault_key().is_err());
    }

    #[test]
    fn test_mock_biometric_unavailable() {
        let store = mock_impl::MockBiometricKeyStore::new_with_availability(false);
        assert!(!store.is_available());

        let raw = Zeroizing::new([1u8; 32]);
        let key = SecureKey::new(raw);
        assert!(store.store_vault_key(&key).is_err());
        assert!(store.retrieve_vault_key().is_err());
    }
}
