use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use crate::models::{ARAgingSummary, Transaction};
use super::{decimal_from_f64, round2};

/// Calculates the 4-bucket Accounts Receivable aging schedule for outstanding INCOME transactions.
pub fn calculate_ar_aging(
    transactions: &[Transaction],
    reference_date: Option<DateTime<Utc>>,
) -> ARAgingSummary {
    let ref_date = reference_date.unwrap_or_else(Utc::now).date_naive();

    let mut current_0_30 = Decimal::ZERO;
    let mut pending_31_60 = Decimal::ZERO;
    let mut overdue_61_90 = Decimal::ZERO;
    let mut critical_90_plus = Decimal::ZERO;

    for tx in transactions {
        let is_outstanding = tx.r#type.eq_ignore_ascii_case("INCOME")
            && (tx.status.eq_ignore_ascii_case("INVOICED") || tx.status.eq_ignore_ascii_case("PENDING"));

        if !is_outstanding {
            continue;
        }

        let date_str = if tx.date.contains('T') {
            tx.date.split('T').next().unwrap_or(&tx.date)
        } else if tx.date.len() >= 10 {
            &tx.date[..10]
        } else {
            &tx.date
        };

        let tx_date = NaiveDate::parse_from_str(date_str, "%Y-%m-%d").unwrap_or(ref_date);
        let diff_days = (ref_date - tx_date).num_days();
        let age_days = std::cmp::max(0, diff_days);

        let amount = decimal_from_f64(tx.base_amount);

        if age_days <= 30 {
            current_0_30 += amount;
        } else if age_days <= 60 {
            pending_31_60 += amount;
        } else if age_days <= 90 {
            overdue_61_90 += amount;
        } else {
            critical_90_plus += amount;
        }
    }

    use rust_decimal::prelude::ToPrimitive;
    let current_0_30 = {
        let v = current_0_30.round_dp(2).to_f64().unwrap_or(0.0);
        if v == 0.0 { 0.0 } else { v }
    };
    let pending_31_60 = {
        let v = pending_31_60.round_dp(2).to_f64().unwrap_or(0.0);
        if v == 0.0 { 0.0 } else { v }
    };
    let overdue_61_90 = {
        let v = overdue_61_90.round_dp(2).to_f64().unwrap_or(0.0);
        if v == 0.0 { 0.0 } else { v }
    };
    let critical_90_plus = {
        let v = critical_90_plus.round_dp(2).to_f64().unwrap_or(0.0);
        if v == 0.0 { 0.0 } else { v }
    };

    let total_receivable = round2(current_0_30 + pending_31_60 + overdue_61_90 + critical_90_plus);

    let traffic_light = if critical_90_plus > 0.0 {
        "RED".to_string()
    } else if overdue_61_90 > 0.0 {
        "YELLOW".to_string()
    } else {
        "GREEN".to_string()
    };

    ARAgingSummary {
        current_0_30,
        pending_31_60,
        overdue_61_90,
        critical_90_plus,
        total_receivable,
        traffic_light,
    }
}
