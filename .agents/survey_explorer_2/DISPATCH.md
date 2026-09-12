# DISPATCH — Survey Explorer 2 (Relational Data Model & Financial Analytics Engine)

## Assignment
You are Survey Explorer 2 for ApexJournal.
Your working directory is: `/Users/nuevo/apex_journal/.agents/survey_explorer_2`
Your mission is to perform a comprehensive survey and specification investigation for the Relational Data Model, Financial Calculations Engine, and Backup/Export mechanisms.

## Mandatory Inputs to Read
- Read `/Users/nuevo/apex_journal/.agents/ORIGINAL_REQUEST.md` completely.
- Check workspace root `/Users/nuevo/apex_journal` for any existing files/structure.

## Investigation Scope
1. Relational Schema & Entities:
   - Currency & Exchange rates: Multi-currency support, Base currency consolidation, rate historical tracking.
   - Accounts & Financial Movements: Income, Expense, predefined business categories (e.g. Consulting Revenue, Retainers, Software/SaaS, Subcontracting, Equipment, Taxes, etc.), date, status (cleared, pending, invoiced, paid).
   - Case Pipeline Entities: Leads, Quotations, Active Projects, Completed, Lost. Milestones, Case Diary entries, Case-specific revenue & expenses.
   - Operations Journal: Rich Markdown entries, tags, case linkage, timestamps.
2. Deterministic Financial Analytics Engine:
   - PnL per Case: Total Income - Total Expenses = Net Margin (with multi-currency conversion).
   - Cumulative Equity Curve: Time-series calculation of running cumulative net cash flow over time across selectable timeframes (1W, 1M, 3M, 1Y, ALL) + monthly volume aggregation bars.
   - Executive Metrics: Proposal Win Rate = (Won Proposals / Total Closed Proposals) * 100, Average Ticket size, Realized vs Invoiced Volume.
   - Accounts Receivable Aging: Bucketing (0-30 days, 31-60 days, 61-90 days, 90+ days) and traffic-light status evaluation.
3. Vault Backup & Export:
   - 1-click encrypted `.vault` backup/restore format (AES-256 encrypted payload / raw SQLite ciphertext dump with integrity hash / metadata header).
   - CSV export for transactions, cases, journal entries, and Excel export structure.

## Deliverable
Write your findings to `/Users/nuevo/apex_journal/.agents/survey_explorer_2/survey_report.md` and complete a structured handoff report in `/Users/nuevo/apex_journal/.agents/survey_explorer_2/handoff.md`.
Report back when complete via `send_message`.
