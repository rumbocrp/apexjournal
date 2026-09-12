//! Background Inactivity Auto-Lock Watchdog

use std::time::Duration;
use crate::state::VaultState;

pub struct InactivityWatchdog;

impl InactivityWatchdog {
    /// Spawns a background task that periodically polls the vault state for inactivity timeout.
    /// Uses Tauri's async runtime instead of raw tokio::spawn.
    pub fn spawn(state: VaultState, interval: Duration) {
        tauri::async_runtime::spawn(async move {
            let mut ticker = tokio::time::interval(interval);
            loop {
                ticker.tick().await;
                let locked = state.check_inactivity().await;
                if locked {
                    log::debug!("Inactivity watchdog locked the vault.");
                }
            }
        });
    }
}
