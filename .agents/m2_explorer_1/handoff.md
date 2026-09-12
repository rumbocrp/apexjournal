# Milestone 2 Implementation Blueprint: Relational Data Model & Financial Analytics Engines

## 1. Observation

Direct investigation of the codebase and test harness revealed the following specific requirements and structural observations:

1. **Mathematical Reference (`tests/harness/oracle.js`)**:
   - `calculateCasePnL` (lines 24–58): Computes realized income and realized expense from `status IN ('CLEARED', 'PAID')` transactions. Calculates `net_margin = realized_income - realized_expense` rounded to 2 decimal places. Calculates `profit_margin_pct = realized_income > 0 ? round2((net_margin / realized_income) * 100) : 0.0`.
   - `calculateWinRate` (lines 60–68): Only considers closed cases (`stage IN ('COMPLETED', 'LOST')`). Returns `round2((won_cases / closed_cases) * 100.0)`. If `closed_cases == 0`, returns `0.0`. Cases in `LEAD`, `QUOTATION`, and `ACTIVE` are strictly excluded from the win rate denominator.
   - `calculateEquityCurve` (lines 70–129): Groups realized (`CLEARED` or `PAID`) transactions by date (`YYYY-MM-DD`), accumulates `volume_income` and `volume_expense`, calculates `daily_delta = day_income - day_expense`, and builds a full running cumulative series `runningCumulative`. For timeframe filters (`1W` = 7d, `1M` = 30d, `3M` = 90d, `1Y` = 365d, `ALL` = no cutoff), points outside the window are filtered *after* running cumulative calculation, ensuring the baseline cumulative level is preserved.
   - `calculateARAging` (lines 131–182): Filters `type == 'INCOME'` and `status IN ('INVOICED', 'PENDING')`. Calculates age in days relative to `referenceDate` as `max(0, floor((ref - tx) / 86400000))`. 4 buckets:
     - `current_0_30`: $0 \le \text{age} \le 30$
     - `pending_31_60`: $31 \le \text{age} \le 60$
     - `overdue_61_90`: $61 \le \text{age} \le 90$
     - `critical_90_plus`: $\text{age} > 90$
     Traffic light rules: `"RED"` if `critical_90_plus > 0`, `"YELLOW"` if `overdue_61_90 > 0`, otherwise `"GREEN"`.
   - `calculateDashboardMetrics` (lines 184–218): Aggregates portfolio PnL, proposal win rate, invoiced volume (sum of `quoted_amount` for cases in `ACTIVE`, `COMPLETED`, `QUOTATION` plus base amount of `INCOME` transactions in `INVOICED` status), and average ticket size (mean `quoted_amount` for `COMPLETED` cases, or 0.0 if none).

2. **Interface Contracts (`PROJECT.md` lines 76–186)**:
   - Data models: `Transaction`, `Case`, `CaseDetail`, `Milestone`, `JournalEntry`, `DashboardMetrics`, `EquityCurvePoint`, `ARAgingSummary`, `Category`.
   - IPC Commands: `transaction_create`, `transaction_update`, `transaction_delete`, `transaction_list`, `category_list`, `case_create`, `case_update`, `case_list`, `case_get_detail`, `milestone_create`, `milestone_toggle`, `journal_create`, `journal_update`, `journal_list`, `analytics_get_dashboard`, `analytics_get_equity_curve`, `analytics_get_ar_aging`.

3. **Current Codebase State (`src-tauri/`)**:
   - `src/lib.rs`: Has M1 setup and auth command handlers. Needs `pub mod analytics;` and registration of M2 IPC commands.
   - `src/db/schema.rs`: Contains DDL for `app_settings`, `categories`, `exchange_rates`, `cases`, `milestones`, `transactions`, and `journal_entries`. Needs default data seeding (`INSERT OR IGNORE`) for 6 predefined categories (`cat-1` through `cat-6`) and exchange rates (`USD`, `EUR`, `GBP`, `JPY`).
   - `src/db/migrations.rs`: Applies `INITIAL_SCHEMA_SQL` on `user_version = 0`.
   - `src/models/`: Only contains `auth.rs`. Needs `transaction.rs`, `case_model.rs`, `journal.rs`, `analytics.rs`.
   - `src/analytics/`: Directory does not yet exist. Needs `pnl.rs`, `equity_curve.rs`, `win_rate.rs`, `dashboard.rs`, `ar_aging.rs`, `mod.rs`.
   - `src/state/mod.rs`: Provides `VaultState.with_connection(...)` returning `Result<T, AppError>` and handling inactivity auto-lock.

---

## 2. Logic Chain

1. **Deterministic Financial Math**:
   - Floating point arithmetic in financial computations must be rounded deterministically using a 2-decimal precision helper: `round2(x: f64) -> f64 = if (x * 100.0).round() == 0.0 { 0.0 } else { (x * 100.0).round() / 100.0 }`. This prevents `-0.0` and IEEE 754 precision artifacts (e.g. $0.1 + 0.2 = 0.30000000000000004 \to 0.30$).
   - Multi-currency transactions calculate `base_amount = round2(amount * exchange_rate)`.
   - Foreign transactions default `exchange_rate` to 1.0 or lookup from the `exchange_rates` table if not provided. Exchange rates $\le 0.0$ are strictly rejected with `AppError::ValidationError`.

2. **Schema & Foreign Key Integrity**:
   - `PRAGMA foreign_keys = ON;` is enforced on every SQLCipher connection.
   - When a case is deleted, `milestones` cascade-delete (`ON DELETE CASCADE`), while `transactions` and `journal_entries` decouple to null (`ON DELETE SET NULL`).
   - Queries joining `transactions` with `categories` (`LEFT JOIN categories c ON t.category_id = c.id`) and `cases` (`LEFT JOIN cases cs ON t.case_id = cs.id`) dynamically populate `category_name` and `case_title`.

3. **Domain Structs & Serde Serialization**:
   - To support flexible client payloads, input structs use optional fields and Serde aliases (e.g. `#[serde(alias = "startDate")]` for `start_date`, `#[serde(alias = "is_completed")]` for `completed`, and `#[serde(alias = "amount_base")]` for `amount`).
   - Case Detail joins all related milestones and journal entries, plus computes real-time PnL metrics for that specific case.

4. **Zero-Division & Edge Case Robustness**:
   - Win Rate: If `closed_cases == 0`, immediately return `0.0`.
   - Profit Margin %: If `realized_income <= 0.0`, return `0.0` even if `net_margin` is negative.
   - Average Ticket Size: If `completed_cases.is_empty()`, return `0.0`.
   - AR Aging across Leap Years: Chrono's `NaiveDate` arithmetic accurately counts days across February 29 (e.g. 2028-02-01 to 2028-03-05 = 33 days).

---

## 3. Blueprint: Exact File Specifications

### 3.1 Domain Models (`src-tauri/src/models/`)

#### File: `src-tauri/src/models/transaction.rs`
```rust
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
```

#### File: `src-tauri/src/models/case_model.rs`
```rust
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
```

#### File: `src-tauri/src/models/journal.rs`
```rust
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
```

