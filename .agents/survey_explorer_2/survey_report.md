# ApexJournal — Relational Data Model & Financial Analytics Engine Specification

**Author**: Survey Explorer 2  
**Date**: 2026-08-30  
**Status**: Authoritative Technical Specification  
**Target Architecture**: Tauri v2 + Rust + SQLCipher / Rusqlite + React / TypeScript

---

## 1. Executive Summary & Design Principles

ApexJournal is an AES-256 encrypted desktop operating and financial journal designed for consulting practitioners and boutique agencies. To deliver professional-grade trading journal analytics alongside case operations, the data model and calculation engine must adhere to four strict principles:

1. **Strict Mathematical Determinism**: All multi-currency conversions, case PnL aggregates, cumulative equity series, and aging buckets must yield identical, reproducible results down to the exact cent across platforms.
2. **Fixed-Point / Integer Financial Representation**: Monetary values are stored and calculated with integer precision (cents / micro-units) or validated IEEE-754 decimal rounding rules to eliminate floating-point drift.
3. **Referential Integrity & Auditability**: Enforced relational constraints (foreign keys, cascading rules, unique indexes, and audit logging) within an embedded SQLCipher database encrypted at rest.
4. **Resilient Data Portability**: Secure `.vault` encrypted backup containers with cryptographic integrity checks and full-fidelity CSV / Excel multi-sheet reporting.

---

## 2. Complete SQLCipher Relational Schema Specification

### 2.1 Pragmas & Database Initialization

```sql
-- Enforce referential constraints and WAL mode for high concurrency
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA auto_vacuum = INCREMENTAL;
PRAGMA temp_store = MEMORY;
```

### 2.2 Table Definitions (DDL)

