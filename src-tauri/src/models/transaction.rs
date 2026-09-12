use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Transaction {
    pub id: String,
    pub date: String,
    pub r#type: String, // "INCOME" | "EXPENSE"
    pub category_id: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category_name: Option<String>,
    pub amount: f64,
    pub currency: String,
    pub exchange_rate: f64,
    pub base_amount: f64,
    pub status: String, // "CLEARED" | "PENDING" | "INVOICED" | "PAID" | "OVERDUE" | "CANCELLED"
    #[serde(skip_serializing_if = "Option::is_none")]
    pub case_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub case_title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateTransactionInput {
    pub id: Option<String>,
    pub date: String,
    pub r#type: String,
    pub category_id: Option<String>,
    pub category_name: Option<String>,
    pub amount: f64,
    pub currency: Option<String>,
    pub exchange_rate: Option<f64>,
    pub status: Option<String>,
    pub case_id: Option<String>,
    pub case_title: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UpdateTransactionInput {
    pub date: Option<String>,
    pub r#type: Option<String>,
    pub category_id: Option<String>,
    pub category_name: Option<String>,
    pub amount: Option<f64>,
    pub currency: Option<String>,
    pub exchange_rate: Option<f64>,
    pub status: Option<String>,
    pub case_id: Option<Option<String>>,
    pub case_title: Option<String>,
    pub notes: Option<Option<String>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TransactionFilter {
    pub r#type: Option<String>,
    pub status: Option<String>,
    pub case_id: Option<String>,
    pub category_id: Option<String>,
    pub currency: Option<String>,
    #[serde(alias = "startDate")]
    pub start_date: Option<String>,
    #[serde(alias = "endDate")]
    pub end_date: Option<String>,
    pub search: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Category {
    pub id: String,
    pub name: String,
    pub r#type: String, // "INCOME" | "EXPENSE"
    pub color_hex: String,
    pub is_system: bool,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateCategoryInput {
    pub id: Option<String>,
    pub name: String,
    pub r#type: String,
    pub color_hex: Option<String>,
    pub is_system: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ExchangeRate {
    pub currency_code: String,
    pub rate_to_base: f64,
    pub updated_at: String,
}
