# DISPATCH — Survey Spec Miner 3 (UI/UX Design System, Views & Interaction Specifications)

## Assignment
You are Survey Spec Miner 3 for ApexJournal.
Your working directory is: `/Users/nuevo/apex_journal/.agents/survey_spec_miner_3`
Your mission is to extract precise, exhaustive requirements and specifications for the UI/UX architecture, Design System, 4 Core Views, and Keyboard Navigation.

## Mandatory Inputs to Read
- Read `/Users/nuevo/apex_journal/.agents/ORIGINAL_REQUEST.md` completely.
- Check workspace root `/Users/nuevo/apex_journal` for any existing files/structure.

## Investigation Scope
1. Design System & Theming:
   - Palette: `#09090b` obsidian background, dark surface tokens, `#8B5CF6` electric purple accents, secondary accents, border and muted text hierarchy.
   - Typography: Geist Mono (numerical blotter, financial metrics, code/markdown blocks), Geist / Inter (interface body, headers, navigation).
   - Component library & Styling: Tailwind CSS, Radix UI / Shadcn-style components, Lucide icons, high-density compact tables and cards.
2. 4 Core Views:
   - Executive Dashboard: Interactive Equity Curve chart (Recharts/Chart.js) with 1W/1M/3M/1Y/ALL timeframe selectors + monthly PnL volume bars; KPI performance cards (Net Margin, Win Rate, Realized Volume, Avg Ticket); Accounts Receivable aging traffic-light widget.
   - Financial Blotter (Libro Diario): High-density transaction table, multi-column search & filter (by category, date range, status, currency, case), inline editing, quick status toggling.
   - Case Pipeline: Kanban board with stages (Leads, Quotations, Active Projects, Completed, Lost) + Case Detail modal/drawer with Project PnL header, milestones table, and case diary.
   - Operations Journal: Chronological rich Markdown entry feed, live preview editor, Zen Mode toggle (`Cmd+\`), tags, case linkage.
3. Keyboard Velocity & Modals:
   - Raycast-style Command Palette (`Cmd+K` / `Ctrl+K`): quick jump to views, search cases/transactions, trigger actions.
   - Quick-Capture Modal (`Cmd+N`): fast transaction / case note / lead logging without leaving current view.
   - Numeric navigation (`1` = Dashboard, `2` = Blotter, `3` = Pipeline, `4` = Journal).
4. Acceptance Criteria & Edge Cases:
   - Map every UI acceptance criterion from ORIGINAL_REQUEST.md to concrete verification steps.

## Deliverable
## 2026-08-30T19:38:14Z
<USER_REQUEST>
You are Survey Spec Miner 3 for ApexJournal.
Your working directory is: /Users/nuevo/apex_journal/.agents/survey_spec_miner_3
Read /Users/nuevo/apex_journal/.agents/ORIGINAL_REQUEST.md and /Users/nuevo/apex_journal/.agents/survey_spec_miner_3/DISPATCH.md.
Extract exhaustive UI/UX specifications, Obsidian + Electric Purple design tokens, component hierarchy, 4 core views (Executive Dashboard, Financial Blotter, Case Pipeline, Operations Journal), keyboard shortcuts (Cmd+K, Cmd+N, 1-4, Cmd+\), and acceptance criteria mapping.
Write your findings to /Users/nuevo/apex_journal/.agents/survey_spec_miner_3/spec_report.md and /Users/nuevo/apex_journal/.agents/survey_spec_miner_3/handoff.md.
Send a message when finished.
</USER_REQUEST>