```sql
-- -----------------------------------------------------------------------------
-- 1. App Settings & Global State
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

-- Default settings seed
INSERT OR IGNORE INTO app_settings (key, value, description) VALUES
('base_currency', 'USD', 'Primary consolidation currency for PnL and Equity Curve'),
('auto_lock_minutes', '15', 'Minutes of inactivity before locking the vault'),
('date_format', 'YYYY-MM-DD', 'Default date display format'),
('theme', 'dark_obsidian', 'Active UI theme identifier');

-- -----------------------------------------------------------------------------
-- 2. Currencies & Historical Exchange Rates
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS currencies (
    code TEXT PRIMARY KEY NOT NULL,          -- ISO 4217 (e.g. 'USD', 'EUR', 'GBP')
    name TEXT NOT NULL,                      -- e.g. 'US Dollar', 'Euro'
    symbol TEXT NOT NULL,                    -- e.g. '$', '€', '£', '¥'
    decimal_places INTEGER NOT NULL DEFAULT 2,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

-- Standard Currencies Seed
INSERT OR IGNORE INTO currencies (code, name, symbol, decimal_places) VALUES
('USD', 'US Dollar', '$', 2),
('EUR', 'Euro', '€', 2),
('GBP', 'British Pound', '£', 2),
('CAD', 'Canadian Dollar', 'CA$', 2),
('AUD', 'Australian Dollar', 'A$', 2),
('CHF', 'Swiss Franc', 'CHF', 2),
('JPY', 'Japanese Yen', '¥', 0),
('MXN', 'Mexican Peso', 'Mex$', 2);

CREATE TABLE IF NOT EXISTS exchange_rates (
    id TEXT PRIMARY KEY NOT NULL,            -- UUID v4
    from_currency TEXT NOT NULL REFERENCES currencies(code) ON UPDATE CASCADE,
    to_currency TEXT NOT NULL REFERENCES currencies(code) ON UPDATE CASCADE,
    rate REAL NOT NULL CHECK(rate > 0),       -- Multiplier: 1 Unit From = Rate Units To
    effective_date TEXT NOT NULL,            -- ISO 8601 YYYY-MM-DD
    source TEXT NOT NULL DEFAULT 'manual',   -- 'manual', 'sync', 'ecb', 'initial'
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    UNIQUE(from_currency, to_currency, effective_date)
);

CREATE INDEX IF NOT EXISTS idx_rates_lookup 
ON exchange_rates(from_currency, to_currency, effective_date DESC);

-- -----------------------------------------------------------------------------
-- 3. Predefined Business Categories
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY NOT NULL,            -- UUID v4
    code TEXT UNIQUE NOT NULL,               -- e.g. 'consulting_revenue'
    name TEXT NOT NULL,                      -- e.g. 'Consulting Services'
    type TEXT NOT NULL CHECK(type IN ('INCOME', 'EXPENSE')),
    color_token TEXT NOT NULL DEFAULT 'accent', -- 'emerald', 'purple', 'rose', etc.
    icon_name TEXT NOT NULL DEFAULT 'Briefcase',
    is_system INTEGER NOT NULL DEFAULT 1,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

-- Seed Strict Predefined Categories
INSERT OR IGNORE INTO categories (id, code, name, type, color_token, icon_name, is_system) VALUES
-- Income
('cat-inc-01', 'consulting_revenue', 'Consulting & Advisory', 'INCOME', 'emerald', 'Briefcase', 1),
('cat-inc-02', 'retainer_revenue', 'Monthly Retainer', 'INCOME', 'emerald', 'Repeat', 1),
('cat-inc-03', 'milestone_revenue', 'Project Milestone Deliverable', 'INCOME', 'emerald', 'CheckCircle2', 1),
('cat-inc-04', 'success_fee', 'Success / Performance Fee', 'INCOME', 'emerald', 'Trophy', 1),
('cat-inc-05', 'other_income', 'Other Operating Income', 'INCOME', 'emerald', 'DollarSign', 1),
-- Expenses
('cat-exp-01', 'subcontractor_freelance', 'Subcontracting & Freelancers', 'EXPENSE', 'rose', 'Users', 1),
('cat-exp-02', 'software_saas', 'Software & SaaS Tools', 'EXPENSE', 'rose', 'Cpu', 1),
('cat-exp-03', 'cloud_infrastructure', 'Cloud & Hosting Infrastructure', 'EXPENSE', 'rose', 'Server', 1),
('cat-exp-04', 'equipment_hardware', 'Equipment & Hardware', 'EXPENSE', 'rose', 'Laptop', 1),
('cat-exp-05', 'travel_client_meals', 'Travel & Client Entertainment', 'EXPENSE', 'rose', 'Plane', 1),
('cat-exp-06', 'legal_accounting', 'Legal & Accounting', 'EXPENSE', 'rose', 'Scale', 1),
('cat-exp-07', 'marketing_advertising', 'Marketing & Advertising', 'EXPENSE', 'rose', 'Megaphone', 1),
('cat-exp-08', 'office_workspace', 'Office & Workspace', 'EXPENSE', 'rose', 'Building', 1),
('cat-exp-09', 'taxes_statutory', 'Taxes & Statutory Dues', 'EXPENSE', 'rose', 'Receipt', 1),
('cat-exp-10', 'bank_processing_fees', 'Bank & Gateway Processing Fees', 'EXPENSE', 'rose', 'CreditCard', 1),
('cat-exp-11', 'other_expense', 'Miscellaneous Expense', 'EXPENSE', 'rose', 'MoreHorizontal', 1);

-- -----------------------------------------------------------------------------
-- 4. Case Pipeline (Projects & CRM Lifecycle)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS cases (
    id TEXT PRIMARY KEY NOT NULL,            -- UUID v4
    case_number TEXT UNIQUE NOT NULL,        -- e.g. 'CASE-2026-001'
    title TEXT NOT NULL,
    client_name TEXT NOT NULL,
    client_company TEXT,
    client_email TEXT,
    stage TEXT NOT NULL CHECK(stage IN ('lead', 'quotation', 'active', 'completed', 'lost')),
    currency TEXT NOT NULL REFERENCES currencies(code) ON UPDATE CASCADE,
    proposal_value REAL NOT NULL DEFAULT 0.0 CHECK(proposal_value >= 0),
    estimated_cost REAL NOT NULL DEFAULT 0.0 CHECK(estimated_cost >= 0),
    win_probability INTEGER NOT NULL DEFAULT 50 CHECK(win_probability BETWEEN 0 AND 100),
    lead_date TEXT NOT NULL,                 -- YYYY-MM-DD
    quotation_date TEXT,                     -- YYYY-MM-DD
    start_date TEXT,                         -- YYYY-MM-DD
    target_completion_date TEXT,             -- YYYY-MM-DD
    closed_date TEXT,                        -- YYYY-MM-DD
    loss_reason TEXT,                        -- 'budget', 'timeline', 'competitor', 'scope_pivot', 'other'
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

CREATE INDEX IF NOT EXISTS idx_cases_stage ON cases(stage);
CREATE INDEX IF NOT EXISTS idx_cases_client ON cases(client_name);
CREATE INDEX IF NOT EXISTS idx_cases_dates ON cases(lead_date, quotation_date, closed_date);

-- Case Milestones
CREATE TABLE IF NOT EXISTS case_milestones (
    id TEXT PRIMARY KEY NOT NULL,            -- UUID v4
    case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    due_date TEXT NOT NULL,                  -- YYYY-MM-DD
    amount REAL NOT NULL DEFAULT 0.0,        -- Amount in Case currency
    currency TEXT NOT NULL REFERENCES currencies(code) ON UPDATE CASCADE,
    status TEXT NOT NULL CHECK(status IN ('pending', 'in_progress', 'completed', 'invoiced', 'paid')),
    completed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

CREATE INDEX IF NOT EXISTS idx_milestones_case ON case_milestones(case_id, due_date);

-- -----------------------------------------------------------------------------
-- 5. Financial Blotter (Transactions / Libro Diario)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS transactions (
    id TEXT PRIMARY KEY NOT NULL,            -- UUID v4
    transaction_number TEXT UNIQUE NOT NULL, -- e.g. 'TX-2026-0001'
    transaction_date TEXT NOT NULL,          -- YYYY-MM-DD
    type TEXT NOT NULL CHECK(type IN ('INCOME', 'EXPENSE')),
    category_id TEXT NOT NULL REFERENCES categories(id),
    case_id TEXT REFERENCES cases(id) ON DELETE SET NULL,
    client_vendor TEXT NOT NULL,
    description TEXT NOT NULL,
    amount REAL NOT NULL CHECK(amount > 0),  -- Original currency amount
    currency TEXT NOT NULL REFERENCES currencies(code) ON UPDATE CASCADE,
    exchange_rate REAL NOT NULL DEFAULT 1.0 CHECK(exchange_rate > 0), -- 1 Unit Currency = exchange_rate Base Currency
    base_amount REAL NOT NULL,               -- Calculated: round(amount * exchange_rate, 2)
    status TEXT NOT NULL CHECK(status IN ('pending', 'invoiced', 'cleared', 'paid', 'cancelled')),
    invoice_ref TEXT,                        -- e.g. 'INV-2026-042'
    invoice_issue_date TEXT,                 -- YYYY-MM-DD
    invoice_due_date TEXT,                   -- YYYY-MM-DD
    cleared_date TEXT,                       -- YYYY-MM-DD
    payment_method TEXT DEFAULT 'bank_transfer' CHECK(payment_method IN ('bank_transfer', 'stripe', 'credit_card', 'wire', 'cash', 'crypto', 'other')),
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_tx_case_id ON transactions(case_id);
CREATE INDEX IF NOT EXISTS idx_tx_category ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_tx_status ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_tx_ar ON transactions(type, status, invoice_due_date);

-- -----------------------------------------------------------------------------
-- 6. Operations Journal (Rich Diary Feed)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS journal_entries (
    id TEXT PRIMARY KEY NOT NULL,            -- UUID v4
    title TEXT NOT NULL,
    entry_date TEXT NOT NULL,                -- ISO 8601 timestamp YYYY-MM-DDTHH:MM:SSZ
    case_id TEXT REFERENCES cases(id) ON DELETE SET NULL,
    content_markdown TEXT NOT NULL,
    is_pinned INTEGER NOT NULL DEFAULT 0 CHECK(is_pinned IN (0, 1)),
    word_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now', 'utc')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);

CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(entry_date DESC);
CREATE INDEX IF NOT EXISTS idx_journal_case ON journal_entries(case_id);

CREATE TABLE IF NOT EXISTS tags (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT UNIQUE NOT NULL,
    color TEXT NOT NULL DEFAULT '#8B5CF6'
);

CREATE TABLE IF NOT EXISTS journal_entry_tags (
    entry_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    tag_id TEXT NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY(entry_id, tag_id)
);

-- -----------------------------------------------------------------------------
-- 7. Audit Logging & State Tracking
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_trail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('INSERT', 'UPDATE', 'DELETE')),
    changes_json TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now', 'utc'))
);
```

