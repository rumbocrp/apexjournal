use serde::{Deserialize, Serialize};
use crate::models::journal::JournalEntry;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Case {
    pub id: String,
    #[serde(default)]
    pub code: String,
    pub title: String,
    pub client_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_contact: Option<String>,
    pub stage: String, // "LEAD" | "QUOTATION" | "ACTIVE" | "COMPLETED" | "LOST"
    pub quoted_amount: f64,
    pub currency: String,
    #[serde(default)]
    pub proposal_value_base: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub target_completion_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub closed_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCaseInput {
    pub id: Option<String>,
    pub code: Option<String>,
    pub title: String,
    pub client_name: String,
    pub client_contact: Option<String>,
    pub stage: Option<String>,
    pub quoted_amount: Option<f64>,
    pub currency: Option<String>,
    pub start_date: Option<String>,
    pub target_completion_date: Option<String>,
    pub closed_date: Option<String>,
    pub notes: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UpdateCaseInput {
    pub code: Option<String>,
    pub title: Option<String>,
    pub client_name: Option<String>,
    pub client_contact: Option<String>,
    pub stage: Option<String>,
    pub quoted_amount: Option<f64>,
    pub currency: Option<String>,
    pub start_date: Option<String>,
    pub target_completion_date: Option<String>,
    pub closed_date: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Milestone {
    pub id: String,
    pub case_id: String,
    pub title: String,
    #[serde(default)]
    pub description: String,
    #[serde(default)]
    pub due_date: String,
    #[serde(alias = "is_completed")]
    pub completed: bool,
    #[serde(alias = "amount_base")]
    pub amount: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub completed_date: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateMilestoneInput {
    pub id: Option<String>,
    pub case_id: String,
    pub title: String,
    pub description: Option<String>,
    pub due_date: Option<String>,
    pub completed: Option<bool>,
    pub amount: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct CaseDetail {
    pub id: String,
    #[serde(default)]
    pub code: String,
    pub title: String,
    pub client_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub client_contact: Option<String>,
    pub stage: String,
    pub quoted_amount: f64,
    pub currency: String,
    pub created_at: String,
    pub updated_at: String,
    pub realized_income: f64,
    pub realized_expense: f64,
    pub net_margin: f64,
    pub profit_margin_pct: f64,
    pub milestones: Vec<Milestone>,
    pub diary_entries: Vec<JournalEntry>,
}