#### File: `src-tauri/src/models/analytics.rs`
```rust
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
```

#### File: `src-tauri/src/models/mod.rs`
```rust
pub mod auth;
pub mod transaction;
pub mod case_model;
pub mod journal;
pub mod analytics;

pub use auth::*;
pub use transaction::*;
pub use case_model::*;
pub use journal::*;
pub use analytics::*;
```

---

### 3.2 Database Schema & CRUD Layer (`src-tauri/src/db/`)

#### File: `src-tauri/src/db/schema.rs`
```rust
//! Database Initial Schema DDL

pub const INITIAL_SCHEMA_SQL: &str = r#"
-- SQLite SQLCipher Initial Schema for ApexJournal
PRAGMA foreign_keys = ON;

-- 1. Configuration & App Settings
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 2. Financial Categories
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('INCOME', 'EXPENSE')),
    color_hex TEXT NOT NULL DEFAULT '#8B5CF6',
    is_system INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 3. Currencies & Exchange Rates (relative to Base Currency)
CREATE TABLE IF NOT EXISTS exchange_rates (
    currency_code TEXT PRIMARY KEY NOT NULL,
    rate_to_base REAL NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 4. Cases / Projects
CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY NOT NULL,
    code TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL,
    client_name TEXT NOT NULL,
    client_contact TEXT,
    stage TEXT NOT NULL CHECK(stage IN ('LEAD', 'QUOTATION', 'ACTIVE', 'COMPLETED', 'LOST')),
    quoted_amount REAL NOT NULL DEFAULT 0.0,
    currency TEXT NOT NULL DEFAULT 'USD',
    proposal_value_base REAL NOT NULL DEFAULT 0.0,
    start_date TEXT,
    target_completion_date TEXT,
    closed_date TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 5. Case Milestones
CREATE TABLE IF NOT EXISTS milestones (
    id TEXT PRIMARY KEY NOT NULL,
    case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    due_date TEXT,
    is_completed INTEGER NOT NULL DEFAULT 0,
    amount_base REAL NOT NULL DEFAULT 0.0,
    completed_date TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 6. Financial Transactions (Blotter)
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY NOT NULL,
    date TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('INCOME', 'EXPENSE')),
    category_id TEXT NOT NULL REFERENCES categories(id),
    amount REAL NOT NULL,
    currency TEXT NOT NULL DEFAULT 'USD',
    exchange_rate REAL NOT NULL DEFAULT 1.0,
    base_amount REAL NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('CLEARED', 'PENDING', 'INVOICED', 'PAID', 'OVERDUE', 'CANCELLED')),
    case_id TEXT REFERENCES cases(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- 7. Operations Journal Entries (Markdown Feed)
CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY NOT NULL,
    date TEXT NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    content TEXT NOT NULL,
    case_id TEXT REFERENCES cases(id) ON DELETE SET NULL,
    tags_json TEXT NOT NULL DEFAULT '[]',
    is_starred INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- Indexes for Query Performance
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_case ON transactions(case_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type_status ON transactions(type, status);
CREATE INDEX IF NOT EXISTS idx_cases_stage ON cases(stage);
CREATE INDEX IF NOT EXISTS idx_milestones_case ON milestones(case_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_date ON journal_entries(date);
CREATE INDEX IF NOT EXISTS idx_journal_case ON journal_entries(case_id);

-- Seed Default App Settings
INSERT OR IGNORE INTO app_settings (key, value) VALUES ('base_currency', 'USD');

-- Seed Default Exchange Rates
INSERT OR IGNORE INTO exchange_rates (currency_code, rate_to_base) VALUES ('USD', 1.0);
INSERT OR IGNORE INTO exchange_rates (currency_code, rate_to_base) VALUES ('EUR', 1.085);
INSERT OR IGNORE INTO exchange_rates (currency_code, rate_to_base) VALUES ('GBP', 1.28);
INSERT OR IGNORE INTO exchange_rates (currency_code, rate_to_base) VALUES ('JPY', 0.0068);

-- Seed Default 6 Predefined Categories
INSERT OR IGNORE INTO categories (id, name, type, color_hex, is_system) VALUES 
('cat-1', 'Client Consulting Fee', 'INCOME', '#8B5CF6', 1),
('cat-2', 'Retainer', 'INCOME', '#10B981', 1),
('cat-3', 'Subcontractor / Engineering', 'EXPENSE', '#EF4444', 1),
('cat-4', 'Software & SaaS Subscriptions', 'EXPENSE', '#F59E0B', 1),
('cat-5', 'Travel & Hospitality', 'EXPENSE', '#EC4899', 1),
('cat-6', 'Legal & Accounting', 'EXPENSE', '#6366F1', 1);
"#;
```