---

## 3. Deterministic Financial Analytics Engine: Mathematical Specifications

### 3.1 Multi-Currency Rate Resolution & Base Consolidation

Let $C_{base}$ denote the active base currency configured in `app_settings` (default `'USD'`).  
Let $T$ be a financial movement with amount $A$, currency $C_{tx}$, and transaction date $D$.

#### Mathematical Formulation:
1. **Direct Rate Lookup**:
   $$R_{direct} = \text{exchange\_rates}(from = C_{tx}, to = C_{base}, date = D)$$
2. **Fallback to Nearest Preceding Rate**:
   If no rate exists on date $D$:
   $$R_{direct} = \text{exchange\_rates}(from = C_{tx}, to = C_{base}, date \le D \text{ ORDER BY } date \text{ DESC LIMIT 1})$$
3. **Inverse Rate Fallback**:
   If only the inverse pair $(C_{base} \to C_{tx})$ exists with rate $R_{inv}$:
   $$R_{direct} = \frac{1.0}{R_{inv}}$$
4. **Base Amount Calculation & Rounding Rule**:
   $$\text{Base Amount} = \frac{\text{round}\left(A \times R_{direct} \times 100\right)}{100}$$
   All internal math maintains 4 decimal places for rates ($10^{-4}$) and rounds intermediate currency multiplications to 2 decimal places using standard half-up tie-breaking (`f64::round` or integer cent arithmetic).

---

### 3.2 Case PnL (Net Margin & Profitability)

For any case $c \in \text{Cases}$:

$$\begin{aligned}
\text{Income}_{realized}(c) &= \sum_{t \in T(c), t.type = \text{INCOME}, t.status \in \{\text{cleared}, \text{paid}\}} t.base\_amount \\
\text{Income}_{invoiced}(c) &= \sum_{t \in T(c), t.type = \text{INCOME}, t.status \in \{\text{invoiced}, \text{cleared}, \text{paid}\}} t.base\_amount \\
\text{Expenses}_{total}(c) &= \sum_{t \in T(c), t.type = \text{EXPENSE}, t.status \ne \text{cancelled}} t.base\_amount \\
\text{Net Margin (Realized PnL)} &= \text{Income}_{realized}(c) - \text{Expenses}_{total}(c) \\
\text{Net Margin (Invoiced PnL)} &= \text{Income}_{invoiced}(c) - \text{Expenses}_{total}(c)
\end{aligned}$$

#### Profit Margin Percentage:
$$\text{Margin \%}(c) = \begin{cases}
\left(\frac{\text{Income}_{invoiced}(c) - \text{Expenses}_{total}(c)}{\text{Income}_{invoiced}(c)}\right) \times 100 & \text{if } \text{Income}_{invoiced}(c) > 0 \\
0.0\% & \text{if } \text{Income}_{invoiced}(c) = 0 \text{ and } \text{Expenses}_{total}(c) = 0 \\
-100.0\% & \text{if } \text{Income}_{invoiced}(c) = 0 \text{ and } \text{Expenses}_{total}(c) > 0
\end{cases}$$

