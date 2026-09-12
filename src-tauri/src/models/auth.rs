use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct KdfMeta {
    pub algorithm: String,
    pub version: u32,
    pub m_cost: u32,
    pub t_cost: u32,
    pub p_cost: u32,
    pub salt_hex: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultMetadata {
    pub version: u32,
    pub kdf: KdfMeta,
    pub biometrics_enabled: bool,
    pub auto_lock_minutes: u64,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct VaultStatus {
    pub initialized: bool,
    pub unlocked: bool,
    pub biometric_available: bool,
    pub auto_lock_minutes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultInitRequest {
    pub master_password: String,
    pub enable_biometrics: Option<bool>,
    pub auto_lock_minutes: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultUnlockRequest {
    pub master_password: String,
}
