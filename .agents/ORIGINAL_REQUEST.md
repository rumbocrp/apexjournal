# Original User Request

## 2026-08-30T19:36:47Z

ApexJournal is a local-first, AES-256 encrypted desktop operating and financial journal for macOS (Tauri v2 + Rust + React/TypeScript) tailored for consultants and agencies. It combines professional trading journal analytics (Equity Curve, PnL, Win Rate, Accounts Receivable) with a case/project operating diary featuring a minimalist dark UI with electric purple accents.

Working directory: /Users/nuevo/apex_journal
Integrity mode: development

## Requirements

### R1. Native macOS Desktop & Encrypted Core (Tauri v2 + Rust + SQLCipher)
Implement a native macOS desktop shell with an embedded SQLCipher/Rusqlite database engine encrypted at rest using AES-256-GCM. Master password derivation must use Argon2id, with optional Touch ID / Apple Keychain integration for session unlock and configurable inactivity auto-lock.

### R2. Relational Data Model & Financial Analytics Engine
Build a robust relational schema and deterministic calculation engine supporting:
1. Multi-currency transactions with base currency consolidation and conversion rates.
2. Financial movements (Income and Expenses) mapped to strict predefined business categories.
3. Case lifecycle management (Leads, Quotations, Active Projects, Completed, Lost) with net margin (PnL) calculated per case.
4. Executive metrics: Cumulative Equity Curve, Win Rate of proposals, Average Ticket, Realized vs Invoiced Volume, and Accounts Receivable aging.

### R3. High-Density Minimalist UI & Core Modules
Develop a clean, non-generic dark trading journal interface (#09090b obsidian theme with #8B5CF6 electric purple accents and Geist Mono/Inter typography) comprising:
1. Executive Dashboard: Interactive Equity Curve chart with timeframe selectors (1W/1M/3M/1Y/ALL) + monthly PnL volume bars, performance cards, and Accounts Receivable traffic-light widget.
2. Financial Blotter (Libro Diario): High-density data table for transactions with multi-column filtering, inline editing, and quick status toggles.
3. Case Pipeline: Kanban stages and Case Detail view featuring a project PnL header, milestones table, and case diary.
4. Operations Journal: Chronological rich Markdown entry feed with Zen Mode (Cmd+\).
5. Keyboard Velocity: Raycast-style Command Palette (Cmd+K), Quick-Capture modal (Cmd+N), and numeric navigation shortcuts (1-4).

### R4. Encrypted Vault Backup & Audit Export
Provide a 1-click encrypted .vault backup/restore mechanism and complete data export to standard CSV and Excel formats.

## Acceptance Criteria

### Security & Storage
- [ ] Database file on disk is unreadable without master key decryption (verifiable via raw binary inspection).
- [ ] Session locks automatically on timeout, requiring valid master password or Touch ID to decrypt state.

### Financial Calculations & Accuracy
- [ ] PnL calculations (Total Income - Total Expenses = Net Margin) are 100% deterministic and tested across multi-currency conversions.
- [ ] Equity Curve data series accurately tracks running cumulative net cash flow over time.
- [ ] Proposal Win Rate correctly reflects (Won Proposals / Total Closed Proposals) * 100.

### UI & Performance
- [ ] All 4 core views (Dashboard, Blotter, Pipeline, Journal) render smoothly with instant tab switching.
- [ ] Quick-Capture modal (Cmd+N) and Command Palette (Cmd+K) trigger reliably via keyboard shortcuts.
- [ ] Markdown editor in Journal renders preview and persists formatted text per entry/case.

### Backup & Export
- [ ] Encrypted backup file can be exported and cleanly restored onto a fresh instance without data corruption.
- [ ] Exported CSV files match database records with correct headers and numeric precision.
