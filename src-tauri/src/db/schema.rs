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
