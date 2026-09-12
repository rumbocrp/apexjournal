pub mod analytics;
pub mod commands;
pub mod crypto;
pub mod db;
pub mod error;
pub mod models;
pub mod state;
pub mod vault;

use std::path::PathBuf;
use std::time::Duration;
use tauri::Manager;

use crate::commands::analytics_cmd::*;
use crate::commands::auth_cmd::*;
use crate::commands::case_cmd::*;
use crate::commands::export_cmd::*;
use crate::commands::journal_cmd::*;
use crate::commands::transaction_cmd::*;
use crate::state::watchdog::InactivityWatchdog;
use crate::state::VaultState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::init_from_env(env_logger::Env::default().default_filter_or("info"));

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let app_data_dir = app.path().app_data_dir().unwrap_or_else(|_| {
                let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
                PathBuf::from(home).join(".apex_journal")
            });
            let vault_dir = app_data_dir.join("vault");
            std::fs::create_dir_all(&vault_dir).map_err(|e| {
                format!(
                    "Failed to create vault directory at {}: {}",
                    vault_dir.display(),
                    e
                )
            })?;

            let vault_state = VaultState::new(vault_dir);

            // Spawn background inactivity watchdog
            InactivityWatchdog::spawn(vault_state.clone(), Duration::from_secs(2));

            app.manage(vault_state);
            log::info!("ApexJournal backend initialized successfully.");
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Auth & Vault
            vault_get_status,
            vault_setup,
            vault_unlock,
            vault_unlock_biometric,
            vault_lock,
            vault_touch,
            // Transactions & Categories
            transaction_create,
            transaction_update,
            transaction_delete,
            transaction_list,
            category_list,
            // Cases & Milestones
            case_create,
            case_update,
            case_list,
            case_get_detail,
            milestone_create,
            milestone_toggle,
            // Journal
            journal_create,
            journal_update,
            journal_list,
            // Analytics
            analytics_get_dashboard,
            analytics_get_equity_curve,
            analytics_get_ar_aging,
            get_ar_aging_summary,
            // Vault Backup & Export
            vault_export_backup,
            vault_restore_backup,
            export_csv,
            export_excel,
        ])
        .run(tauri::generate_context!())
        .expect("error while running apex-journal tauri application");
}
