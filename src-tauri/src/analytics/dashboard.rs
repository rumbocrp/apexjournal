use crate::models::{Case, DashboardMetrics, Transaction};
use super::pnl::calculate_case_pnl;
use super::win_rate::calculate_win_rate;
use super::{decimal_from_f64, sum_round2};

/// Aggregates all KPI metrics for the Executive Dashboard.
pub fn calculate_dashboard_metrics(
    transactions: &[Transaction],
    cases: &[Case],
    base_currency: &str,
) -> DashboardMetrics {
    let pnl = calculate_case_pnl(transactions, None);
    let proposal_win_rate = calculate_win_rate(cases);

    // Invoiced Volume: Sum of quoted_amount for ACTIVE, COMPLETED, QUOTATION cases + INVOICED income txs.
    // Decimal accumulation: one addend list, one Bankers rounding.
    let mut invoiced_addends: Vec<f64> = Vec::new();
    for c in cases {
        let stage = c.stage.to_uppercase();
        if stage == "ACTIVE" || stage == "COMPLETED" || stage == "QUOTATION" {
            invoiced_addends.push(c.quoted_amount);
        }
    }
    for tx in transactions {
        if tx.r#type.eq_ignore_ascii_case("INCOME") && tx.status.eq_ignore_ascii_case("INVOICED") {
            invoiced_addends.push(tx.base_amount);
        }
    }
    let invoiced_volume = sum_round2(invoiced_addends.into_iter());

    // Average Ticket Size: Mean quoted amount of COMPLETED cases.
    // Mean via Decimal: sum exact, single division, single Bankers rounding.
    let completed_cases: Vec<&Case> = cases
        .iter()
        .filter(|c| c.stage.eq_ignore_ascii_case("COMPLETED"))
        .collect();

    let avg_ticket_size = if !completed_cases.is_empty() {
        let total = sum_round2(completed_cases.iter().map(|c| c.quoted_amount));
        let mean = decimal_from_f64(total) / decimal_from_f64(completed_cases.len() as f64);
        use rust_decimal::prelude::ToPrimitive;
        let v = mean.round_dp(2).to_f64().unwrap_or(0.0);
        if v == 0.0 { 0.0 } else { v }
    } else {
        0.0
    };

    DashboardMetrics {
        cumulative_net_margin: pnl.net_margin,
        proposal_win_rate,
        realized_volume: pnl.realized_income,
        invoiced_volume,
        avg_ticket_size,
        base_currency: base_currency.to_string(),
    }
}