#### File: `src-tauri/src/db/transactions.rs`
```rust
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;
use crate::analytics::round2;
use crate::error::AppError;
use crate::models::{CreateTransactionInput, Transaction, TransactionFilter, UpdateTransactionInput};

pub struct TransactionRepo;

impl TransactionRepo {
    pub fn create(conn: &Connection, input: CreateTransactionInput) -> Result<Transaction, AppError> {
        if input.date.trim().is_empty() {
            return Err(AppError::ValidationError("Transaction date is required.".into()));
        }
        if input.r#type != "INCOME" && input.r#type != "EXPENSE" {
            return Err(AppError::ValidationError("Valid transaction type (INCOME or EXPENSE) is required.".into()));
        }
        if input.amount < 0.0 || input.amount.is_nan() || input.amount.is_infinite() {
            return Err(AppError::ValidationError("Valid transaction amount is required.".into()));
        }

        let exchange_rate = input.exchange_rate.unwrap_or(1.0);
        if exchange_rate <= 0.0 || exchange_rate.is_nan() || exchange_rate.is_infinite() {
            return Err(AppError::ValidationError("Exchange rate must be strictly positive.".into()));
        }

        let id = input.id.unwrap_or_else(|| format!("tx-{}", Uuid::new_v4()));
        let currency = input.currency.unwrap_or_else(|| "USD".into());
        let base_amount = round2(input.amount * exchange_rate);
        let status = input.status.unwrap_or_else(|| "CLEARED".into());
        let category_id = input.category_id.unwrap_or_else(|| {
            if input.r#type == "INCOME" { "cat-1".into() } else { "cat-4".into() }
        });

        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO transactions (id, date, type, category_id, amount, currency, exchange_rate, base_amount, status, case_id, notes, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
            params![
                id,
                input.date,
                input.r#type,
                category_id,
                input.amount,
                currency,
                exchange_rate,
                base_amount,
                status,
                input.case_id,
                input.notes,
                now,
                now,
            ],
        )?;

        Self::get_by_id(conn, &id)
    }

    pub fn update(conn: &Connection, id: &str, input: UpdateTransactionInput) -> Result<Transaction, AppError> {
        let existing = Self::get_by_id(conn, id)?;

        let new_amount = input.amount.unwrap_or(existing.amount);
        if new_amount < 0.0 || new_amount.is_nan() || new_amount.is_infinite() {
            return Err(AppError::ValidationError("Invalid transaction amount.".into()));
        }

        let new_rate = input.exchange_rate.unwrap_or(existing.exchange_rate);
        if new_rate <= 0.0 || new_rate.is_nan() || new_rate.is_infinite() {
            return Err(AppError::ValidationError("Exchange rate must be positive.".into()));
        }

        let new_base_amount = round2(new_amount * new_rate);
        let new_date = input.date.unwrap_or(existing.date);
        let new_type = input.r#type.unwrap_or(existing.r#type);
        let new_category_id = input.category_id.unwrap_or(existing.category_id);
        let new_currency = input.currency.unwrap_or(existing.currency);
        let new_status = input.status.unwrap_or(existing.status);
        let new_case_id = match input.case_id {
            Some(opt) => opt,
            None => existing.case_id,
        };
        let new_notes = match input.notes {
            Some(opt) => opt,
            None => existing.notes,
        };
        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "UPDATE transactions SET
                date = ?2, type = ?3, category_id = ?4, amount = ?5, currency = ?6,
                exchange_rate = ?7, base_amount = ?8, status = ?9, case_id = ?10,
                notes = ?11, updated_at = ?12
             WHERE id = ?1",
            params![
                id,
                new_date,
                new_type,
                new_category_id,
                new_amount,
                new_currency,
                new_rate,
                new_base_amount,
                new_status,
                new_case_id,
                new_notes,
                now,
            ],
        )?;

        Self::get_by_id(conn, id)
    }

    pub fn delete(conn: &Connection, id: &str) -> Result<(), AppError> {
        let rows = conn.execute("DELETE FROM transactions WHERE id = ?1", params![id])?;
        if rows == 0 {
            return Err(AppError::NotFound(format!("Transaction with ID {} not found.", id)));
        }
        Ok(())
    }

    pub fn get_by_id(conn: &Connection, id: &str) -> Result<Transaction, AppError> {
        conn.query_row(
            "SELECT t.id, t.date, t.type, t.category_id, c.name, t.amount, t.currency,
                    t.exchange_rate, t.base_amount, t.status, t.case_id, cs.title, t.notes
             FROM transactions t
             LEFT JOIN categories c ON t.category_id = c.id
             LEFT JOIN cases cs ON t.case_id = cs.id
             WHERE t.id = ?1",
            params![id],
            |row| {
                Ok(Transaction {
                    id: row.get(0)?,
                    date: row.get(1)?,
                    r#type: row.get(2)?,
                    category_id: row.get(3)?,
                    category_name: row.get(4)?,
                    amount: row.get(5)?,
                    currency: row.get(6)?,
                    exchange_rate: row.get(7)?,
                    base_amount: row.get(8)?,
                    status: row.get(9)?,
                    case_id: row.get(10)?,
                    case_title: row.get(11)?,
                    notes: row.get(12)?,
                })
            },
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound(format!("Transaction with ID {} not found.", id)))
    }

    pub fn list(conn: &Connection, filter: Option<&TransactionFilter>) -> Result<Vec<Transaction>, AppError> {
        let f = filter.cloned().unwrap_or_default();
        let mut stmt = conn.prepare(
            "SELECT t.id, t.date, t.type, t.category_id, c.name, t.amount, t.currency,
                    t.exchange_rate, t.base_amount, t.status, t.case_id, cs.title, t.notes
             FROM transactions t
             LEFT JOIN categories c ON t.category_id = c.id
             LEFT JOIN cases cs ON t.case_id = cs.id
             WHERE (?1 IS NULL OR t.type = ?1)
               AND (?2 IS NULL OR t.status = ?2)
               AND (?3 IS NULL OR t.case_id = ?3)
               AND (?4 IS NULL OR t.category_id = ?4)
               AND (?5 IS NULL OR t.currency = ?5)
               AND (?6 IS NULL OR t.date >= ?6)
               AND (?7 IS NULL OR t.date <= ?7)
               AND (?8 IS NULL OR (
                   (t.notes IS NOT NULL AND LOWER(t.notes) LIKE '%' || LOWER(?8) || '%') OR
                   (cs.title IS NOT NULL AND LOWER(cs.title) LIKE '%' || LOWER(?8) || '%') OR
                   (c.name IS NOT NULL AND LOWER(c.name) LIKE '%' || LOWER(?8) || '%')
               ))
             ORDER BY t.date ASC, t.created_at ASC",
        )?;

        let rows = stmt.query_map(
            params![
                f.r#type,
                f.status,
                f.case_id,
                f.category_id,
                f.currency,
                f.start_date,
                f.end_date,
                f.search,
            ],
            |row| {
                Ok(Transaction {
                    id: row.get(0)?,
                    date: row.get(1)?,
                    r#type: row.get(2)?,
                    category_id: row.get(3)?,
                    category_name: row.get(4)?,
                    amount: row.get(5)?,
                    currency: row.get(6)?,
                    exchange_rate: row.get(7)?,
                    base_amount: row.get(8)?,
                    status: row.get(9)?,
                    case_id: row.get(10)?,
                    case_title: row.get(11)?,
                    notes: row.get(12)?,
                })
            },
        )?;

        let mut result = Vec::new();
        for r in rows {
            result.push(r?);
        }
        Ok(result)
    }
}
```

#### File: `src-tauri/src/db/categories.rs`
```rust
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;
use crate::error::AppError;
use crate::models::{Category, CreateCategoryInput};

pub struct CategoryRepo;

impl CategoryRepo {
    pub fn list(conn: &Connection) -> Result<Vec<Category>, AppError> {
        let mut stmt = conn.prepare(
            "SELECT id, name, type, color_hex, is_system, created_at FROM categories ORDER BY name ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            let is_sys: i64 = row.get(4)?;
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                r#type: row.get(2)?,
                color_hex: row.get(3)?,
                is_system: is_sys != 0,
                created_at: row.get(5)?,
            })
        })?;

        let mut result = Vec::new();
        for r in rows {
            result.push(r?);
        }
        Ok(result)
    }

    pub fn get_by_id(conn: &Connection, id: &str) -> Result<Category, AppError> {
        conn.query_row(
            "SELECT id, name, type, color_hex, is_system, created_at FROM categories WHERE id = ?1",
            params![id],
            |row| {
                let is_sys: i64 = row.get(4)?;
                Ok(Category {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    r#type: row.get(2)?,
                    color_hex: row.get(3)?,
                    is_system: is_sys != 0,
                    created_at: row.get(5)?,
                })
            },
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound(format!("Category with ID {} not found", id)))
    }

    pub fn create(conn: &Connection, input: CreateCategoryInput) -> Result<Category, AppError> {
        let id = input.id.unwrap_or_else(|| format!("cat-{}", Uuid::new_v4()));
        let color_hex = input.color_hex.unwrap_or_else(|| "#8B5CF6".into());
        let is_system = if input.is_system.unwrap_or(false) { 1 } else { 0 };
        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO categories (id, name, type, color_hex, is_system, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, input.name, input.r#type, color_hex, is_system, now],
        )?;

        Self::get_by_id(conn, &id)
    }
}
```

