# Project: ApexJournal

## Architecture

ApexJournal is a high-performance, local-first, AES-256 encrypted desktop operating and financial journal for macOS. It combines professional financial analytics (Cumulative Equity Curve, Multi-currency PnL, Win Rate, Accounts Receivable Aging) with a case/project operating diary featuring a minimalist dark UI (#09090b obsidian) with electric purple (#8B5CF6) accents.

### Technology Stack
- **Desktop Shell**: Tauri v2 (macOS native windowing, overlay titlebar with traffic light padding, system tray, global shortcut handling).
- **Backend & Core Engine**: Rust 2021 Edition.
  - Database: `rusqlite` with `bundled-sqlcipher-vendored-openssl` (AES-256-GCM / SQLCipher page encryption, zero external dynamic library dependencies).
  - Key Derivation: `argon2` (Argon2id, $m=64\text{ MB}$, $t=3$, $p=4$, 32-byte salt).
  - Memory Security: `zeroize` (`Zeroizing<[u8; 32]>` for master passwords and derived keys).
  - Biometrics: macOS `Security.framework` (`security-framework` crate) for Touch ID / Keychain unlock with headless CI mock bridge.
  - Concurrency: `tokio` + `parking_lot` / `std::sync::Mutex` managing single-connection encrypted database access with auto-lock timer.
- **Frontend**: React 18 / Vite / TypeScript.
  - Styling: Tailwind CSS, custom design tokens (`#09090b` obsidian background, `#121216` cards, `#8B5CF6` electric purple accents).
  - Typography: `Geist Mono` for financial tables, metrics, and dates (`tabular-nums`); `Geist` / `Inter` for interface typography.
  - Charts: Recharts / Chart.js for interactive Equity Curve (1W/1M/3M/1Y/ALL) + monthly PnL volume bars.
  - State Management: React context / Zustand for session auth state, active view, and fast UI caching.
  - Markdown: `react-markdown` / `@tailwindcss/typography` with live preview and Zen Mode.

---

## Feature Inventory

| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Native macOS Shell | Tauri v2 window configuration, macOS overlay titlebar, tray & lifecycle | M1 | ORIGINAL_REQUEST §R1 |
| 2 | SQLCipher Database Engine | AES-256 encrypted SQLite storage at rest, raw hex key pragma, no plaintext on disk | M1 | ORIGINAL_REQUEST §R1, §Acceptance Criteria |
| 3 | Argon2id Key Derivation | $m=64\text{MB}, t=3, p=4$ master password hashing and 256-bit key derivation | M1 | ORIGINAL_REQUEST §R1 |
| 4 | Memory Zeroization | Secure wiping of plaintext passwords and encryption keys on lock/drop | M1 | Survey Explorer 1 |
| 5 | Biometric / Keychain Unlock | macOS Touch ID & Keychain integration with mock bridge for CI | M1 | ORIGINAL_REQUEST §R1 |
| 6 | Inactivity Auto-Lock | Monotonic timer auto-lock after inactivity, zeroizing memory & dropping db connection | M1 | ORIGINAL_REQUEST §R1, §Acceptance Criteria |
| 7 | Session Unlock & Setup | Master password initial setup, unlock verification, and error handling | M1 | ORIGINAL_REQUEST §R1 |
| 8 | Multi-Currency System | Currency definitions, base currency consolidation, exchange rate resolution | M2 | ORIGINAL_REQUEST §R2 |
| 9 | Financial Movements & Categories | Income/Expense transactions, predefined business categories, cleared/pending status | M2 | ORIGINAL_REQUEST §R2 |
| 10 | Case Pipeline Lifecycle | Kanban stages: Leads, Quotations, Active Projects, Completed, Lost | M2 | ORIGINAL_REQUEST §R2 |
| 11 | Case Milestones & Diary | Milestones checklist, deadline tracking, and case-linked diary entries | M2 | ORIGINAL_REQUEST §R2, §R3 |
| 12 | Case PnL Calculation | Deterministic Realized & Invoiced Net Margin ($Income - Expenses$) per case | M2 | ORIGINAL_REQUEST §R2, §Acceptance Criteria |
| 13 | Cumulative Equity Curve Engine | Daily delta $\Delta E(d)$ and cumulative running equity series $E(d)$ calculation | M2 | ORIGINAL_REQUEST §R2, §Acceptance Criteria |
| 14 | Executive KPI Metrics Engine | Win Rate calculation $((Won / TotalClosed) \times 100)$, Avg Ticket, Realized vs Invoiced | M2 | ORIGINAL_REQUEST §R2, §Acceptance Criteria |
| 15 | Accounts Receivable Aging | 4-bucket schedule (0-30d, 31-60d, 61-90d, 90+d) and traffic-light indicator logic | M2 | ORIGINAL_REQUEST §R2, §R3 |
| 16 | Obsidian & Electric Purple Theme | `#09090b` canvas, `#121216` surfaces, `#8B5CF6` primary accents, Geist Mono typography | M3 | ORIGINAL_REQUEST §R3 |
| 17 | Executive Dashboard View | Interactive Equity Curve chart (1W/1M/3M/1Y/ALL) + monthly bars, KPI cards, AR widget | M3 | ORIGINAL_REQUEST §R3 |
| 18 | Financial Blotter View | High-density transaction data table, multi-column filters, inline edits, status toggles | M3 | ORIGINAL_REQUEST §R3 |
| 19 | Case Pipeline View | Kanban board with 5 stages + Case Detail drawer with PnL header, milestones, diary | M3 | ORIGINAL_REQUEST §R3 |
| 20 | Operations Journal View | Chronological rich Markdown entry feed, live preview editor, Zen Mode (`Cmd+\`) | M3 | ORIGINAL_REQUEST §R3 |
| 21 | Keyboard Velocity Engine | `Cmd+K` Raycast command palette, `Cmd+N` quick capture modal, `1-4` view switching | M3 | ORIGINAL_REQUEST §R3 |
| 22 | Quick-Capture Modal | Fast modal for adding transactions, cases, or notes with keyboard shortcuts | M3 | ORIGINAL_REQUEST §R3 |
| 23 | Encrypted .vault Backup | 1-click export of AES-256 encrypted `.vault` container with Argon2id & HMAC | M4 | ORIGINAL_REQUEST §R4, §Acceptance Criteria |
| 24 | Encrypted .vault Restore | Decryption, integrity check, and clean database restore without corruption | M4 | ORIGINAL_REQUEST §R4, §Acceptance Criteria |
| 25 | CSV Data Export | Comprehensive CSV export for transactions, cases, journal entries with exact headers | M4 | ORIGINAL_REQUEST §R4, §Acceptance Criteria |
| 26 | Excel Audit Export | Multi-sheet structured Excel workbook export with formatting | M4 | ORIGINAL_REQUEST §R4 |
| 27 | End-to-End IPC Integration | Wiring Tauri IPC commands with React frontend state and real-time updates | M4 | Survey Explorer 1, 2, 3 |
| 28 | Comprehensive E2E Verification | 100% pass of Tiers 1-4 requirement-driven opaque-box test suite | M5 | ORIGINAL_REQUEST §Acceptance Criteria |
| 29 | Adversarial Coverage Hardening | White-box stress testing, corner cases, and adversarial validation (Tier 5) | M5 | Project Pattern Phase 2 |

---

## Milestones

| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Core Architecture & SQLCipher Storage | Tauri v2 app shell, Rust core, SQLCipher AES-256 storage, Argon2id KDF, Zeroize memory, Touch ID bridge, session auto-lock, unlock/setup IPC commands | none | DONE |
| M2 | Relational Data Model & Financial Engine | SQLite relational schema migrations, Currencies, Movements, Cases, Milestones, Journal DDL, deterministic Multi-currency PnL, Equity Curve, Win Rate, AR Aging engines | M1 | DONE |
| M3 | UI Design System, Core Views & Shortcuts | Obsidian/Electric Purple styling, Executive Dashboard, Financial Blotter, Case Pipeline, Operations Journal, Cmd+K palette, Cmd+N capture, 1-4 navigation, Cmd+\ Zen mode | M2 | DONE |
| M4 | Vault Backup/Restore, Export & IPC Wiring | Encrypted .vault backup/restore container, CSV/Excel export, end-to-end Tauri IPC wiring connecting frontend to database and analytics engines | M3 | DONE |
| M5 | E2E Verification & Adversarial Hardening | Phase 1: Pass 100% of E2E test suite (Tiers 1-4). Phase 2: Tier 5 adversarial stress testing, zero regression, final audit validation | M4 | DONE |

---

## Interface Contracts

### 1. Tauri IPC Command Catalog (Rust ↔ React)

```typescript
// Auth & Vault Lifecycle
invoke('vault_setup', { masterPassword: string }): Promise<VaultStatus>;
invoke('vault_unlock', { masterPassword: string }): Promise<VaultStatus>;
invoke('vault_unlock_biometric'): Promise<VaultStatus>;
invoke('vault_lock'): Promise<void>;
invoke('vault_get_status'): Promise<VaultStatus>;

// Financial Blotter & Categories
invoke('transaction_create', { input: CreateTransactionInput }): Promise<Transaction>;
invoke('transaction_update', { id: string, input: UpdateTransactionInput }): Promise<Transaction>;
invoke('transaction_delete', { id: string }): Promise<void>;
invoke('transaction_list', { filter: TransactionFilter }): Promise<Transaction[]>;
invoke('category_list'): Promise<Category[]>;

// Case Pipeline & Milestones
invoke('case_create', { input: CreateCaseInput }): Promise<Case>;
invoke('case_update', { id: string, input: UpdateCaseInput }): Promise<Case>;
invoke('case_list'): Promise<Case[]>;
invoke('case_get_detail', { id: string }): Promise<CaseDetail>;
invoke('milestone_toggle', { id: string, completed: boolean }): Promise<Milestone>;

// Operations Journal
invoke('journal_create', { input: CreateJournalInput }): Promise<JournalEntry>;
invoke('journal_update', { id: string, input: UpdateJournalInput }): Promise<JournalEntry>;
invoke('journal_list', { filter: JournalFilter }): Promise<JournalEntry[]>;

// Analytics & Dashboard
invoke('analytics_get_dashboard'): Promise<DashboardMetrics>;
invoke('analytics_get_equity_curve', { timeframe: '1W' | '1M' | '3M' | '1Y' | 'ALL' }): Promise<EquityCurvePoint[]>;
invoke('analytics_get_ar_aging'): Promise<ARAgingSummary>;

// Vault Backup & Export
invoke('vault_export_backup', { destinationPath: string }): Promise<BackupResult>;
invoke('vault_restore_backup', { sourcePath: string, masterPassword: string }): Promise<void>;
invoke('export_csv', { exportType: 'transactions' | 'cases' | 'journal' }): Promise<string>;
invoke('export_excel', { destinationPath: string }): Promise<void>;
```

### 2. Core Data Types

```typescript
export interface VaultStatus {
  initialized: boolean;
  unlocked: boolean;
  biometricAvailable: boolean;
  autoLockMinutes: number;
}

export interface Transaction {
  id: string;
  date: string; // ISO 8601 YYYY-MM-DD
  type: 'INCOME' | 'EXPENSE';
  category_id: string;
  category_name?: string;
  amount: number;
  currency: string;
  exchange_rate: number;
  base_amount: number; // calculated in base currency
  status: 'CLEARED' | 'PENDING' | 'INVOICED' | 'PAID';
  case_id?: string | null;
  case_title?: string | null;
  notes?: string | null;
}

export interface Case {
  id: string;
  title: string;
  client_name: string;
  stage: 'LEAD' | 'QUOTATION' | 'ACTIVE' | 'COMPLETED' | 'LOST';
  quoted_amount: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface CaseDetail extends Case {
  realized_income: number;
  realized_expense: number;
  net_margin: number;
  profit_margin_pct: number;
  milestones: Milestone[];
  diary_entries: JournalEntry[];
}

export interface DashboardMetrics {
  cumulative_net_margin: number;
  proposal_win_rate: number;
  realized_volume: number;
  invoiced_volume: number;
  avg_ticket_size: number;
  base_currency: string;
}

export interface EquityCurvePoint {
  date: string;
  daily_delta: number;
  cumulative_equity: number;
  volume_income: number;
  volume_expense: number;
}

export interface ARAgingSummary {
  current_0_30: number;
  pending_31_60: number;
  overdue_61_90: number;
  critical_90_plus: number;
  total_receivable: number;
  traffic_light: 'GREEN' | 'YELLOW' | 'RED';
}
```

---

## Code Layout

```
/Users/nuevo/apex_journal/
├── src-tauri/                     # Rust backend & Tauri v2 core
│   ├── Cargo.toml
│   ├── tauri.conf.json
│   ├── capabilities/
│   │   └── default.json
│   └── src/
│       ├── main.rs
│       ├── lib.rs
│       ├── crypto/                # Argon2id, zeroize, master key derivation
│       │   ├── mod.rs
│       │   ├── argon.rs
│       │   └── keychain.rs        # macOS Security.framework / mock bridge
│       ├── db/                    # SQLCipher / Rusqlite connection & migrations
│       │   ├── mod.rs
│       │   ├── connection.rs
│       │   ├── schema.rs
│       │   └── migrations.rs
│       ├── models/                # Rust domain structs & serde models
│       │   ├── mod.rs
│       │   ├── auth.rs
│       │   ├── transaction.rs
│       │   ├── case_model.rs
│       │   ├── journal.rs
│       │   └── analytics.rs
│       ├── analytics/             # Deterministic financial calculations engine
│       │   ├── mod.rs
│       │   ├── pnl.rs
│       │   ├── equity_curve.rs
│       │   ├── win_rate.rs
│       │   └── ar_aging.rs
│       ├── vault/                 # .vault backup/restore & CSV/Excel export
│       │   ├── mod.rs
│       │   ├── backup.rs
│       │   └── export.rs
│       └── commands/              # Tauri IPC command handlers
│           ├── mod.rs
│           ├── auth_cmd.rs
│           ├── transaction_cmd.rs
│           ├── case_cmd.rs
│           ├── journal_cmd.rs
│           ├── analytics_cmd.rs
│           └── export_cmd.rs
├── src/                           # React 18 + TypeScript + Vite frontend
│   ├── index.html
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css              # Custom design tokens (#09090b, #8B5CF6, Geist typography)
│       ├── types/                 # TypeScript interface contracts
│       │   ├── auth.ts
│       │   ├── transaction.ts
│       │   ├── case.ts
│       │   ├── journal.ts
│       │   └── analytics.ts
│       ├── api/                   # Tauri IPC wrapper clients
│       │   ├── client.ts
│       │   ├── auth.ts
│       │   ├── transactions.ts
│       │   ├── cases.ts
│       │   └── analytics.ts
│       ├── context/               # Auth, Vault, Global State providers
│       │   ├── AuthContext.tsx
│       │   └── ThemeContext.tsx
│       ├── components/
│       │   ├── common/            # Buttons, Cards, Inputs, Tables, Badges, Modals
│       │   ├── layout/            # macOS Overlay Titlebar, Sidebar, Nav (1-4)
│       │   ├── palette/           # Cmd+K Command Palette
│       │   ├── capture/           # Cmd+N Quick-Capture Modal
│       │   ├── dashboard/         # Equity Curve Chart, KPI Cards, AR Traffic-Light Widget
│       │   ├── blotter/           # High-density transaction table with inline edit & filters
│       │   ├── pipeline/          # Kanban Board & Case Detail PnL Drawer
│       │   └── journal/           # Markdown feed, Live editor, Cmd+\ Zen Mode
│       └── views/
│           ├── LockScreen.tsx
│           ├── DashboardView.tsx
│           ├── BlotterView.tsx
│           ├── PipelineView.tsx
│           └── JournalView.tsx
├── tests/                         # Opaque-box E2E and integration tests
│   ├── e2e_runner.sh
│   ├── tier1_feature_tests/
│   ├── tier2_boundary_tests/
│   ├── tier3_pairwise_tests/
│   ├── tier4_workload_tests/
│   └── tier5_adversarial_tests/
└── .agents/                       # Agent metadata, plans, progress, and reports
```
