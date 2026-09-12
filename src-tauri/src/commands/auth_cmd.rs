use tauri::State;
use crate::error::AppError;
use crate::models::{VaultInitRequest, VaultStatus, VaultUnlockRequest};
use crate::state::VaultState;

#[tauri::command]
pub async fn vault_get_status(state: State<'_, VaultState>) -> Result<VaultStatus, AppError> {
    Ok(state.get_status().await)
}

#[tauri::command]
pub async fn vault_setup(
    state: State<'_, VaultState>,
    request: VaultInitRequest,
) -> Result<VaultStatus, AppError> {
    let enable_biometrics = request.enable_biometrics.unwrap_or(false);
    let auto_lock = request.auto_lock_minutes.unwrap_or(15);
    state.setup_vault(&request.master_password, enable_biometrics, auto_lock).await
}

#[tauri::command]
pub async fn vault_unlock(
    state: State<'_, VaultState>,
    request: VaultUnlockRequest,
) -> Result<VaultStatus, AppError> {
    state.unlock_with_password(&request.master_password).await
}

#[tauri::command]
pub async fn vault_unlock_biometric(
    state: State<'_, VaultState>,
) -> Result<VaultStatus, AppError> {
    state.unlock_with_biometric().await
}

#[tauri::command]
pub async fn vault_lock(state: State<'_, VaultState>) -> Result<(), AppError> {
    state.lock().await
}

#[tauri::command]
pub async fn vault_touch(state: State<'_, VaultState>) -> Result<(), AppError> {
    state.touch().await;
    Ok(())
}