#### File: `src-tauri/src/db/cases.rs`
```rust
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;
use crate::analytics::calculate_case_pnl;
use crate::error::AppError;
use crate::models::{Case, CaseDetail, CreateCaseInput, TransactionFilter, UpdateCaseInput};
use crate::db::transactions::TransactionRepo;
use crate::db::milestones::MilestoneRepo;
use crate::db::journal::JournalRepo;

pub struct CaseRepo;

impl CaseRepo {
    pub fn create(conn: &Connection, input: CreateCaseInput) -> Result<Case, AppError> {
        if input.title.trim().is_empty() {
            return Err(AppError::ValidationError("Case title is required.".into()));
        }
        if input.client_name.trim().is_empty() {
            return Err(AppError::ValidationError("Client name is required.".into()));
        }

        let id = input.id.unwrap_or_else(|| format!("case-{}", Uuid::new_v4()));
        let code = input.code.unwrap_or_else(|| format!("CASE-{}", &id[5.min(id.len())..11.min(id.len())].to_uppercase()));
        let stage = input.stage.unwrap_or_else(|| "LEAD".into());
        let quoted_amount = input.quoted_amount.unwrap_or(0.0);
        let currency = input.currency.unwrap_or_else(|| "USD".into());
        let now = chrono::Utc::now().to_rfc3339();
        let created_at = input.created_at.unwrap_or_else(|| now.clone());
        let updated_at = input.updated_at.unwrap_or_else(|| now.clone());

        conn.execute(
            "INSERT INTO cases (id, code, title, client_name, client_contact, stage, quoted_amount, currency, proposal_value_base, start_date, target_completion_date, closed_date, notes, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![
                id,
                code,
                input.title,
                input.client_name,
                input.client_contact,
                stage,
                quoted_amount,
                currency,
                quoted_amount,
                input.start_date,
                input.target_completion_date,
                input.closed_date,
                input.notes,
                created_at,
                updated_at,
            ],
        )?;

        Self::get_by_id(conn, &id)
    }

    pub fn update(conn: &Connection, id: &str, input: UpdateCaseInput) -> Result<Case, AppError> {
        let existing = Self::get_by_id(conn, id)?;
        let now = chrono::Utc::now().to_rfc3339();

        let new_title = input.title.unwrap_or(existing.title);
        let new_client = input.client_name.unwrap_or(existing.client_name);
        let new_contact = input.client_contact.or(existing.client_contact);
        let new_stage = input.stage.unwrap_or(existing.stage);
        let new_quoted = input.quoted_amount.unwrap_or(existing.quoted_amount);
        let new_currency = input.currency.unwrap_or(existing.currency);
        let new_code = input.code.unwrap_or(existing.code);
        let new_start = input.start_date.or(existing.start_date);
        let new_target = input.target_completion_date.or(existing.target_completion_date);
        let new_closed = input.closed_date.or(existing.closed_date);
        let new_notes = input.notes.or(existing.notes);

        conn.execute(
            "UPDATE cases SET
                code = ?2, title = ?3, client_name = ?4, client_contact = ?5, stage = ?6,
                quoted_amount = ?7, currency = ?8, proposal_value_base = ?9, start_date = ?10,
                target_completion_date = ?11, closed_date = ?12, notes = ?13, updated_at = ?14
             WHERE id = ?1",
            params![
                id,
                new_code,
                new_title,
                new_client,
                new_contact,
                new_stage,
                new_quoted,
                new_currency,
                new_quoted,
                new_start,
                new_target,
                new_closed,
                new_notes,
                now,
            ],
        )?;

        Self::get_by_id(conn, id)
    }

    pub fn get_by_id(conn: &Connection, id: &str) -> Result<Case, AppError> {
        conn.query_row(
            "SELECT id, code, title, client_name, client_contact, stage, quoted_amount, currency,
                    proposal_value_base, start_date, target_completion_date, closed_date, notes, created_at, updated_at
             FROM cases WHERE id = ?1",
            params![id],
            |row| {
                Ok(Case {
                    id: row.get(0)?,
                    code: row.get(1)?,
                    title: row.get(2)?,
                    client_name: row.get(3)?,
                    client_contact: row.get(4)?,
                    stage: row.get(5)?,
                    quoted_amount: row.get(6)?,
                    currency: row.get(7)?,
                    proposal_value_base: row.get(8)?,
                    start_date: row.get(9)?,
                    target_completion_date: row.get(10)?,
                    closed_date: row.get(11)?,
                    notes: row.get(12)?,
                    created_at: row.get(13)?,
                    updated_at: row.get(14)?,
                })
            },
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound(format!("Case with ID {} not found.", id)))
    }

    pub fn list(conn: &Connection) -> Result<Vec<Case>, AppError> {
        let mut stmt = conn.prepare(
            "SELECT id, code, title, client_name, client_contact, stage, quoted_amount, currency,
                    proposal_value_base, start_date, target_completion_date, closed_date, notes, created_at, updated_at
             FROM cases ORDER BY created_at DESC",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(Case {
                id: row.get(0)?,
                code: row.get(1)?,
                title: row.get(2)?,
                client_name: row.get(3)?,
                client_contact: row.get(4)?,
                stage: row.get(5)?,
                quoted_amount: row.get(6)?,
                currency: row.get(7)?,
                proposal_value_base: row.get(8)?,
                start_date: row.get(9)?,
                target_completion_date: row.get(10)?,
                closed_date: row.get(11)?,
                notes: row.get(12)?,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
            })
        })?;

        let mut result = Vec::new();
        for r in rows {
            result.push(r?);
        }
        Ok(result)
    }

    pub fn get_detail(conn: &Connection, id: &str) -> Result<CaseDetail, AppError> {
        let cs = Self::get_by_id(conn, id)?;

        // Fetch transactions for this case
        let filter = TransactionFilter {
            case_id: Some(id.to_string()),
            ..Default::default()
        };
        let txs = TransactionRepo::list(conn, Some(&filter))?;
        let pnl = calculate_case_pnl(&txs, Some(id));

        // Fetch milestones for this case
        let milestones = MilestoneRepo::list_by_case(conn, id)?;

        // Fetch diary entries for this case
        let diary_entries = JournalRepo::list_by_case(conn, id)?;

        Ok(CaseDetail {
            id: cs.id,
            code: cs.code,
            title: cs.title,
            client_name: cs.client_name,
            client_contact: cs.client_contact,
            stage: cs.stage,
            quoted_amount: cs.quoted_amount,
            currency: cs.currency,
            created_at: cs.created_at,
            updated_at: cs.updated_at,
            realized_income: pnl.realized_income,
            realized_expense: pnl.realized_expense,
            net_margin: pnl.net_margin,
            profit_margin_pct: pnl.profit_margin_pct,
            milestones,
            diary_entries,
        })
    }
}
```

