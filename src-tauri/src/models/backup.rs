use serde::{Deserialize, Serialize};
use crate::models::auth::VaultMetadata;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct BackupResult {
    pub success: bool,
    pub destination_path: String,
    pub bytes_written: u64,
    pub timestamp: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupPayload {
    pub schema_version: u32,
    pub app_version: String,
    pub exported_at: String,
    pub db_bytes: Vec<u8>,
    pub metadata: VaultMetadata,
}