#### Variance to Proposal Quoted:
$$\text{Quoted Value}_{base}(c) = \text{case.proposal\_value} \times R(\text{case.currency} \to C_{base}, \text{case.quotation\_date})$$
$$\text{Revenue Realization Delta} = \text{Income}_{invoiced}(c) - \text{Quoted Value}_{base}(c)$$

---

### 3.3 Running Cumulative Equity Curve & Timeframe Windows

The Equity Curve visualizes net cumulative operational capital growth over time.

#### Mathematical Definition:
Let $\{d_1, d_2, \dots, d_n\}$ be the sequence of all continuous calendar days spanning the selected evaluation window.

1. **Daily Net Cash Flow**:
   $$\Delta E(d) = \sum_{\substack{t \in T \\ t.date = d \\ t.type = \text{INCOME} \\ t.status \in \{\text{cleared}, \text{paid}\}}} t.base\_amount - \sum_{\substack{t \in T \\ t.date = d \\ t.type = \text{EXPENSE} \\ t.status \in \{\text{cleared}, \text{paid}\}}} t.base\_amount$$

2. **Cumulative Equity Series**:
   $$E(d_k) = E_0 + \sum_{i=1}^k \Delta E(d_i)$$
   Where $E_0$ is the baseline equity before day $d_1$ (accumulated from all prior transactions $t.date < d_1$).

3. **Timeframe Filter Selectors**:
   - `1W`: $D_{end} = \text{Today}, D_{start} = \text{Today} - 7\text{ days}$ (7 daily plot points).
   - `1M`: $D_{end} = \text{Today}, D_{start} = \text{Today} - 30\text{ days}$ (30 daily plot points).
   - `3M`: $D_{end} = \text{Today}, D_{start} = \text{Today} - 90\text{ days}$ (90 daily plot points).
   - `1Y`: $D_{end} = \text{Today}, D_{start} = \text{Today} - 365\text{ days}$ (52 weekly or 365 daily points).
   - `ALL`: $D_{start} = \min(t.transaction\_date), D_{end} = \text{Today}$.

4. **Monthly PnL Volume Bars**:
   For calendar month $m = \text{YYYY-MM}$:
   $$\begin{aligned}
   \text{Monthly Income}(m) &= \sum_{t \in T(m), t.type = \text{INCOME}} t.base\_amount \\
   \text{Monthly Expense}(m) &= \sum_{t \in T(m), t.type = \text{EXPENSE}} t.base\_amount \\
   \text{Monthly Net PnL}(m) &= \text{Monthly Income}(m) - \text{Monthly Expense}(m)
   \end{aligned}$$

---

### 3.4 Executive Performance Metrics

1. **Proposal Win Rate**:
   A proposal is classified as *decided/closed* once it enters `active`, `completed`, or `lost`.
   $$\begin{aligned}
   C_{won} &= \{ c \in \text{Cases} \mid c.stage \in \{\text{active}, \text{completed}\} \land c.quotation\_date \ne \text{NULL} \} \\
   C_{lost} &= \{ c \in \text{Cases} \mid c.stage = \text{lost} \land c.quotation\_date \ne \text{NULL} \} \\
   \text{Win Rate}_{\text{count}} &= \begin{cases}
   \left( \frac{|C_{won}|}{|C_{won}| + |C_{lost}|} \right) \times 100 & \text{if } (|C_{won}| + |C_{lost}|) > 0 \\
   0.0\% & \text{otherwise}
   \end{cases}
   \end{aligned}$$

   *Value-Weighted Win Rate (Dollar-Weighted)*:
   $$\text{Win Rate}_{\text{value}} = \frac{\sum_{c \in C_{won}} \text{Quoted Value}_{base}(c)}{\sum_{c \in C_{won}} \text{Quoted Value}_{base}(c) + \sum_{c \in C_{lost}} \text{Quoted Value}_{base}(c)} \times 100$$

2. **Average Ticket Size**:
   $$\text{Avg Ticket} = \begin{cases}
   \frac{\sum_{c \in C_{won}} \text{Quoted Value}_{base}(c)}{|C_{won}|} & \text{if } |C_{won}| > 0 \\
   0.0 & \text{otherwise}
   \end{cases}$$

3. **Realized vs. Invoiced Volume**:
   $$\begin{aligned}
   V_{invoiced} &= \sum_{t.type = \text{INCOME}, t.status \in \{\text{invoiced}, \text{cleared}, \text{paid}\}} t.base\_amount \\
   V_{realized} &= \sum_{t.type = \text{INCOME}, t.status \in \{\text{cleared}, \text{paid}\}} t.base\_amount \\
   \text{Realization Ratio} &= \begin{cases} \left( \frac{V_{realized}}{V_{invoiced}} \right) \times 100 & \text{if } V_{invoiced} > 0 \\ 0.0\% & \text{otherwise} \end{cases}
   \end{aligned}$$

---

### 3.5 Accounts Receivable (AR) Aging Engine & Traffic-Light Health Model

#### 1. Identification of Outstanding Invoices:
$$\text{AR} = \{ t \in \text{Transactions} \mid t.type = \text{INCOME} \land t.status = \text{invoiced} \}$$