#### File: `src-tauri/src/db/milestones.rs`
```rust
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;
use crate::error::AppError;
use crate::models::{CreateMilestoneInput, Milestone};

pub struct MilestoneRepo;

impl MilestoneRepo {
    pub fn create(conn: &Connection, input: CreateMilestoneInput) -> Result<Milestone, AppError> {
        if input.title.trim().is_empty() {
            return Err(AppError::ValidationError("Milestone title is required.".into()));
        }

        let id = input.id.unwrap_or_else(|| format!("ms-{}", Uuid::new_v4()));
        let description = input.description.unwrap_or_default();
        let due_date = input.due_date.unwrap_or_default();
        let is_completed = if input.completed.unwrap_or(false) { 1 } else { 0 };
        let amount_base = input.amount.unwrap_or(0.0);
        let completed_date = if is_completed != 0 {
            Some(chrono::Utc::now().to_rfc3339())
        } else {
            None
        };
        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO milestones (id, case_id, title, description, due_date, is_completed, amount_base, completed_date, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                id,
                input.case_id,
                input.title,
                description,
                due_date,
                is_completed,
                amount_base,
                completed_date,
                now,
            ],
        )?;

        Self::get_by_id(conn, &id)
    }

    pub fn toggle(conn: &Connection, id: &str, completed: bool) -> Result<Milestone, AppError> {
        let is_completed = if completed { 1 } else { 0 };
        let completed_date = if completed {
            Some(chrono::Utc::now().to_rfc3339())
        } else {
            None
        };

        let rows = conn.execute(
            "UPDATE milestones SET is_completed = ?2, completed_date = ?3 WHERE id = ?1",
            params![id, is_completed, completed_date],
        )?;

        if rows == 0 {
            return Err(AppError::NotFound(format!("Milestone with ID {} not found.", id)));
        }

        Self::get_by_id(conn, id)
    }

    pub fn get_by_id(conn: &Connection, id: &str) -> Result<Milestone, AppError> {
        conn.query_row(
            "SELECT id, case_id, title, description, due_date, is_completed, amount_base, completed_date, created_at
             FROM milestones WHERE id = ?1",
            params![id],
            |row| {
                let is_comp: i64 = row.get(5)?;
                Ok(Milestone {
                    id: row.get(0)?,
                    case_id: row.get(1)?,
                    title: row.get(2)?,
                    description: row.get(3)?,
                    due_date: row.get(4)?,
                    completed: is_comp != 0,
                    amount: row.get(6)?,
                    completed_date: row.get(7)?,
                    created_at: row.get(8)?,
                })
            },
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound(format!("Milestone with ID {} not found.", id)))
    }

    pub fn list_by_case(conn: &Connection, case_id: &str) -> Result<Vec<Milestone>, AppError> {
        let mut stmt = conn.prepare(
            "SELECT id, case_id, title, description, due_date, is_completed, amount_base, completed_date, created_at
             FROM milestones WHERE case_id = ?1 ORDER BY created_at ASC",
        )?;

        let rows = stmt.query_map(params![case_id], |row| {
            let is_comp: i64 = row.get(5)?;
            Ok(Milestone {
                id: row.get(0)?,
                case_id: row.get(1)?,
                title: row.get(2)?,
                description: row.get(3)?,
                due_date: row.get(4)?,
                completed: is_comp != 0,
                amount: row.get(6)?,
                completed_date: row.get(7)?,
                created_at: row.get(8)?,
            })
        })?;

        let mut result = Vec::new();
        for r in rows {
            result.push(r?);
        }
        Ok(result)
    }
}
```

#### File: `src-tauri/src/db/journal.rs`
```rust
use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;
use crate::error::AppError;
use crate::models::{CreateJournalInput, JournalEntry, JournalFilter, UpdateJournalInput};

pub struct JournalRepo;

impl JournalRepo {
    pub fn create(conn: &Connection, input: CreateJournalInput) -> Result<JournalEntry, AppError> {
        if input.content.trim().is_empty() {
            return Err(AppError::ValidationError("Journal entry content cannot be empty.".into()));
        }

        let id = input.id.unwrap_or_else(|| format!("jrn-{}", Uuid::new_v4()));
        let now = chrono::Utc::now().to_rfc3339();
        let date = input.date.unwrap_or_else(|| now[..10].to_string());
        let title = input.title.unwrap_or_default();
        let tags = input.tags.unwrap_or_default();
        let tags_json = serde_json::to_string(&tags).unwrap_or_else(|_| "[]".into());
        let is_starred = if input.is_starred.unwrap_or(false) { 1 } else { 0 };

        conn.execute(
            "INSERT INTO journal_entries (id, date, title, content, case_id, tags_json, is_starred, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                id,
                date,
                title,
                input.content,
                input.case_id,
                tags_json,
                is_starred,
                now,
                now,
            ],
        )?;

        Self::get_by_id(conn, &id)
    }

    pub fn update(conn: &Connection, id: &str, input: UpdateJournalInput) -> Result<JournalEntry, AppError> {
        let existing = Self::get_by_id(conn, id)?;
        let now = chrono::Utc::now().to_rfc3339();

        let new_date = input.date.unwrap_or(existing.date);
        let new_title = input.title.unwrap_or(existing.title);
        let new_content = input.content.unwrap_or(existing.content);
        let new_case_id = match input.case_id {
            Some(opt) => opt,
            None => existing.case_id,
        };
        let new_tags = input.tags.unwrap_or(existing.tags);
        let new_tags_json = serde_json::to_string(&new_tags).unwrap_or_else(|_| "[]".into());
        let new_starred = if input.is_starred.unwrap_or(existing.is_starred) { 1 } else { 0 };

        conn.execute(
            "UPDATE journal_entries SET
                date = ?2, title = ?3, content = ?4, case_id = ?5, tags_json = ?6, is_starred = ?7, updated_at = ?8
             WHERE id = ?1",
            params![
                id,
                new_date,
                new_title,
                new_content,
                new_case_id,
                new_tags_json,
                new_starred,
                now,
            ],
        )?;

        Self::get_by_id(conn, id)
    }

    pub fn get_by_id(conn: &Connection, id: &str) -> Result<JournalEntry, AppError> {
        conn.query_row(
            "SELECT id, date, title, content, case_id, tags_json, is_starred, created_at, updated_at
             FROM journal_entries WHERE id = ?1",
            params![id],
            |row| {
                let tags_str: String = row.get(5)?;
                let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
                let is_star: i64 = row.get(6)?;
                Ok(JournalEntry {
                    id: row.get(0)?,
                    date: row.get(1)?,
                    title: row.get(2)?,
                    content: row.get(3)?,
                    case_id: row.get(4)?,
                    tags,
                    is_starred: is_star != 0,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            },
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound(format!("Journal entry with ID {} not found.", id)))
    }

    pub fn list(conn: &Connection, filter: Option<&JournalFilter>) -> Result<Vec<JournalEntry>, AppError> {
        let f = filter.cloned().unwrap_or_default();
        let mut stmt = conn.prepare(
            "SELECT id, date, title, content, case_id, tags_json, is_starred, created_at, updated_at
             FROM journal_entries
             WHERE (?1 IS NULL OR case_id = ?1)
               AND (?2 IS NULL OR (
                   (title IS NOT NULL AND LOWER(title) LIKE '%' || LOWER(?2) || '%') OR
                   (content IS NOT NULL AND LOWER(content) LIKE '%' || LOWER(?2) || '%')
               ))
             ORDER BY date DESC, created_at DESC",
        )?;

        let rows = stmt.query_map(params![f.case_id, f.search], |row| {
            let tags_str: String = row.get(5)?;
            let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
            let is_star: i64 = row.get(6)?;
            Ok(JournalEntry {
                id: row.get(0)?,
                date: row.get(1)?,
                title: row.get(2)?,
                content: row.get(3)?,
                case_id: row.get(4)?,
                tags,
                is_starred: is_star != 0,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })?;

        let mut result = Vec::new();
        for r in rows {
            let entry = r?;
            if let Some(ref tag_filter) = f.tag {
                if !entry.tags.contains(tag_filter) {
                    continue;
                }
            }
            result.push(entry);
        }
        Ok(result)
    }

    pub fn list_by_case(conn: &Connection, case_id: &str) -> Result<Vec<JournalEntry>, AppError> {
        let filter = JournalFilter {
            case_id: Some(case_id.to_string()),
            ..Default::default()
        };
        Self::list(conn, Some(&filter))
    }
}
```

