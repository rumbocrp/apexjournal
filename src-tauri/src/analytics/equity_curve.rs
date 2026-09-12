use std::collections::BTreeMap;
use chrono::{DateTime, Duration, NaiveDate, Utc};
use rust_decimal::Decimal;
use rust_decimal::prelude::ToPrimitive;
use crate::models::{EquityCurvePoint, Transaction};
use super::{decimal_from_f64, round2};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Timeframe {
    OneWeek,
    OneMonth,
    ThreeMonths,
    OneYear,
    All,
}

impl Timeframe {
    pub fn parse(s: Option<&str>) -> Self {
        match s.map(|v| v.trim().to_uppercase()).as_deref() {
            Some("1W") => Timeframe::OneWeek,
            Some("1M") => Timeframe::OneMonth,
            Some("3M") => Timeframe::ThreeMonths,
            Some("1Y") => Timeframe::OneYear,
            _ => Timeframe::All,
        }
    }
}

pub struct DayVolume {
    pub income: f64,
    pub expense: f64,
}

/// Generates the daily delta and cumulative running equity curve.
pub fn calculate_equity_curve(
    transactions: &[Transaction],
    timeframe: Timeframe,
    reference_date: Option<DateTime<Utc>>,
) -> Vec<EquityCurvePoint> {
    let ref_date = reference_date.unwrap_or_else(Utc::now);

    // 1. Group realized transactions by date YYYY-MM-DD.
    // Decimal accumulation per day: exact sums, single Bankers rounding each.
    // DayVolume keeps its f64 interface; precision lives inside the grouping.
    let mut daily_dec: BTreeMap<String, (Decimal, Decimal)> = BTreeMap::new();

    for tx in transactions {
        let is_realized = tx.status.eq_ignore_ascii_case("CLEARED") || tx.status.eq_ignore_ascii_case("PAID");
        if !is_realized {
            continue;
        }

        let date_key = if tx.date.contains('T') {
            tx.date.split('T').next().unwrap_or(&tx.date).to_string()
        } else if tx.date.len() >= 10 {
            tx.date[..10].to_string()
        } else {
            tx.date.clone()
        };

        let entry = daily_dec.entry(date_key).or_insert((Decimal::ZERO, Decimal::ZERO));
        if tx.r#type.eq_ignore_ascii_case("INCOME") {
            entry.0 += decimal_from_f64(tx.base_amount);
        } else if tx.r#type.eq_ignore_ascii_case("EXPENSE") {
            entry.1 += decimal_from_f64(tx.base_amount);
        }
    }

    let mut daily_map: BTreeMap<String, DayVolume> = BTreeMap::new();
    for (k, (inc, exp)) in daily_dec {
        let income = inc.round_dp(2).to_f64().unwrap_or(0.0);
        let expense = exp.round_dp(2).to_f64().unwrap_or(0.0);
        daily_map.insert(
            k,
            DayVolume {
                income: if income == 0.0 { 0.0 } else { income },
                expense: if expense == 0.0 { 0.0 } else { expense },
            },
        );
    }

    // 2. Determine timeframe cutoff threshold
    let cutoff_date: Option<NaiveDate> = match timeframe {
        Timeframe::OneWeek => Some((ref_date - Duration::days(7)).date_naive()),
        Timeframe::OneMonth => Some((ref_date - Duration::days(30)).date_naive()),
        Timeframe::ThreeMonths => Some((ref_date - Duration::days(90)).date_naive()),
        Timeframe::OneYear => Some((ref_date - Duration::days(365)).date_naive()),
        Timeframe::All => None,
    };

    // 3. Compute running cumulative equity in chronological order
    let mut running_cumulative = 0.0;
    let mut points = Vec::new();

    for (d_str, vol) in daily_map {
        let day_income = round2(vol.income);
        let day_expense = round2(vol.expense);
        let daily_delta = round2(day_income - day_expense);
        running_cumulative = round2(running_cumulative + daily_delta);

        let parsed_date = NaiveDate::parse_from_str(&d_str, "%Y-%m-%d").ok();

        let is_in_timeframe = match (cutoff_date, parsed_date) {
            (Some(cutoff), Some(d)) => d >= cutoff,
            (Some(_), None) => true, // Fallback if non-standard date format
            (None, _) => true,
        };

        if is_in_timeframe {
            points.push(EquityCurvePoint {
                date: d_str,
                daily_delta,
                cumulative_equity: running_cumulative,
                volume_income: day_income,
                volume_expense: day_expense,
            });
        }
    }

    points
}
