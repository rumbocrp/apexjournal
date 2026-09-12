use crate::models::{CasePnLResult, Transaction};
use super::{round2, sum_round2};

/// Calculates realized income, expense, net margin, and profit margin percentage.
/// Only CLEARED and PAID transactions are considered realized.
pub fn calculate_case_pnl(transactions: &[Transaction], case_id: Option<&str>) -> CasePnLResult {
    let mut incomes: Vec<f64> = Vec::new();
    let mut expenses: Vec<f64> = Vec::new();

    for tx in transactions {
        if let Some(target_case_id) = case_id {
            if tx.case_id.as_deref() != Some(target_case_id) {
                continue;
            }
        }

        let is_realized = tx.status.eq_ignore_ascii_case("CLEARED") || tx.status.eq_ignore_ascii_case("PAID");
        if is_realized {
            let amount = tx.base_amount;
            if tx.r#type.eq_ignore_ascii_case("INCOME") {
                incomes.push(amount);
            } else if tx.r#type.eq_ignore_ascii_case("EXPENSE") {
                expenses.push(amount);
            }
        }
    }

    // Decimal accumulation via sum_round2 avoids f64 drift on large portfolios.
    let realized_income = sum_round2(incomes.into_iter());
    let realized_expense = sum_round2(expenses.into_iter());
    let net_margin = round2(realized_income - realized_expense);

    let profit_margin_pct = if realized_income > 0.0 {
        round2((net_margin / realized_income) * 100.0)
    } else {
        0.0
    };

    CasePnLResult {
        realized_income,
        realized_expense,
        net_margin,
        profit_margin_pct,
    }
}

/// Calculates realized portfolio PnL across all transactions.
pub fn calculate_portfolio_pnl(transactions: &[Transaction]) -> CasePnLResult {
    calculate_case_pnl(transactions, None)
}
