use tauri::State;
use crate::analytics::{calculate_ar_aging, calculate_dashboard_metrics, calculate_equity_curve, Timeframe};
use crate::db::{CaseRepo, ExchangeRateRepo, TransactionRepo};
use crate::error::AppError;
use crate::models::{ARAgingSummary, DashboardMetrics, EquityCurvePoint};
use crate::state::VaultState;

#[tauri::command]
pub async fn analytics_get_dashboard(
    state: State<'_, VaultState>,
) -> Result<DashboardMetrics, AppError> {
    state.with_connection(|conn| {
        let txs = TransactionRepo::list(conn, None)?;
        let cases = CaseRepo::list(conn)?;
        let base_currency = ExchangeRateRepo::get_base_currency(conn)?;
        Ok(calculate_dashboard_metrics(&txs, &cases, &base_currency))
    }).await
}

#[tauri::command]
pub async fn analytics_get_equity_curve(
    state: State<'_, VaultState>,
    timeframe: Option<String>,
) -> Result<Vec<EquityCurvePoint>, AppError> {
    state.with_connection(move |conn| {
        let txs = TransactionRepo::list(conn, None)?;
        let tf = Timeframe::parse(timeframe.as_deref());
        Ok(calculate_equity_curve(&txs, tf, None))
    }).await
}

#[tauri::command]
pub async fn analytics_get_ar_aging(
    state: State<'_, VaultState>,
) -> Result<ARAgingSummary, AppError> {
    state
        .with_connection(|conn| TransactionRepo::calculate_ar_aging_sql(conn))
        .await
}

/// SPEC §6.2 alias: canonical handler name from Sistema de Luces spec.
/// Keeps frontend command `analytics_get_ar_aging` working while exposing
/// the spec contract `get_ar_aging_summary`.
#[tauri::command]
pub async fn get_ar_aging_summary(
    state: State<'_, VaultState>,
) -> Result<ARAgingSummary, AppError> {
    state
        .with_connection(|conn| TransactionRepo::calculate_ar_aging_sql(conn))
        .await
}

#[allow(dead_code)]
fn _keep_in_memory_ar_aging_referenced() {
    let _ = calculate_ar_aging;
}