#### 2. Aging Duration Metric:
For each $t \in \text{AR}$, let $D_{ref} = t.invoice\_due\_date$ (fallback to $t.invoice\_issue\_date$ or $t.transaction\_date$).
$$\text{Days Outstanding / Overdue} = \max\left(0, \text{DateDiff}_{\text{days}}(\text{CurrentDate}, D_{ref})\right)$$

#### 3. Aging Buckets:
| Bucket | Name | Condition | Risk Weight |
|---|---|---|---|
| **$B_1$** | Current (0–30 days) | $0 \le \text{Days} \le 30$ | Low |
| **$B_2$** | 31–60 days | $31 \le \text{Days} \le 60$ | Moderate |
| **$B_3$** | 61–90 days | $61 \le \text{Days} \le 90$ | Elevated |
| **$B_4$** | 90+ days (Delinquent) | $\text{Days} > 90$ | Severe |

Let $V(B_k) = \sum_{t \in B_k} t.base\_amount$ and $V_{total} = \sum_{k=1}^4 V(B_k)$.  
Let $P(B_k) = \frac{V(B_k)}{V_{total}} \times 100$ (or $0.0\%$ if $V_{total} = 0$).

#### 4. Traffic-Light Health Evaluation Matrix:
$$\text{AR Status} = \begin{cases}
\textbf{GREEN (Healthy)} & \text{if } V(B_4) = 0 \land P(B_3) < 10.0\% \text{ (or } V_{total} = 0\text{)} \\
\textbf{RED (Critical Risk)} & \text{if } P(B_4) \ge 15.0\% \lor V(B_4) \ge 5000.00 \lor (P(B_3) + P(B_4)) \ge 25.0\% \\
\textbf{YELLOW (Warning)} & \text{otherwise (e.g. } P(B_3) \ge 10.0\% \text{ or } 0 < P(B_4) < 15.0\%\text{)}
\end{cases}$$

---

## 4. Encrypted Vault Backup & Restore (`.vault`) Specification

### 4.1 Binary Container Architecture

The `.vault` file is an authenticated, encrypted, tamper-evident container designed to protect user data against unauthorized offline extraction while enabling atomic single-click backup and restore.

```
+-------------------------------------------------------------------------+
|                        APEXJOURNAL VAULT CONTAINER                      |
+-------------------+-----------------+-----------------+-----------------+
| Magic (8 Bytes)   | Version (1 Byte)| CipherID (2 B)  | Meta Len (4 B)  |
| "APEXVAUL"        | 0x01            | 0x0001 (AES-GCM)| Big-Endian uint |
+-------------------+-----------------+-----------------+-----------------+
|                                                                         |
| JSON Metadata Header (UTF-8 Encoded, Variable Length = Meta Len)        |
| - App Version, Schema Version, Created Timestamp, Base Currency         |
| - Argon2id Parameters (Memory: 64MB, Iterations: 3, Parallelism: 4)     |
| - Salt (32 bytes hex), AES Nonce/IV (12 bytes hex)                      |
| - Uncompressed Size, Payload Checksum (SHA-256)                         |
|                                                                         |
+-------------------------------------------------------------------------+
|                                                                         |
| AES-256-GCM Encrypted Payload (Variable Length)                         |
| - Plaintext: Gzipped SQLCipher Database Dump / Serialized Migration     |
|                                                                         |
+-------------------------------------------------------------------------+
| GCM Authentication Tag (16 Bytes)                                       |
+-------------------------------------------------------------------------+
```

### 4.2 Cryptographic Parameters
- **KDF**: Argon2id
  - Salt Length: 32 bytes (cryptographically secure random `OsRng`)
  - Memory: $65,536\text{ KiB}$ (64 MB)
  - Time Cost / Iterations: 3
  - Parallelism / Lanes: 4
  - Derived Key Length: 32 bytes (256 bits)
- **Encryption**: AES-256-GCM (NIST SP 800-38D)
  - Nonce / IV: 12 bytes (96 bits), unique per backup
  - Auth Tag: 16 bytes (128 bits)
- **Payload Integrity**: SHA-256 pre-encryption checksum of SQLite stream.

### 4.3 Backup Creation Algorithm
1. Acquire read lock on active SQLCipher database.
2. Execute SQLite online backup API (`rusqlite::backup`) or SQL schema/data dump into temporary in-memory buffer.
3. Compress database stream using `flate2::write::GzEncoder` (Level 6).
4. Compute `payload_sha256 = sha256(compressed_stream)`.
5. Generate 32-byte random salt and 12-byte random nonce.
6. Derive $K_{backup} = \text{Argon2id}(\text{MasterPassword}, \text{Salt})$.
7. Encrypt compressed stream with AES-256-GCM using $K_{backup}$ and Nonce.
8. Serialize JSON metadata containing parameters, nonce, salt, and hashes.
9. Assemble binary header + JSON metadata + ciphertext + auth tag into `.vault` file on user's disk.

### 4.4 Restore & Validation Pipeline
1. **Magic Header Verification**: Read first 8 bytes; assert equality to `"APEXVAUL"`.
2. **Version Check**: Verify container version $\le \text{SUPPORTED\_VERSION}$.
3. **Metadata Extraction**: Parse JSON metadata block.
4. **Key Derivation**: Derive key using provided password and extracted Argon2id salt & cost parameters.
5. **Authenticated Decryption**: Decrypt ciphertext and verify 16-byte GCM tag. Fail immediately on invalid key or tampering.
6. **Decompression & Integrity Check**: Decompress payload; verify `sha256(decompressed) == metadata.checksum_sha256`.
7. **Schema & Referential Validation**:
   - Open decrypted database in temporary in-memory connection.
   - Run `PRAGMA foreign_key_check;` and `PRAGMA integrity_check;`.