#### File: `src-tauri/src/db/exchange_rates.rs`
```rust
use rusqlite::{params, Connection, OptionalExtension};
use crate::error::AppError;
use crate::models::ExchangeRate;

pub struct ExchangeRateRepo;

impl ExchangeRateRepo {
    pub fn get_rate(conn: &Connection, currency_code: &str) -> Result<f64, AppError> {
        let base_currency = Self::get_base_currency(conn)?;
        if currency_code.eq_ignore_ascii_case(&base_currency) {
            return Ok(1.0);
        }

        let rate: Option<f64> = conn
            .query_row(
                "SELECT rate_to_base FROM exchange_rates WHERE currency_code = ?1 COLLATE NOCASE",
                params![currency_code],
                |row| row.get(0),
            )
            .optional()?;

        Ok(rate.unwrap_or(1.0))
    }

    pub fn set_rate(conn: &Connection, currency_code: &str, rate: f64) -> Result<(), AppError> {
        if rate <= 0.0 {
            return Err(AppError::ValidationError("Exchange rate must be strictly positive.".into()));
        }
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO exchange_rates (currency_code, rate_to_base, updated_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(currency_code) DO UPDATE SET rate_to_base = ?2, updated_at = ?3",
            params![currency_code.to_uppercase(), rate, now],
        )?;
        Ok(())
    }

    pub fn list(conn: &Connection) -> Result<Vec<ExchangeRate>, AppError> {
        let mut stmt = conn.prepare("SELECT currency_code, rate_to_base, updated_at FROM exchange_rates ORDER BY currency_code ASC")?;
        let rows = stmt.query_map([], |row| {
            Ok(ExchangeRate {
                currency_code: row.get(0)?,
                rate_to_base: row.get(1)?,
                updated_at: row.get(2)?,
            })
        })?;

        let mut result = Vec::new();
        for r in rows {
            result.push(r?);
        }
        Ok(result)
    }

    pub fn get_base_currency(conn: &Connection) -> Result<String, AppError> {
        let base: Option<String> = conn
            .query_row(
                "SELECT value FROM app_settings WHERE key = 'base_currency'",
                [],
                |row| row.get(0),
            )
            .optional()?;
        Ok(base.unwrap_or_else(|| "USD".into()))
    }

    pub fn set_base_currency(conn: &Connection, base_currency: &str) -> Result<(), AppError> {
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO app_settings (key, value, updated_at) VALUES ('base_currency', ?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = ?1, updated_at = ?2",
            params![base_currency.to_uppercase(), now],
        )?;
        Ok(())
    }
}
```

#### File: `src-tauri/src/db/mod.rs`
```rust
pub mod connection;
pub mod migrations;
pub mod schema;
pub mod transactions;
pub mod categories;
pub mod cases;
pub mod milestones;
pub mod journal;
pub mod exchange_rates;

pub use connection::DatabaseManager;
pub use migrations::MigrationManager;
pub use schema::INITIAL_SCHEMA_SQL;
pub use transactions::TransactionRepo;
pub use categories::CategoryRepo;
pub use cases::CaseRepo;
pub use milestones::MilestoneRepo;
pub use journal::JournalRepo;
pub use exchange_rates::ExchangeRateRepo;
```

---

### 3.3 Deterministic Financial Analytics Engines (`src-tauri/src/analytics/`)

#### File: `src-tauri/src/analytics/pnl.rs`
```rust
use crate::models::{CasePnLResult, Transaction};
use super::round2;

/// Calculates realized income, expense, net margin, and profit margin percentage.
/// Only CLEARED and PAID transactions are considered realized.
pub fn calculate_case_pnl(transactions: &[Transaction], case_id: Option<&str>) -> CasePnLResult {
    let mut realized_income = 0.0;
    let mut realized_expense = 0.0;

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
                realized_income += amount;
            } else if tx.r#type.eq_ignore_ascii_case("EXPENSE") {
                realized_expense += amount;
            }
        }
    }

    realized_income = round2(realized_income);
    realized_expense = round2(realized_expense);
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
```

#### File: `src-tauri/src/analytics/win_rate.rs`
```rust
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
```

#### File: `src-tauri/src/analytics/equity_curve.rs`
use std::collections::BTreeMap;
use chrono::{DateTime, Utc, Duration, NaiveDate};
use crate::models::{EquityCurvePoint, Transaction};
use super::round2;

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
        match s.map(|v| v.to_uppercase()).as_deref() {
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

    // 1. Group realized transactions by date YYYY-MM-DD
    let mut daily_map: BTreeMap<String, DayVolume> = BTreeMap::new();

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

        let entry = daily_map.entry(date_key).or_insert(DayVolume { income: 0.0, expense: 0.0 });
        if tx.r#type.eq_ignore_ascii_case("INCOME") {
            entry.income += tx.base_amount;
        } else if tx.r#type.eq_ignore_ascii_case("EXPENSE") {
            entry.expense += tx.base_amount;
        }
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
            (Some(_), None) => true, // Fallback if non-standard date
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
```

#### File: `src-tauri/src/analytics/ar_aging.rs`
```rust
use chrono::{DateTime, NaiveDate, Utc};
use crate::models::{ARAgingSummary, Transaction};
use super::round2;

