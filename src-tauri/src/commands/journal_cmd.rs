use tauri::State;
use crate::db::JournalRepo;
use crate::error::AppError;
use crate::models::{CreateJournalInput, JournalEntry, JournalFilter, UpdateJournalInput};
use crate::state::VaultState;

#[tauri::command]
pub async fn journal_create(
    state: State<'_, VaultState>,
    input: CreateJournalInput,
) -> Result<JournalEntry, AppError> {
    state.with_connection(move |conn| JournalRepo::create(conn, input)).await
}

#[tauri::command]
pub async fn journal_update(
    state: State<'_, VaultState>,
    id: String,
    input: UpdateJournalInput,
) -> Result<JournalEntry, AppError> {
    state.with_connection(move |conn| JournalRepo::update(conn, &id, input)).await
}

#[tauri::command]
pub async fn journal_list(
    state: State<'_, VaultState>,
    filter: Option<JournalFilter>,
) -> Result<Vec<JournalEntry>, AppError> {
    state.with_connection(move |conn| JournalRepo::list(conn, filter.as_ref())).await
}