8. **Atomic Replacement**:
   - Close active database handles.
   - Atomically overwrite target database file using `std::fs::rename`.
   - Re-open and refresh frontend session state.

---

## 5. CSV & Excel Export Specifications

### 5.1 CSV Export File Specifications

All CSV files are encoded in **UTF-8 with BOM** (`\xEF\xBB\xBF`) to ensure native compatibility with Microsoft Excel across macOS and Windows.

#### File 1: `apex_transactions_YYYY-MM-DD.csv`
| Column Name | Type | Example | Description |
|---|---|---|---|
| `transaction_id` | UUID | `e7c4f6a1-9b12-4c28-912f-1234567890ab` | Unique ID |
| `transaction_number` | String | `TX-2026-0042` | Formatted blotter sequence |
| `date` | ISO Date | `2026-08-15` | Transaction date |
| `type` | Enum | `INCOME` | `INCOME` or `EXPENSE` |
| `category_code` | String | `consulting_revenue` | Unique category code |
| `category_name` | String | `Consulting & Advisory` | Human readable category |
| `case_number` | String | `CASE-2026-008` | Linked case code (or empty) |
| `case_title` | String | `Fintech Architecture Review` | Linked case title |
| `client_vendor` | String | `Acme Capital LLC` | Counterparty |
| `description` | String | `Phase 1 Milestone Deliverable` | Line item description |
| `currency` | ISO Code | `EUR` | Original currency code |
| `amount` | Decimal(2) | `15000.00` | Amount in original currency |
| `exchange_rate` | Decimal(4) | `1.0850` | Exchange rate to Base Currency |
| `base_currency` | ISO Code | `USD` | System base currency |
| `base_amount` | Decimal(2) | `16275.00` | Consolidated base amount |
| `status` | Enum | `cleared` | `pending`/`invoiced`/`cleared`/`paid` |
| `invoice_ref` | String | `INV-2026-0042` | Invoice reference number |
| `invoice_issue_date`| ISO Date | `2026-08-01` | Invoice date |
| `invoice_due_date`  | ISO Date | `2026-08-31` | Payment due date |
| `cleared_date`      | ISO Date | `2026-08-15` | Date payment settled |
| `payment_method`    | String | `wire` | Payment instrument |
| `notes`             | String | `Settled via SWIFT` | Additional remarks |

#### File 2: `apex_cases_YYYY-MM-DD.csv`
| Column Name | Type | Example | Description |
|---|---|---|---|
| `case_id` | UUID | `a1b2c3d4-1111-2222-3333-444455556666` | Unique Case ID |
| `case_number` | String | `CASE-2026-001` | Human Case Code |
| `title` | String | `Core Banking Modernization` | Project Title |
| `client_name` | String | `Global Bank Corp` | Client Name |
| `client_company` | String | `Global Bank Corp LLC` | Client Entity |
| `stage` | Enum | `active` | `lead`/`quotation`/`active`/`completed`/`lost` |
| `currency` | ISO Code | `USD` | Case Currency |
| `proposal_value_original` | Decimal(2) | `85000.00` | Quoted in Case Currency |
| `proposal_value_base` | Decimal(2) | `85000.00` | Quoted in Base Currency |
| `estimated_cost_base` | Decimal(2) | `25000.00` | Budgeted Direct Costs |
| `realized_income_base`| Decimal(2) | `45000.00` | Cleared/Paid Revenue |
| `invoiced_income_base`| Decimal(2) | `85000.00` | Invoiced + Paid Revenue |
| `total_expenses_base` | Decimal(2) | `18500.00` | Realized Direct Expenses |
| `net_margin_base`     | Decimal(2) | `26500.00` | Realized Net Margin (Income - Expense) |
| `profit_margin_pct`   | Decimal(2) | `58.89` | $((\text{Invoiced} - \text{Expense})/\text{Invoiced}) \times 100$ |
| `win_probability_pct` | Integer | `90` | CRM Win Probability |
| `lead_date`           | ISO Date | `2026-06-01` | Lead Capture Date |
| `quotation_date`      | ISO Date | `2026-06-15` | Quote Sent Date |
| `start_date`          | ISO Date | `2026-07-01` | Kickoff Date |
| `target_completion_date` | ISO Date | `2026-10-31`| Target Delivery |
| `closed_date`         | ISO Date | `` | Date Won/Lost/Finished |
| `loss_reason`         | String | `` | Reason if Lost |

#### File 3: `apex_journal_entries_YYYY-MM-DD.csv`
| Column Name | Type | Example | Description |
|---|---|---|---|
| `entry_id` | UUID | `f9e8d7c6-0000-1111-2222-333344445555` | Journal Entry ID |
| `entry_date` | ISO 8601 | `2026-08-30T14:30:00Z` | Entry Timestamp |
| `case_number` | String | `CASE-2026-001` | Linked Case (if any) |
| `case_title` | String | `Core Banking Modernization` | Linked Case Title |
| `title` | String | `Architecture Review Key Takeaways` | Title of Note |
| `tags` | String | `architecture;security;review` | Semicolon-delimited tags |
| `word_count` | Integer | `450` | Word count |
| `content_markdown` | String (Escaped) | `## Findings\n- Reviewed SQLCipher...` | Full markdown content |

