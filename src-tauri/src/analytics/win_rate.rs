use crate::models::Case;
use super::round2;

/// Computes the win rate of closed proposals: (Won Cases / Total Closed Cases) * 100
/// Closed cases are strictly COMPLETED and LOST.
/// Leads, Quotations, and Active Projects are ignored.
pub fn calculate_win_rate(cases: &[Case]) -> f64 {
    let closed_cases: Vec<&Case> = cases
        .iter()
        .filter(|c| c.stage.eq_ignore_ascii_case("COMPLETED") || c.stage.eq_ignore_ascii_case("LOST"))
        .collect();

    if closed_cases.is_empty() {
        return 0.0;
    }

    let won_cases_count = closed_cases
        .iter()
        .filter(|c| c.stage.eq_ignore_ascii_case("COMPLETED"))
        .count();

    let win_rate = (won_cases_count as f64 / closed_cases.len() as f64) * 100.0;
    round2(win_rate)
}
