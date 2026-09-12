pub mod pnl;
pub mod equity_curve;
pub mod win_rate;
pub mod dashboard;
pub mod ar_aging;

pub use pnl::{calculate_case_pnl, calculate_portfolio_pnl};
pub use equity_curve::{calculate_equity_curve, Timeframe};
pub use win_rate::calculate_win_rate;
pub use dashboard::calculate_dashboard_metrics;
pub use ar_aging::calculate_ar_aging;

use rust_decimal::prelude::ToPrimitive;
use rust_decimal::Decimal;
use std::str::FromStr;

/// Convert f64 to Decimal via string round-trip to avoid binary float artifacts.
/// E.g. 10.555f64 -> "10.555" -> Decimal(10.555) exact, instead of 10.55499...
#[inline]
pub fn decimal_from_f64(val: f64) -> Decimal {
    if !val.is_finite() {
        return Decimal::ZERO;
    }
    Decimal::from_str(&val.to_string()).unwrap_or(Decimal::ZERO)
}

/// Bankers rounding (MidpointNearestEven) to 2 decimals per SPEC §2.2.
/// Uses rust_decimal::Decimal::round_dp which defaults to Bankers.
#[inline]
pub fn round2(val: f64) -> f64 {
    if !val.is_finite() {
        return 0.0;
    }
    let d = decimal_from_f64(val).round_dp(2);
    let r = d.to_f64().unwrap_or(0.0);
    if r == 0.0 {
        0.0
    } else {
        r
    }
}

/// BaseAmount(t) = RoundBankers(Amount * FXRate, 2) per SPEC §2.2.
/// Both operands go through Decimal to eliminate IEEE-754 error (0.1+0.2).
#[inline]
pub fn calc_base_amount(amount: f64, exchange_rate: f64) -> f64 {
    let a = decimal_from_f64(amount);
    let r = decimal_from_f64(exchange_rate);
    let product = a.checked_mul(r).unwrap_or(Decimal::ZERO);
    let rounded = product.round_dp(2);
    let v = rounded.to_f64().unwrap_or(0.0);
    if v == 0.0 {
        0.0
    } else {
        v
    }
}

/// Decimal accumulation helper: sum slice of f64 via Decimal then Bankers round.
#[inline]
pub fn sum_round2(values: impl Iterator<Item = f64>) -> f64 {
    let mut acc = Decimal::ZERO;
    for v in values {
        acc += decimal_from_f64(v);
    }
    let r = acc.round_dp(2).to_f64().unwrap_or(0.0);
    if r == 0.0 {
        0.0
    } else {
        r
    }
}
