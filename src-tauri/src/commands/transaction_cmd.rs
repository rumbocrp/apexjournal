use tauri::State;
use crate::db::{CategoryRepo, TransactionRepo};
use crate::error::AppError;
use crate::models::{Category, CreateTransactionInput, Transaction, TransactionFilter, UpdateTransactionInput};
use crate::state::VaultState;

#[tauri::command]
pub async fn transaction_create(
    state: State<'_, VaultState>,
    input: CreateTransactionInput,
) -> Result<Transaction, AppError> {
    state.with_connection(move |conn| TransactionRepo::create(conn, input)).await
}

#[tauri::command]
pub async fn transaction_update(
    state: State<'_, VaultState>,
    id: String,
    input: UpdateTransactionInput,
) -> Result<Transaction, AppError> {
    state.with_connection(move |conn| TransactionRepo::update(conn, &id, input)).await
}

#[tauri::command]
pub async fn transaction_delete(
    state: State<'_, VaultState>,
    id: String,
) -> Result<(), AppError> {
    state.with_connection(move |conn| TransactionRepo::delete(conn, &id)).await
}

#[tauri::command]
pub async fn transaction_list(
    state: State<'_, VaultState>,
    filter: Option<TransactionFilter>,
) -> Result<Vec<Transaction>, AppError> {
    state.with_connection(move |conn| TransactionRepo::list(conn, filter.as_ref())).await
}

#[tauri::command]
pub async fn category_list(
    state: State<'_, VaultState>,
) -> Result<Vec<Category>, AppError> {
    state.with_connection(|conn| CategoryRepo::list(conn)).await
}
