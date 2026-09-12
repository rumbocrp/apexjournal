# Handoff Report — Survey Spec Miner 3

**Agent:** Survey Spec Miner 3 (UI/UX Design System, Views & Interaction Specifications)  
**Parent Conversation ID:** 1eecb70e-5eea-4ad3-b443-d1397ac6c10d  
**Timestamp:** 2026-08-30T19:40:00Z  
**Type:** Hard (Task Complete)  

---

## 1. Observation

1. **Authoritative Requirements Document (`/Users/nuevo/apex_journal/.agents/ORIGINAL_REQUEST.md`)**:
   - Lines 5-8: "ApexJournal is a local-first, AES-256 encrypted desktop operating and financial journal for macOS (Tauri v2 + Rust + React/TypeScript) tailored for consultants and agencies. It combines professional trading journal analytics (Equity Curve, PnL, Win Rate, Accounts Receivable) with a case/project operating diary featuring a minimalist dark UI with electric purple accents."
   - Lines 12-13 (R1): Native macOS desktop shell with embedded SQLCipher/Rusqlite database engine encrypted at rest using AES-256-GCM, Argon2id master password, Touch ID / Keychain integration, and auto-lock.
   - Lines 15-20 (R2): Relational model with multi-currency consolidation, income/expense categorization, case lifecycle (Leads, Quotations, Active Projects, Completed, Lost) with project PnL, and executive metrics (Equity Curve, Win Rate, Avg Ticket, Realized vs Invoiced Volume, AR aging).
   - Lines 22-28 (R3): High-density minimalist dark UI (`#09090b` obsidian theme with `#8B5CF6` electric purple accents, Geist Mono / Inter typography), 4 core views (Executive Dashboard, Financial Blotter, Case Pipeline, Operations Journal), and keyboard shortcuts (`Cmd+K`, `Cmd+N`, `1-4`, `Cmd+\`).
   - Lines 30-31 (R4): 1-click encrypted `.vault` backup/restore and standard CSV/Excel audit exports.
   - Lines 33-52: 10 explicit acceptance criteria covering Security & Storage, Financial Calculations & Accuracy, UI & Performance, and Backup & Export.

2. **Dispatch Assignment (`/Users/nuevo/apex_journal/.agents/survey_spec_miner_3/DISPATCH.md`)**:
   - Lines 12-28: Specified four critical areas of investigation: (1) Design System & Theming tokens, (2) 4 Core Views architecture and state transitions, (3) Keyboard velocity engine and global shortcut routing, and (4) Acceptance criteria mapping to testable verification steps.

3. **Workspace State**:
   - The workspace root `/Users/nuevo/apex_journal` contains `.agents/` metadata directory and is prepared for architecture design and builder implementation.

---

## 2. Logic Chain

1. **From Observation 1 (R1 & R3) to Design Token Architecture**:
   - The requirement for an OLED dark trading journal requires an obsidian base canvas (`#09090b`), layered dark card surfaces (`#121216` to `#272732`), and electric purple primary accents (`#8B5CF6`).
   - Financial figures require zero-jitter tabular vertical alignment, dictating `Geist Mono` (`font-variant-numeric: tabular-nums`) for currency amounts, dates, and blotter cells, paired with `Geist` or `Inter` for general interface elements.

2. **From Observation 1 (R2 & R3) to 4 Core Views Specification**:
   - *Executive Dashboard*: Must provide 4 high-density KPI cards (Cumulative Net Margin, Win Rate, Realized Volume, Avg Ticket), a composite Recharts line/bar chart for Equity Curve with 1W/1M/3M/1Y/ALL timeframes, and a 3-bucket AR aging traffic-light widget (0-30d Current, 31-60d Pending, >60d Overdue).
   - *Financial Blotter*: Must provide an institutional-grade data table with multi-currency conversion display, multi-column filtering (Category, Status, Date, Case, Currency), inline cell editing, quick status toggling, and sticky bottom balance totals.
   - *Case Pipeline*: Must provide a 5-column Kanban board (Leads, Quotations, Active Projects, Completed, Lost) paired with a slide-over Case Detail drawer featuring a real-time project PnL header, milestones checklist, and project diary.
   - *Operations Journal*: Must provide a date-grouped feed of operating notes, a live-preview Markdown editor, case hashtag linking, and a distraction-free Zen Mode (`Cmd+\`) that collapses surrounding panels.

3. **From Observation 1 (R3) to Keyboard Velocity Engine**:
   - Power users require seamless keyboard operation: `Cmd+K` for a Raycast-style command palette, `Cmd+N` for a modal quick-capture form, numeric keys `1-4` for instant tab switching (guarded to prevent triggering while typing in input fields), `Cmd+\` for Zen mode toggle, and `Cmd+L` for instant vault lock.

4. **From Observation 1 (Acceptance Criteria) to Verification Matrix**:
   - All 10 acceptance criteria from `ORIGINAL_REQUEST.md` have been mapped to 10 concrete, testable UI/UX test scenarios with explicit expected observable behaviors and edge cases.

---

## 3. Caveats

- **Native macOS Titlebar Styling**: Tauri v2 titlebar customization on macOS requires `titleBarStyle: Overlay` with a left padding offset (`pl-20`) in CSS to prevent content from overlapping native window traffic light controls.
- **Floating-Point Arithmetic**: While UI rendering displays formatted monetary strings (e.g. `$4,882.50`), underlying calculations must use integer cents/basis points or Rust `rust_decimal` in the backend engine to prevent floating-point inaccuracies.
- **No other caveats**: All design tokens, component hierarchies, views, keyboard shortcuts, and acceptance criteria have been comprehensively specified.

---

## 4. Conclusion

Survey Spec Miner 3 has extracted an exhaustive, high-density UI/UX and interaction specification for ApexJournal. The specification is fully documented in `/Users/nuevo/apex_journal/.agents/survey_spec_miner_3/spec_report.md`, featuring:
1. Complete Obsidian (`#09090b`) & Electric Purple (`#8B5CF6`) color token system and typography scale.
2. Complete component hierarchy and layout tree from AppRoot to Modals.
3. Detailed specifications and state models for all 4 Core Views (Dashboard, Blotter, Pipeline, Journal).
4. Keyboard velocity engine with full shortcut matrix (`Cmd+K`, `Cmd+N`, `1-4`, `Cmd+\`, `Cmd+L`).
5. Comprehensive Features Discovered table (31 features) and Edge Cases table (20 edge cases).
6. 10-point Acceptance Criteria Verification Mapping.

---

## 5. Verification Method

To independently verify this specification:
1. **Inspect Spec Report**:
   ```bash
   view_file /Users/nuevo/apex_journal/.agents/survey_spec_miner_3/spec_report.md
   ```
2. **Verify Design Token Coverage**:
   - Confirm `--bg-app: #09090b`, `--accent-primary: #8b5cf6`, and semantic PnL colors (`#10b981`, `#ef4444`, `#f59e0b`) are defined.
   - Confirm font families specify `Geist Mono` / `Inter`.
3. **Verify 4 Core Views**:
   - Confirm Executive Dashboard defines Equity Curve, 1W/1M/3M/1Y/ALL selectors, KPI cards, and AR traffic-light widget.
   - Confirm Financial Blotter defines high-density table, inline editing, multi-currency conversion, and summary footer.
   - Confirm Case Pipeline defines 5 Kanban stages and Case Detail PnL drawer.
   - Confirm Operations Journal defines split Markdown editor and `Cmd+\` Zen Mode.
4. **Verify Keyboard Navigation**:
   - Confirm `Cmd+K`, `Cmd+N`, `1-4`, `Cmd+\`, `Cmd+L`, and `Escape` behaviors are mapped.
5. **Verify Acceptance Criteria**:
   - Cross-check the 10 acceptance criteria in Section 5 of `spec_report.md` against lines 33-52 of `/Users/nuevo/apex_journal/.agents/ORIGINAL_REQUEST.md`.
