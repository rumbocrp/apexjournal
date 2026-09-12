use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct DashboardMetrics {
    pub cumulative_net_margin: f64,
    pub proposal_win_rate: f64,
    pub realized_volume: f64,
    pub invoiced_volume: f64,
    pub avg_ticket_size: f64,
    pub base_currency: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct EquityCurvePoint {
    pub date: String,
    pub daily_delta: f64,
    pub cumulative_equity: f64,
    pub volume_income: f64,
    pub volume_expense: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ARAgingSummary {
    pub current_0_30: f64,
    pub pending_31_60: f64,
    pub overdue_61_90: f64,
    pub critical_90_plus: f64,
    pub total_receivable: f64,
    pub traffic_light: String, // "GREEN" | "YELLOW" | "RED"
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CasePnLResult {
    pub realized_income: f64,
    pub realized_expense: f64,
    pub net_margin: f64,
    pub profit_margin_pct: f64,
}