---

### 5.2 Multi-Sheet Excel Workbook (`ApexJournal_Financial_Report.xlsx`)

The system generates a styled, multi-tab Excel spreadsheet utilizing standard financial accounting styling:

1. **Tab 1: `Executive Dashboard & KPIs`**
   - Summary Card Grid: Total Net Margin, Win Rate %, Realized Volume, Invoiced Volume, Realization Rate %, AR Total, AR Traffic Light.
   - Monthly PnL Table: 12-month breakdown (Income, Expenses, Net PnL, Margin %).
2. **Tab 2: `Financial Blotter`**
   - High-density table of all financial transactions with currency formatting, category coloring, and auto-filters.
3. **Tab 3: `Case Pipeline & PnL`**
   - Complete project ledger with stage badges, quoted vs actual metrics, and milestone statuses.
4. **Tab 4: `AR Aging Schedule`**
   - Outstanding receivables aged into 0-30, 31-60, 61-90, and 90+ day buckets with client contact references.

---

## 6. Rust Backend Data Structures & TypeScript Type Contracts

### 6.1 Rust Core Types (`src-tauri/src/models/mod.rs`)

```rust
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum TransactionType {
    INCOME,
    EXPENSE,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum TransactionStatus {
    Pending,
    Invoiced,
    Cleared,
    Paid,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub enum CaseStage {
    Lead,
    Quotation,
    Active,
    Completed,
    Lost,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransactionRecord {
    pub id: String,
    pub transaction_number: String,
    pub transaction_date: String,
    pub transaction_type: TransactionType,
    pub category_id: String,
    pub category_name: String,
    pub case_id: Option<String>,
    pub client_vendor: String,
    pub description: String,
    pub amount: f64,
    pub currency: String,
    pub exchange_rate: f64,
    pub base_amount: f64,
    pub status: TransactionStatus,
    pub invoice_ref: Option<String>,
    pub invoice_issue_date: Option<String>,
    pub invoice_due_date: Option<String>,
    pub cleared_date: Option<String>,
    pub payment_method: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaseRecord {
    pub id: String,
    pub case_number: String,
    pub title: String,
    pub client_name: String,
    pub client_company: Option<String>,
    pub client_email: Option<String>,
    pub stage: CaseStage,
    pub currency: String,
    pub proposal_value: f64,
    pub estimated_cost: f64,
    pub win_probability: u32,
    pub lead_date: String,
    pub quotation_date: Option<String>,
    pub start_date: Option<String>,
    pub target_completion_date: Option<String>,
    pub closed_date: Option<String>,
    pub loss_reason: Option<String>,
    pub notes: Option<String>,
    // Aggregated Financial Metrics
    pub realized_income: f64,
    pub invoiced_income: f64,
    pub total_expenses: f64,
    pub net_margin: f64,
    pub profit_margin_pct: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EquityPoint {
    pub date: String,
    pub daily_flow: f64,
    pub cumulative_equity: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonthlyVolumeBar {
    pub month: String, // YYYY-MM
    pub income: f64,
    pub expense: f64,
    pub net_pnl: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArAgingSummary {
    pub total_outstanding: f64,
    pub current_0_30: f64,
    pub days_31_60: f64,
    pub days_61_90: f64,
    pub days_90_plus: f64,
    pub status_traffic_light: String, // "GREEN", "YELLOW", "RED"
    pub invoices_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutiveDashboardMetrics {
    pub total_realized_income: f64,
    pub total_expenses: f64,
    pub net_margin: f64,
    pub win_rate_count_pct: f64,
    pub win_rate_value_pct: f64,
    pub average_ticket_size: f64,
    pub realized_volume: f64,
    pub invoiced_volume: f64,
    pub realization_ratio_pct: f64,
    pub ar_summary: ArAgingSummary,
    pub equity_curve: Vec<EquityPoint>,
    pub monthly_bars: Vec<MonthlyVolumeBar>,
}
```

### 6.2 TypeScript Frontend Interface Contracts (`src/types/models.ts`)

