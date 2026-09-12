use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct JournalEntry {
    pub id: String,
    pub date: String,
    pub title: String,
    pub content: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub case_id: Option<String>,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub is_starred: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateJournalInput {
    pub id: Option<String>,
    pub date: Option<String>,
    pub title: Option<String>,
    pub content: String,
    pub case_id: Option<String>,
    pub tags: Option<Vec<String>>,
    pub is_starred: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UpdateJournalInput {
    pub date: Option<String>,
    pub title: Option<String>,
    pub content: Option<String>,
    pub case_id: Option<Option<String>>,
    pub tags: Option<Vec<String>>,
    pub is_starred: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct JournalFilter {
    pub case_id: Option<String>,
    pub tag: Option<String>,
    pub search: Option<String>,
}
