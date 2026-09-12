use tauri::State;
use crate::db::{CaseRepo, MilestoneRepo};
use crate::error::AppError;
use crate::models::{Case, CaseDetail, CreateCaseInput, CreateMilestoneInput, Milestone, UpdateCaseInput};
use crate::state::VaultState;

#[tauri::command]
pub async fn case_create(
    state: State<'_, VaultState>,
    input: CreateCaseInput,
) -> Result<Case, AppError> {
    state.with_connection(move |conn| CaseRepo::create(conn, input)).await
}

#[tauri::command]
pub async fn case_update(
    state: State<'_, VaultState>,
    id: String,
    input: UpdateCaseInput,
) -> Result<Case, AppError> {
    state.with_connection(move |conn| CaseRepo::update(conn, &id, input)).await
}

#[tauri::command]
pub async fn case_list(
    state: State<'_, VaultState>,
) -> Result<Vec<Case>, AppError> {
    state.with_connection(|conn| CaseRepo::list(conn)).await
}

#[tauri::command]
pub async fn case_get_detail(
    state: State<'_, VaultState>,
    id: String,
) -> Result<CaseDetail, AppError> {
    state.with_connection(move |conn| CaseRepo::get_detail(conn, &id)).await
}

#[tauri::command]
pub async fn milestone_create(
    state: State<'_, VaultState>,
    input: CreateMilestoneInput,
) -> Result<Milestone, AppError> {
    state.with_connection(move |conn| MilestoneRepo::create(conn, input)).await
}

#[tauri::command]
pub async fn milestone_toggle(
    state: State<'_, VaultState>,
    id: String,
    completed: bool,
) -> Result<Milestone, AppError> {
    state.with_connection(move |conn| MilestoneRepo::toggle(conn, &id, completed)).await
}