/// Calculates the 4-bucket Accounts Receivable aging schedule for outstanding INCOME transactions.
pub fn calculate_ar_aging(
    transactions: &[Transaction],
    reference_date: Option<DateTime<Utc>>,
) -> ARAgingSummary {
    let ref_date = reference_date.unwrap_or_else(Utc::now).date_naive();

    let mut current_0_30 = 0.0;
    let mut pending_31_60 = 0.0;
    let mut overdue_61_90 = 0.0;
    let mut critical_90_plus = 0.0;

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

        let amount = tx.base_amount;

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

    current_0_30 = round2(current_0_30);
    pending_31_60 = round2(pending_31_60);
    overdue_61_90 = round2(overdue_61_90);
    critical_90_plus = round2(critical_90_plus);

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
```

#### File: `src-tauri/src/analytics/dashboard.rs`
```rust
use crate::models::{Case, DashboardMetrics, Transaction};
use super::pnl::calculate_case_pnl;
use super::win_rate::calculate_win_rate;
use super::round2;

/// Aggregates all KPI metrics for the Executive Dashboard.
pub fn calculate_dashboard_metrics(
    transactions: &[Transaction],
    cases: &[Case],
    base_currency: &str,
) -> DashboardMetrics {
    let pnl = calculate_case_pnl(transactions, None);
    let proposal_win_rate = calculate_win_rate(cases);

    // Invoiced Volume: Sum of quoted_amount for ACTIVE, COMPLETED, QUOTATION cases + INVOICED income txs
    let mut invoiced_volume = 0.0;
    for c in cases {
        let stage = c.stage.to_uppercase();
        if stage == "ACTIVE" || stage == "COMPLETED" || stage == "QUOTATION" {
            invoiced_volume += c.quoted_amount;
        }
    }
    for tx in transactions {
        if tx.r#type.eq_ignore_ascii_case("INCOME") && tx.status.eq_ignore_ascii_case("INVOICED") {
            invoiced_volume += tx.base_amount;
        }
    }
    invoiced_volume = round2(invoiced_volume);

    // Average Ticket Size: Mean quoted amount of COMPLETED cases
    let completed_cases: Vec<&Case> = cases
        .iter()
        .filter(|c| c.stage.eq_ignore_ascii_case("COMPLETED"))
        .collect();

    let avg_ticket_size = if !completed_cases.is_empty() {
        let total_ticket: f64 = completed_cases.iter().map(|c| c.quoted_amount).sum();
        round2(total_ticket / completed_cases.len() as f64)
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
```

#### File: `src-tauri/src/analytics/mod.rs`
```rust
pub mod pnl;
pub mod equity_curve;
pub mod win_rate;
pub mod dashboard;
pub mod ar_aging;

pub use pnl::calculate_case_pnl;
pub use equity_curve::{calculate_equity_curve, Timeframe};
pub use win_rate::calculate_win_rate;
pub use dashboard::calculate_dashboard_metrics;
pub use ar_aging::calculate_ar_aging;

#[inline]
pub fn round2(val: f64) -> f64 {
    let r = (val * 100.0).round() / 100.0;
    if r == 0.0 {
        0.0
    } else {
        r
    }
}
```

---

### 3.4 Tauri IPC Command Handlers (`src-tauri/src/commands/`)

#### File: `src-tauri/src/commands/transaction_cmd.rs`
```rust
use tauri::State;
use crate::db::{CategoryRepo, TransactionRepo};
use crate::error::AppError;
use crate::models::{Category, CreateTransactionInput, Transaction, TransactionFilter, UpdateTransactionInput};
use crate::state::VaultState;

#[tauri::command]
pub async fn transaction_create(
    state: State<'_, VaultState>,
    input: CreateTransactionInput,
) -> Result<Transaction, AppError> {
    state.with_connection(move |conn| TransactionRepo::create(conn, input)).await
}

#[tauri::command]
pub async fn transaction_update(
    state: State<'_, VaultState>,
    id: String,
    input: UpdateTransactionInput,
) -> Result<Transaction, AppError> {
    state.with_connection(move |conn| TransactionRepo::update(conn, &id, input)).await
}

#[tauri::command]
pub async fn transaction_delete(
    state: State<'_, VaultState>,
    id: String,
) -> Result<(), AppError> {
    state.with_connection(move |conn| TransactionRepo::delete(conn, &id)).await
}

#[tauri::command]
pub async fn transaction_list(
    state: State<'_, VaultState>,
    filter: Option<TransactionFilter>,
) -> Result<Vec<Transaction>, AppError> {
    state.with_connection(move |conn| TransactionRepo::list(conn, filter.as_ref())).await
}

#[tauri::command]
pub async fn category_list(
    state: State<'_, VaultState>,
) -> Result<Vec<Category>, AppError> {
    state.with_connection(|conn| CategoryRepo::list(conn)).await
}
```

#### File: `src-tauri/src/commands/case_cmd.rs`
```rust
use tauri::State;
use crate::db::{CaseRepo, MilestoneRepo};
use crate::error::AppError;
use crate::models::{Case, CaseDetail, CreateCaseInput, CreateMilestoneInput, Milestone, UpdateCaseInput};
use crate::state::VaultState;

#[tauri::command]
pub async fn case_create(
    state: State<'_, VaultState>,
    input: CreateCaseInput,
) -> Result<Case, AppError> {
    state.with_connection(move |conn| CaseRepo::create(conn, input)).await
}

#[tauri::command]
pub async fn case_update(
    state: State<'_, VaultState>,
    id: String,
    input: UpdateCaseInput,
) -> Result<Case, AppError> {
    state.with_connection(move |conn| CaseRepo::update(conn, &id, input)).await
}

#[tauri::command]
pub async fn case_list(
    state: State<'_, VaultState>,
) -> Result<Vec<Case>, AppError> {
    state.with_connection(|conn| CaseRepo::list(conn)).await
}

#[tauri::command]
pub async fn case_get_detail(
    state: State<'_, VaultState>,
    id: String,
) -> Result<CaseDetail, AppError> {
    state.with_connection(move |conn| CaseRepo::get_detail(conn, &id)).await
}

#[tauri::command]
pub async fn milestone_create(
    state: State<'_, VaultState>,
    input: CreateMilestoneInput,
) -> Result<Milestone, AppError> {
    state.with_connection(move |conn| MilestoneRepo::create(conn, input)).await
}

#[tauri::command]
pub async fn milestone_toggle(
    state: State<'_, VaultState>,
    id: String,
    completed: bool,
) -> Result<Milestone, AppError> {
    state.with_connection(move |conn| MilestoneRepo::toggle(conn, &id, completed)).await
}
```

#### File: `src-tauri/src/commands/journal_cmd.rs`
```rust
use tauri::State;
use crate::db::JournalRepo;
use crate::error::AppError;
use crate::models::{CreateJournalInput, JournalEntry, JournalFilter, UpdateJournalInput};
use crate::state::VaultState;

#[tauri::command]
pub async fn journal_create(
    state: State<'_, VaultState>,
    input: CreateJournalInput,
) -> Result<JournalEntry, AppError> {
    state.with_connection(move |conn| JournalRepo::create(conn, input)).await
}

#[tauri::command]
pub async fn journal_update(
    state: State<'_, VaultState>,
    id: String,
    input: UpdateJournalInput,
) -> Result<JournalEntry, AppError> {
    state.with_connection(move |conn| JournalRepo::update(conn, &id, input)).await
}

#[tauri::command]
pub async fn journal_list(
    state: State<'_, VaultState>,
    filter: Option<JournalFilter>,
) -> Result<Vec<JournalEntry>, AppError> {
    state.with_connection(move |conn| JournalRepo::list(conn, filter.as_ref())).await
}
```

#### File: `src-tauri/src/commands/analytics_cmd.rs`
```rust
use tauri::State;
use crate::analytics::{calculate_ar_aging, calculate_dashboard_metrics, calculate_equity_curve, Timeframe};
use crate::db::{CaseRepo, ExchangeRateRepo, TransactionRepo};
use crate::error::AppError;
use crate::models::{ARAgingSummary, DashboardMetrics, EquityCurvePoint};
use crate::state::VaultState;

#[tauri::command]
pub async fn analytics_get_dashboard(
    state: State<'_, VaultState>,
) -> Result<DashboardMetrics, AppError> {
    state.with_connection(|conn| {
        let txs = TransactionRepo::list(conn, None)?;
        let cases = CaseRepo::list(conn)?;
        let base_currency = ExchangeRateRepo::get_base_currency(conn)?;
        Ok(calculate_dashboard_metrics(&txs, &cases, &base_currency))
    }).await
}

#[tauri::command]
pub async fn analytics_get_equity_curve(
    state: State<'_, VaultState>,
    timeframe: Option<String>,
) -> Result<Vec<EquityCurvePoint>, AppError> {
    state.with_connection(move |conn| {
        let txs = TransactionRepo::list(conn, None)?;
        let tf = Timeframe::parse(timeframe.as_deref());
        Ok(calculate_equity_curve(&txs, tf, None))
    }).await
}

#[tauri::command]
pub async fn analytics_get_ar_aging(
    state: State<'_, VaultState>,
) -> Result<ARAgingSummary, AppError> {
    state.with_connection(|conn| {
        let txs = TransactionRepo::list(conn, None)?;
        Ok(calculate_ar_aging(&txs, None))
    }).await
}
```

#### File: `src-tauri/src/commands/mod.rs`
```rust
pub mod auth_cmd;
pub mod transaction_cmd;
pub mod case_cmd;
pub mod journal_cmd;
pub mod analytics_cmd;

pub use auth_cmd::*;
pub use transaction_cmd::*;
pub use case_cmd::*;
pub use journal_cmd::*;
pub use analytics_cmd::*;
```

#### Updates to `src-tauri/src/lib.rs`
Register all new commands in the `invoke_handler`:
```rust
        .invoke_handler(tauri::generate_handler![
            // Auth & Vault
            vault_get_status,
            vault_setup,
            vault_unlock,
            vault_unlock_biometric,
            vault_lock,
            vault_touch,
            // Transactions & Categories
            transaction_create,
            transaction_update,
            transaction_delete,
            transaction_list,
            category_list,
            // Cases & Milestones
            case_create,
            case_update,
            case_list,
            case_get_detail,
            milestone_create,
            milestone_toggle,
            // Journal
            journal_create,
            journal_update,
            journal_list,
            // Analytics
            analytics_get_dashboard,
            analytics_get_equity_curve,
            analytics_get_ar_aging,
        ])
```

---

## 4. Edge Cases & Invariant Verification Matrix

| Scenario / Invariant | Behavior & Handling | Verification Oracle Formula |
|----------------------|---------------------|-----------------------------|
| **Zero Division in Win Rate** | When 0 closed cases exist (or only Leads/Active/Quotations exist), returns `0.0`. | `closedCases.length === 0 ? 0.0 : (won / closed) * 100` |
| **Negative Net Margin (Drawdown)** | Correctly calculates negative PnL and Equity Curve points (e.g. income 5k, expense 7k $\to$ net -2k). | `profit_margin_pct = realized_income > 0 ? ((net / income) * 100) : 0.0` |
| **Zero Income with Expenses** | When realized income is 0.0 and expense > 0, profit margin % returns `0.0` (not NaN or $-\infty$). | `profit_margin_pct = 0.0` |
| **Multi-Currency Base Amount Rounding** | Base amount = `round2(amount * exchange_rate)`. Negative or zero FX rates are rejected with `ValidationError`. | `round2(tx.amount * tx.exchange_rate)` |
| **Equity Curve Timeframe Baseline** | Timeframe filters (`1M`, `3M`, etc.) slice after accumulating full history. Running cumulative equity preserves prior historical baseline. | Cumulative calculation precedes date cutoff slice |
| **4-Bucket AR Aging Calculation** | Age = $\max(0, \lfloor(\text{ref} - \text{tx}) / 86400000\rfloor)$. Buckets: $[0, 30]$, $[31, 60]$, $[61, 90]$, $[91, \infty)$. | Days calculated with leap-year aware `NaiveDate` |
| **AR Aging Traffic Light** | RED if `critical_90_plus > 0`, YELLOW if `overdue_61_90 > 0`, otherwise GREEN. | Strict priority order check |
| **Invoiced Volume Aggregation** | Sum of `quoted_amount` for cases in `('ACTIVE', 'COMPLETED', 'QUOTATION')` plus base amount of `INCOME` transactions in `INVOICED` status. | Combined case pipeline and blotter receivable volume |
| **Empty Database Queries** | Returns empty arrays or zeroed metric structs without throwing database or arithmetic exceptions. | Guard clauses on empty dataset inputs |

---

## 5. Caveats

1. **Vault State Lock Lifecycle**: All repository queries require an active decrypted SQLCipher connection via `VaultState.with_connection(...)`. If the vault is locked or timed out due to inactivity, operations return `AppError::VaultLocked` or `AppError::SessionLocked`.
2. **Export Module Wiring**: Backup (`.vault`), CSV, and Excel export commands are scheduled for Milestone 4; Milestone 2 provides full database and calculation readiness for them.
3. **No Unmanaged Frontend Stubs**: All data types in Rust serialize strictly to the JSON contract defined in `PROJECT.md §Interface Contracts`.

---

## 6. Conclusion

Milestone 2 delivers the complete relational data infrastructure and financial calculation core for ApexJournal. The architecture features:
1. Complete Rust domain models in `src-tauri/src/models/` (`transaction.rs`, `case_model.rs`, `journal.rs`, `analytics.rs`).
2. High-performance SQLCipher CRUD operations with joins, filtering, and indexing in `src-tauri/src/db/`.
3. 100% deterministic analytics engines matching `oracle.js` in `src-tauri/src/analytics/` (`pnl.rs`, `equity_curve.rs`, `win_rate.rs`, `dashboard.rs`, `ar_aging.rs`).
4. Robust Tauri v2 IPC handlers in `src-tauri/src/commands/`.

---

## 7. Verification Method

To independently verify the implementation:

1. **Rust Unit & Integration Test Suite**:
   ```bash
   cd /Users/nuevo/apex_journal/src-tauri
   cargo test
   ```
   Must compile cleanly and pass all unit tests for models, database migrations, CRUD repositories, and deterministic analytics calculations.

2. **Full 4-Tier E2E Test Suite**:
   ```bash
   cd /Users/nuevo/apex_journal/tests
   node runner.js --tier=1
   node runner.js --tier=2
   node runner.js --tier=3
   node runner.js --tier=4
   ```
   Or execute the complete runner:
   ```bash
   node /Users/nuevo/apex_journal/tests/runner.js
   ```
   All tests in Tier 1 (Features 06–11), Tier 2 (Boundaries 01–04), Tier 3 (Pairwise 01–05), and Tier 4 (Workloads 01–05) must report 100% GREEN status.
