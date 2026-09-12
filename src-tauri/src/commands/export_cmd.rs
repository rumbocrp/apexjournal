use std::path::PathBuf;
use serde::Deserialize;
use tauri::State;

use crate::error::AppError;
use crate::models::BackupResult;
use crate::state::VaultState;
use crate::vault::{BackupEngine, ExportEngine};

#[derive(Debug, Deserialize)]
pub struct ExportBackupInput {
    #[serde(alias = "destinationPath")]
    pub destination_path: String,
}

#[derive(Debug, Deserialize)]
pub struct RestoreBackupInput {
    #[serde(alias = "sourcePath")]
    pub source_path: String,
    #[serde(alias = "masterPassword")]
    pub master_password: String,
}

#[derive(Debug, Deserialize)]
pub struct ExportCsvInput {
    #[serde(alias = "exportType")]
    pub export_type: String,
}

#[derive(Debug, Deserialize)]
pub struct ExportExcelInput {
    #[serde(alias = "destinationPath")]
    pub destination_path: String,
}

#[tauri::command]
pub async fn vault_export_backup(
    state: State<'_, VaultState>,
    destination_path: Option<String>,
    input: Option<ExportBackupInput>,
) -> Result<BackupResult, AppError> {
    let dest = destination_path
        .or_else(|| input.map(|i| i.destination_path))
        .ok_or_else(|| AppError::ValidationError("Missing destination_path parameter".into()))?;

    let path = PathBuf::from(dest);
    BackupEngine::export_backup(&state, &path).await
}

#[tauri::command]
pub async fn vault_restore_backup(
    state: State<'_, VaultState>,
    source_path: Option<String>,
    master_password: Option<String>,
    input: Option<RestoreBackupInput>,
) -> Result<(), AppError> {
    let (src, pass) = if let Some(i) = input {
        (i.source_path, i.master_password)
    } else {
        let s = source_path
            .ok_or_else(|| AppError::ValidationError("Missing source_path parameter".into()))?;
        let p = master_password
            .ok_or_else(|| AppError::ValidationError("Missing master_password parameter".into()))?;
        (s, p)
    };

    let path = PathBuf::from(src);
    BackupEngine::restore_backup(&state, &path, &pass).await
}

#[tauri::command]
pub async fn export_csv(
    state: State<'_, VaultState>,
    export_type: Option<String>,
    input: Option<ExportCsvInput>,
) -> Result<String, AppError> {
    let exp_type = export_type
        .or_else(|| input.map(|i| i.export_type))
        .unwrap_or_else(|| "transactions".into());

    state
        .with_connection(move |conn| ExportEngine::export_csv(conn, &exp_type))
        .await
}

#[tauri::command]
pub async fn export_excel(
    state: State<'_, VaultState>,
    destination_path: Option<String>,
    input: Option<ExportExcelInput>,
) -> Result<(), AppError> {
    let dest = destination_path
        .or_else(|| input.map(|i| i.destination_path))
        .ok_or_else(|| AppError::ValidationError("Missing destination_path parameter".into()))?;

    let path = PathBuf::from(dest);
    state
        .with_connection(move |conn| ExportEngine::export_excel(conn, &path))
        .await
}