```typescript
export type TransactionType = 'INCOME' | 'EXPENSE';
export type TransactionStatus = 'pending' | 'invoiced' | 'cleared' | 'paid' | 'cancelled';
export type CaseStage = 'lead' | 'quotation' | 'active' | 'completed' | 'lost';
export type TrafficLightStatus = 'GREEN' | 'YELLOW' | 'RED';
export type TimeframeOption = '1W' | '1M' | '3M' | '1Y' | 'ALL';

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces: number;
  isActive: boolean;
}

export interface Category {
  id: string;
  code: string;
  name: string;
  type: TransactionType;
  colorToken: string;
  iconName: string;
  isSystem: boolean;
  isActive: boolean;
}

export interface Transaction {
  id: string;
  transactionNumber: string;
  transactionDate: string;
  type: TransactionType;
  categoryId: string;
  categoryName?: string;
  caseId?: string | null;
  caseNumber?: string;
  caseTitle?: string;
  clientVendor: string;
  description: string;
  amount: number;
  currency: string;
  exchangeRate: number;
  baseAmount: number;
  status: TransactionStatus;
  invoiceRef?: string;
  invoiceIssueDate?: string;
  invoiceDueDate?: string;
  clearedDate?: string;
  paymentMethod: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CaseMilestone {
  id: string;
  caseId: string;
  title: string;
  description?: string;
  dueDate: string;
  amount: number;
  currency: string;
  status: 'pending' | 'in_progress' | 'completed' | 'invoiced' | 'paid';
  completedAt?: string;
}

export interface CaseItem {
  id: string;
  caseNumber: string;
  title: string;
  clientName: string;
  clientCompany?: string;
  clientEmail?: string;
  stage: CaseStage;
  currency: string;
  proposalValue: number;
  estimatedCost: number;
  winProbability: number;
  leadDate: string;
  quotationDate?: string;
  startDate?: string;
  targetCompletionDate?: string;
  closedDate?: string;
  lossReason?: string;
  notes?: string;
  // Computed Financials
  realizedIncome: number;
  invoicedIncome: number;
  totalExpenses: number;
  netMargin: number;
  profitMarginPct: number;
  milestones?: CaseMilestone[];
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntry {
  id: string;
  title: string;
  entryDate: string;
  caseId?: string | null;
  caseTitle?: string;
  contentMarkdown: string;
  isPinned: boolean;
  wordCount: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export interface EquityPoint {
  date: string;
  dailyFlow: number;
  cumulativeEquity: number;
}

export interface MonthlyVolumeBar {
  month: string; // YYYY-MM
  income: number;
  expense: number;
  netPnl: number;
}

export interface ArAgingSummary {
  totalOutstanding: number;
  current0To30: number;
  days31To60: number;
  days61To90: number;
  days90Plus: number;
  statusTrafficLight: TrafficLightStatus;
  invoicesCount: number;
}

export interface ExecutiveDashboardMetrics {
  totalRealizedIncome: number;
  totalExpenses: number;
  netMargin: number;
  winRateCountPct: number;
  winRateValuePct: number;
  averageTicketSize: number;
  realizedVolume: number;
  invoicedVolume: number;
  realizationRatioPct: number;
  arSummary: ArAgingSummary;
  equityCurve: EquityPoint[];
  monthlyBars: MonthlyVolumeBar[];
}
```

---

## 7. Verification Test Scenarios & Edge Cases

### Test Case 1: Multi-Currency PnL Determinism
- **Input**:
  - Base currency: `USD`
  - Transaction 1: Income `EUR 10,000` on 2026-08-01, Rate `EUR/USD = 1.0850` $\to$ Base Amount: `$10,850.00`.
  - Transaction 2: Expense `GBP 2,500` on 2026-08-05, Rate `GBP/USD = 1.2800` $\to$ Base Amount: `$3,200.00`.
  - Transaction 3: Income `CAD 5,000` on 2026-08-10, Rate `CAD/USD = 0.7400` $\to$ Base Amount: `$3,700.00`.
- **Expected Results**:
  - Total Realized Income: `$14,550.00`
  - Total Expenses: `$3,200.00`
  - Net Margin: `$11,350.00`
  - Profit Margin: $\left(\frac{11350}{14550}\right) \times 100 = 78.01\%$

### Test Case 2: AR Aging Bucketing & Traffic Light Shift
- **Input**:
  - Current Date: `2026-08-30`
  - Invoice A: `$10,000`, Due: `2026-08-15` (15 days overdue) $\to$ $B_1$ ($0\text{--}30\text{d}$)
  - Invoice B: `$5,000`, Due: `2026-07-15` (46 days overdue) $\to$ $B_2$ ($31\text{--}60\text{d}$)
  - Invoice C: `$2,000`, Due: `2026-06-15` (76 days overdue) $\to$ $B_3$ ($61\text{--}90\text{d}$)
  - Total AR: `$17,000`.
  - $B_3$ ratio: $\frac{2000}{17000} = 11.76\%$ (> 10%).
- **Expected Result**: Traffic light is `YELLOW`.
- **Step 2**: Add Invoice D: `$3,000`, Due: `2026-05-15` (107 days overdue) $\to$ $B_4$ ($90+\text{d}$).
  - Total AR: `$20,000`. $B_4$ ratio: $\frac{3000}{20000} = 15.0\%$.
- **Expected Result**: Traffic light shifts to `RED`.

### Test Case 3: Win Rate Calculation Zero-Division Safety
- **Scenario A**: 0 closed proposals $\to$ Returns `0.0%`, no NaN or panic.
- **Scenario B**: 4 won proposals, 1 lost proposal $\to$ Win Rate $= \left(\frac{4}{4+1}\right) \times 100 = 80.0\%$.

---

## 8. Conclusion & Implementation Recommendations

1. **SQLite Storage**: Use strict column types and Foreign Key enforcement inside SQLCipher.
2. **Currency Precision**: Calculate base amounts immediately at write-time and persist the `exchange_rate` snapshot alongside `base_amount` to maintain immutable audit records even if future rates change.
3. **Backend Service Module**: Encapsulate all calculation routines in dedicated Rust modules (`src-tauri/src/services/analytics.rs`, `src-tauri/src/services/vault.rs`, `src-tauri/src/services/export.rs`) backed by comprehensive unit tests.
