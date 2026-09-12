# ApexJournal UI/UX & Interaction Specification Report

**Document ID:** SPEC-SURVEY-MINER-03  
**Target Platform:** macOS Desktop (Tauri v2 + Rust + React/TypeScript)  
**Theme:** Minimalist Dark Obsidian (`#09090b`) with Electric Purple (`#8B5CF6`) accents  
**Typography:** Geist Mono (financial/blotter/metrics) & Geist/Inter (UI/body)  
**Integrity Mode:** Development  
**Date:** 2026-08-30  

---

## Executive Summary

ApexJournal is a local-first, AES-256 encrypted desktop operating and financial journal for macOS tailored for consultants, freelancers, and specialized agencies. This specification defines the complete UI/UX design tokens, component hierarchy, interactive states, the 4 core views (Executive Dashboard, Financial Blotter, Case Pipeline, Operations Journal), the keyboard velocity engine (`Cmd+K`, `Cmd+N`, `1-4`, `Cmd+\`), and an exhaustive acceptance criteria verification matrix.

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Design System | Obsidian & Electric Purple Palette | OLED dark theme with #09090b canvas, #121216 surface cards, #8B5CF6 primary electric purple accents, and semantic PnL indicators | CSS variables, Tailwind classes | Consistent high-contrast dark theme across all views | Fallback to dark zinc if token missing | ORIGINAL_REQUEST R3, ui-ux-pro-max |
| 2 | Design System | Dual-Typography Hierarchy | Geist Mono for financial blotters, numeric tables, currency, dates, and code; Geist/Inter for interface text, headers, and navigation | Font families, CSS font classes | Clean typography rendering on Retina displays | Fallback to system sans/mono font stack | ORIGINAL_REQUEST R3 |
| 3 | Shell & Layout | Native macOS Window Shell & Sidebar | macOS styled window with custom traffic light offset, collapsible sidebar with 4 core views, vault lock status indicator, and quick-access settings | Mouse click, keyboard 1-4, resize events | Responsive layout with persistent navigation | Window min size constraints (960x640px) | ORIGINAL_REQUEST R1/R3 |
| 4 | Shell & Layout | Status Bar & Security Indicator | Bottom bar showing active encryption status (AES-256), Base Currency indicator, and keyboard shortcuts legend | System vault status, currency store | Visual badge (Locked/Unlocked/Encrypted), sync status | Red warning badge if database locked/error | ORIGINAL_REQUEST R1 |
| 5 | View 1: Dashboard | KPI Metric Cards (4 Cards) | High-density metric display: Cumulative Net Margin (PnL), Proposal Win Rate (%), Realized vs Invoiced Volume, and Average Ticket | Aggregated transaction & case store | 4 KPI cards with trend indicators and sparklines | Shows zero-state ($0.00 / 0%) when database is empty | ORIGINAL_REQUEST R2/R3 |
| 6 | View 1: Dashboard | Interactive Equity Curve Chart | Line series plotting cumulative net cash flow over time with purple gradient fill and zero-baseline indicator | Transaction dates and net amounts | Interactive Recharts line chart with hover tooltips | Graceful flat line at 0 for empty records | ORIGINAL_REQUEST R2/R3 |
| 7 | View 1: Dashboard | Timeframe Selectors (1W/1M/3M/1Y/ALL) | Time-filter button group to slice the Equity Curve and Monthly PnL data points | User click / keyboard selection | Re-renders chart data window dynamically | Resets to ALL if selected timeframe has no data | ORIGINAL_REQUEST R3 |
| 8 | View 1: Dashboard | Monthly PnL Volume Bars | Bar chart series underneath equity curve displaying monthly net income (Green for positive, Red for negative) | Monthly aggregated cash flow | Color-coded vertical bars with net margin amounts | Neutral gray bar if net is exactly $0 | ORIGINAL_REQUEST R3 |
| 9 | View 1: Dashboard | Accounts Receivable (AR) Traffic-Light Widget | 3-bucket aging breakdown of outstanding client invoices: Current (0-30d), Pending (31-60d), Overdue (>60d) | Unpaid transaction dates & case invoices | Color-coded cards (Green/Amber/Red) with amounts | Green state (zero overdue) when all invoices cleared | ORIGINAL_REQUEST R2/R3 |
| 10 | View 2: Blotter | High-Density Financial Blotter Table | Virtualized/paginated tabular journal for income and expense movements with multi-currency conversion | Database transaction records | Formatted tabular rows with aligned monetary amounts | Truncates text with tooltip on narrow columns | ORIGINAL_REQUEST R2/R3 |
| 11 | View 2: Blotter | Multi-Column Filtering & Search | Real-time filtering by Category, Date range, Status (Cleared/Pending/Void), Currency, and linked Case | Search string, filter dropdowns | Filtered row list with matched record count badge | "No matching transactions found" empty state | ORIGINAL_REQUEST R3 |
| 12 | View 2: Blotter | Inline Cell Editing | Direct table cell editing for description, category, original amount, and date | Double-click or Enter on selected cell | Inline input field, auto-saves to SQLCipher on blur/Enter | Reverts to original value on Escape; validation error on invalid number | ORIGINAL_REQUEST R3 |
| 13 | View 2: Blotter | Quick Status Toggles | One-click or hotkey toggle to cycle transaction status (Cleared -> Pending -> Void) | Click on status badge | Color-coded status badge transition (Green/Amber/Zinc) | Prevents invalid transitions; prompts on Void | ORIGINAL_REQUEST R3 |
| 14 | View 2: Blotter | Multi-Currency Conversion Display | Displays original currency amount and calculated base currency consolidation using stored exchange rate | Original currency, fx rate, base currency | E.g. "€4,500.00 EUR (→ $4,882.50 USD @ 1.085)" | Highlights missing FX rate with warning icon | ORIGINAL_REQUEST R2 |
| 15 | View 2: Blotter | Sticky Summary Footer Bar | Bottom summary bar showing Total Inflows (+), Total Outflows (-), Net Blotter Margin, and row count | Filtered table dataset | Real-time consolidated sums in base currency | Updates synchronously as filters change | ORIGINAL_REQUEST R2/R3 |
| 16 | View 3: Pipeline | 5-Stage Kanban Board | Visual columns: Leads, Quotations, Active Projects, Completed, Lost | Case database records | Kanban cards grouped into stage columns with stage counts | Prevents invalid drops; preserves order | ORIGINAL_REQUEST R2/R3 |
| 17 | View 3: Pipeline | Case Card Summary | High-density card with Case Title, Client, Contract Value, Realized PnL pill, Milestone progress bar, Due Date | Case metadata & linked financial records | Interactive draggable card with hover glow | Truncates long client names with tooltip | ORIGINAL_REQUEST R3 |
| 18 | View 3: Pipeline | Case Detail Drawer / Modal | Deep-dive drawer displaying Project PnL header, Milestones table, and Case Diary | Click on case card or Cmd+K jump | Slide-over drawer with financial metrics & milestones | Error toast if case ID not found | ORIGINAL_REQUEST R3 |
| 19 | View 3: Pipeline | Project PnL Header | Real-time case margin calculation: Invoiced Value, Received Income, Incurred Expenses, Net Profit Margin (%) | Case-linked transactions | Header banner with margin badge (e.g. "+$21,500 [71.6%]") | Red margin badge if expenses exceed income | ORIGINAL_REQUEST R2/R3 |
| 20 | View 3: Pipeline | Milestones Checklist & Billing Table | Interactive milestones with title, deliverable description, due date, status, and linked invoice amount | User input / milestone checklist | Interactive checklist with progress percentage | Validates due date format; highlights overdue milestones | ORIGINAL_REQUEST R3 |
| 21 | View 4: Journal | Chronological Markdown Feed | Date-grouped feed of operating entries, client meeting notes, architecture decisions, and incident logs | Journal database records | Chronological timeline cards with tags and case links | "No entries found" empty state | ORIGINAL_REQUEST R3 |
| 22 | View 4: Journal | Split Live Preview Markdown Editor | Dual-pane or live WYSIWYG markdown editor supporting headers, bold/italic, lists, code blocks, tables, hashtags | Markdown text input | Real-time formatted HTML preview with syntax highlight | Displays markdown parse errors gracefully | ORIGINAL_REQUEST R3 |
| 23 | View 4: Journal | Zen Mode (`Cmd+\`) | Distraction-free full-screen editor hiding sidebars, header controls, and status bars | Keyboard `Cmd+\` or Zen button | Centered, distraction-free markdown canvas | Pressing Escape or `Cmd+\` restores full UI | ORIGINAL_REQUEST R3 |
| 24 | View 4: Journal | Case Linking & Tagging System | Link journal entries to specific Cases (`#case-id`) or tags (`#architecture`, `#strategy`) | Tag chips, case selector | Clickable tags that filter feed or jump to Case Detail | Unmatched tag creates new tag token | ORIGINAL_REQUEST R3 |
| 25 | Velocity Engine | Raycast-style Command Palette (`Cmd+K`) | Fast searchable modal overlay to jump to views, search cases/transactions, and trigger actions | `Cmd+K` / `Ctrl+K` keystroke, search query | Filtered action/navigation list with keyboard selection | Esc closes modal; no results shows "No matching actions" | ORIGINAL_REQUEST R3 |
| 26 | Velocity Engine | Quick-Capture Modal (`Cmd+N`) | Fast overlay modal to log a Transaction, Case Note, or Lead from anywhere without losing context | `Cmd+N` / `Ctrl+N` keystroke | Tabbed quick-entry form with keyboard focus | Validates required fields before saving; red highlight on error | ORIGINAL_REQUEST R3 |
| 27 | Velocity Engine | Numeric View Navigation (`1-4`) | Direct hotkey switching between 1 (Dashboard), 2 (Blotter), 3 (Pipeline), 4 (Journal) | Keys `1`, `2`, `3`, `4` when not typing in text input | Instant view transition (<16ms) without re-fetching lag | Ignored when user is focused inside input/textarea/editor | ORIGINAL_REQUEST R3 |
| 28 | Backup & Export | 1-Click Encrypted .vault Backup | Export entire encrypted SQLCipher database + salt to single portable `.vault` file | User click / Command Palette | Native file save dialog for `.vault` archive | Error modal if disk write fails or encryption key invalid | ORIGINAL_REQUEST R4 |
| 29 | Backup & Export | 1-Click .vault Restore | Restore encrypted `.vault` archive into fresh application instance | User file selection & master password | Complete state restoration with schema validation | Error prompt if file is corrupt or password incorrect | ORIGINAL_REQUEST R4 |
| 30 | Backup & Export | CSV & Excel Audit Data Export | Clean tabular export of Blotter transactions and Case records with headers and full decimal precision | Export button / Command Palette | Generates valid `.csv` / `.xlsx` files with UTF-8 encoding | Handles special characters and commas in descriptions | ORIGINAL_REQUEST R4 |
| 31 | Security & Session | Auto-Lock & Session Inactivity Lock | Configurable timeout timer that locks database state and clears decrypted memory | Inactivity timer (e.g. 5m, 15m, 30m) or `Cmd+L` | Blurs UI and presents Master Password / Touch ID lock screen | Invalid password displays shake animation & error | ORIGINAL_REQUEST R1 |

---

## Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | Global Palette & Theming | High-contrast OLED dark mode in sunlight | The obsidian `#09090b` canvas paired with `#8B5CF6` electric purple and `#FAFAFA` high-contrast text ensures WCAG AAA contrast ratio (>7:1) for all critical text. |
| 2 | Typography | Long numeric financial values (e.g. `$1,450,890,234.50`) in Blotter | Geist Mono font uses tabular lining figures (`font-variant-numeric: tabular-nums`) so numbers align vertically across all rows without jitter. |
| 3 | KPI Cards | Zero transactions or cases in database (fresh install) | Displays `$0.00` Net Margin, `0.0%` Win Rate, `$0.00` Realized Volume, and `N/A` Avg Ticket with a helpful "Log your first transaction" prompt. |
| 4 | Equity Curve | All transactions are expenses (negative cumulative cash flow) | Equity curve line draws below the zero-baseline with subtle red/purple shade; Y-axis automatically spans negative range (e.g. `-$5,000` to `$0`). |
| 5 | Equity Curve | Timeframe selector `1W` selected, but no transactions in last 7 days | Chart displays flat cumulative equity line extending the last known cumulative balance across the 7-day window. |
| 6 | Proposal Win Rate | Zero closed proposals (all cases currently in Leads or Active Projects) | Win Rate card shows `— %` or `0% (0/0 closed)` instead of dividing by zero / throwing NaN. |
| 7 | AR Aging Widget | Invoice exactly 30 days old vs 31 days old | Boundary condition: 30 days is categorized into `🟢 Current (0-30d)`; 31 days immediately flips to `🟡 Pending (31-60d)`. |
| 8 | Blotter Multi-Currency | Transaction entered in JPY (`¥500,000`) converted to USD base currency | Displays original currency `¥500,000 JPY` with 0 decimal places, conversion rate `0.0068`, and base amount `$3,400.00 USD` formatted with 2 decimal places. |
| 9 | Blotter Inline Editing | User enters non-numeric text (e.g. `abc`) into Amount column | Input border flashes red `#EF4444`, displays tooltip "Invalid currency amount", and prevents saving until corrected or discarded with `Escape`. |
| 10 | Blotter Inline Editing | User presses `Tab` while editing a cell in row 5, column 3 | Automatically saves current cell, shifts focus to row 5, column 4 in edit mode. If on last column, shifts to row 6, column 1. |
| 11 | Kanban Drag & Drop | Dragging a Case from `Quotations` to `Completed` directly | Calculates case as a Won Proposal; prompts user if all contract milestones should be marked completed and whether final invoice should be logged in Blotter. |
| 12 | Kanban Drag & Drop | Dragging a Case from `Quotations` to `Lost` | Updates stage to Lost, recalculates Proposal Win Rate denominator, and logs status change in Case diary. |
| 13 | Operations Journal | Extremely long Markdown document (>50,000 words with code blocks & tables) | Live preview uses debounced virtualized rendering to prevent UI thread lock; scrolling remains fluid at 60fps. |
| 14 | Operations Journal | Zen Mode (`Cmd+\`) activated while editing | Sidebars, top titlebar navigation, and status bar animate out (150ms ease-out); editor centers in `max-w-3xl` container; pressing `Escape` or `Cmd+\` restores UI instantly. |
| 15 | Keyboard Shortcuts | User types `1`, `2`, `3`, or `4` while typing text inside an Input or Textarea | Global shortcut handler checks `document.activeElement.tagName`; if `INPUT`, `TEXTAREA`, or `contenteditable`, keypress inputs character normally and does NOT trigger view navigation. |
| 16 | Command Palette (`Cmd+K`) | User opens `Cmd+K`, types `inv 4000`, presses `Enter` | Command Palette fuzzy matches "New Invoice / Income Transaction: $4,000", opens Quick-Capture modal with Amount prefilled to `$4,000.00`. |
| 17 | Quick-Capture Modal (`Cmd+N`) | User presses `Cmd+N` while already inside Quick-Capture modal | Modal ignores duplicate `Cmd+N` keystroke; does not create stacked modal instances. |
| 18 | Auto-Lock & Session | Auto-lock triggers while user is editing an unsaved Markdown entry | System automatically flushes debounced state to encrypted SQLCipher before encrypting memory and displaying the master password lock overlay. |
| 19 | Vault Backup Export | Database contains special Unicode characters, emojis in Markdown, and multi-currency symbols | `.vault` encrypted binary backup preserves 100% byte integrity; CSV export uses UTF-8 BOM encoding for seamless Excel compatibility. |
| 20 | Window Resizing | User resizes macOS window to minimum supported size (960x640px) | Layout switches to compact mode: Sidebar collapses to icons only (64px), KPI cards wrap into 2x2 grid, Blotter table enables horizontal scroll with sticky primary columns. |

---

## Detailed UI/UX Specifications

### 1. Obsidian & Electric Purple Design Tokens

#### 1.1 Color Tokens
```css
:root {
  /* Surface & Background (Obsidian Theme) */
  --bg-app: #09090b;             /* Base Obsidian Canvas */
  --bg-sidebar: #0c0c0f;         /* Sidebar / Navigation surface */
  --bg-card: #121216;            /* Primary elevated card surface */
  --bg-card-hover: #18181d;      /* Card / Table row hover state */
  --bg-modal: #1e1e24;           /* Modal / Popover / Command Palette */
  --bg-input: #141418;           /* Input field background */
  --bg-active: #272732;          /* Selected row / active pill background */

  /* Primary Accent (Electric Purple) */
  --accent-primary: #8b5cf6;       /* Violet-500: Electric Purple */
  --accent-primary-hover: #a78bfa; /* Violet-400: Lighter hover state */
  --accent-primary-active: #7c3aed;/* Violet-600: Deep pressed state */
  --accent-glow: rgba(139, 92, 246, 0.25);
  --accent-subtle: rgba(139, 92, 246, 0.12);

  /* Semantic Financial Colors */
  --pnl-positive: #10b981;         /* Emerald-500: Profit / Inflow / Won */
  --pnl-positive-glow: rgba(16, 185, 129, 0.20);
  --pnl-positive-bg: rgba(16, 185, 129, 0.10);
  
  --pnl-negative: #ef4444;         /* Red-500: Loss / Outflow / Lost */
  --pnl-negative-glow: rgba(239, 68, 68, 0.20);
  --pnl-negative-bg: rgba(239, 68, 68, 0.10);
  
  --ar-pending: #f59e0b;           /* Amber-500: Pending / 30-60d aging */
  --ar-pending-bg: rgba(245, 158, 11, 0.10);

  --info-cyan: #06b6d4;            /* Cyan-500: Active Project / Milestone */
  --info-cyan-bg: rgba(6, 182, 212, 0.10);

  /* Borders & Dividers */
  --border-subtle: #27272a;       /* Zinc-800: Subtle card border */
  --border-default: #3f3f46;      /* Zinc-700: Interactive component border */
  --border-focus: #8b5cf6;        /* Electric Purple focus ring */

  /* Text & Typography Hierarchy */
  --text-primary: #fafafa;         /* Zinc-50: High-contrast headings & numbers */
  --text-secondary: #a1a1aa;       /* Zinc-400: Body & secondary labels */
  --text-tertiary: #71717a;        /* Zinc-500: Microcopy, timestamps, shortcuts */
  --text-disabled: #52525b;        /* Zinc-600: Inactive states */
}
```

#### 1.2 Tailwind Configuration Token Map
```js
// tailwind.config.js snippet
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        obsidian: {
          950: '#09090b',
          900: '#0c0c0f',
          850: '#121216',
          800: '#18181d',
          750: '#1e1e24',
          700: '#272732',
        },
        electric: {
          purple: '#8B5CF6',
          'purple-light': '#A78BFA',
          'purple-dark': '#7C3AED',
          'purple-glow': 'rgba(139, 92, 246, 0.25)',
        },
        pnl: {
          green: '#10B981',
          red: '#EF4444',
          amber: '#F59E0B',
          cyan: '#06B6D4',
        }
      },
      fontFamily: {
        sans: ['Geist', 'Inter', '-apple-system', 'sans-serif'],
        mono: ['Geist Mono', 'JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        'electric-glow': '0 0 15px -3px rgba(139, 92, 246, 0.3)',
        'pnl-glow': '0 0 12px -2px rgba(16, 185, 129, 0.25)',
        'card-subtle': '0 1px 3px 0 rgba(0, 0, 0, 0.4), 0 1px 2px -1px rgba(0, 0, 0, 0.4)',
      }
    }
  }
}
```

---

### 2. Global Component Hierarchy & App Shell

```
AppRoot (Tauri Shell + Global Contexts)
├── AuthLockProvider (Argon2id Vault State / Inactivity Timer)
├── CurrencyProvider (Base Currency: USD/EUR/GBP/etc., FX Store)
├── KeyboardNavigationProvider (Cmd+K, Cmd+N, 1-4, Cmd+\, Cmd+L)
│
├── TitleBar (macOS Traffic Light Inset + Title + Vault Status Badge)
│
├── AppLayout (Flex container: h-screen w-screen overflow-hidden bg-obsidian-950)
│   ├── NavigationSidebar (w-[220px] bg-obsidian-900 border-r border-zinc-800)
│   │   ├── BrandLogo (ApexJournal with purple pulse dot)
│   │   ├── NavItemList
│   │   │   ├── NavItem [1] Executive Dashboard (LayoutDashboard icon)
│   │   │   ├── NavItem [2] Financial Blotter (Receipt / Table icon)
│   │   │   ├── NavItem [3] Case Pipeline (Kanban / Briefcase icon)
│   │   │   └── NavItem [4] Operations Journal (BookOpen icon)
│   │   └── SidebarFooter
│   │       ├── VaultStatusChip (Encrypted / Auto-lock timer)
│   │       ├── BackupRestoreButton (ArrowDownUp icon)
│   │       └── SettingsTriggerButton (Sliders icon)
│   │
│   ├── MainContentArea (flex-1 overflow-y-auto bg-obsidian-950 p-6)
│   │   ├── [View 1] ExecutiveDashboardView
│   │   ├── [View 2] FinancialBlotterView
│   │   ├── [View 3] CasePipelineView
│   │   └── [View 4] OperationsJournalView
│   │
│   └── StatusBar (h-7 bg-obsidian-900 border-t border-zinc-800 flex items-center px-4)
│       ├── BaseCurrencyBadge ("BASE: USD $")
│       ├── VaultEncryptionBadge ("AES-256-GCM [ACTIVE]")
│       └── ShortcutLegend ("Cmd+K: Palette | Cmd+N: Quick Add | 1-4: Switch | Cmd+\: Zen")
│
└── GlobalModals & Overlays
    ├── CommandPaletteModal (Cmd+K Raycast-style overlay)
    ├── QuickCaptureModal (Cmd+N Transaction/Note/Case capture)
    ├── CaseDetailDrawer (Slide-over project detail & PnL)
    ├── VaultBackupModal (.vault export/import manager)
    └── AutoLockOverlay (Argon2id password unlock prompt)
```

---

### 3. Core View Specifications

#### 3.1 View 1: Executive Dashboard

**Grid Structure:**
- **Row 1 (KPI Performance Metrics - 4 Cards Grid):**
  1. `Cumulative Net Margin (PnL)`: Total Realized Income - Total Realized Expenses. Large Geist Mono font (`text-2xl font-bold font-mono`). Displays net amount in base currency with dynamic color (Green `text-pnl-green` if >= 0, Red `text-pnl-red` if < 0) and percentage margin badge.
  2. `Proposal Win Rate`: `(Won Cases / Total Closed Cases) * 100%`. Large percentage display with subtext indicating `X won / Y closed` and visual circular progress or pill badge.
  3. `Realized vs Invoiced Volume`: Two-tier progress metric comparing actual collected cash vs total invoiced pipeline (e.g. `$148,000 / $185,000 [80.0%]`). Includes horizontal segmented bar.
  4. `Average Ticket (Avg Project Value)`: Average net revenue per completed project with historical period comparison delta.

- **Row 2 (Interactive Equity Curve & Volume Blotter):**
  - **Chart Container:** Recharts / Chart.js responsive container (`h-[340px] bg-obsidian-850 border border-zinc-800 rounded-lg p-4`).
  - **Header Controls:**
    - Chart Title: "Cumulative Equity & Net Cash Flow"
    - Timeframe Selector: Button group `[ 1W | 1M | 3M | 1Y | ALL ]` with active purple pill highlight.
  - **Visual Elements:**
    - Line Series: Running Cumulative Net Equity line in electric purple (`#8B5CF6`, stroke width 2.5px) with subtle gradient area fill (`rgba(139, 92, 246, 0.1)` to transparent).
    - Bar Series: Monthly net cash flow bars positioned along zero baseline (Green `#10B981` above zero, Red `#EF4444` below zero).
    - Interactive Tooltip: Floating dark card (`bg-obsidian-750 border border-zinc-700`) showing Date, Cumulative Balance, Inflow, Outflow, and Net delta in Geist Mono.

- **Row 3 (Accounts Receivable Aging Traffic-Light Widget & Quick Blotter):**
  - **AR Aging Widget (Left Column):**
    - Total Outstanding Balance: Aggregated unpaid invoice amount.
    - 3-Segment Traffic Light Breakdown:
      - 🟢 `Current (0-30 Days)`: Low risk, expected on schedule.
      - 🟡 `Pending (31-60 Days)`: Moderate age, reminder prompt.
      - 🔴 `Overdue (>60 Days)`: High risk, action required highlight.
    - Quick Action List: Top 3 aging invoices with 1-click "Log Payment" or "Send Reminder" triggers.
  - **Recent Financial Activity (Right Column):**
    - High-density list of the 5 most recent transactions with type pill, description, case link, and amount.

---

#### 3.2 View 2: Financial Blotter (Libro Diario)

**Layout & Capabilities:**
- **Blotter Action Bar:**
  - Search Input: Real-time fuzzy filter across Description, Category, Payee, and Linked Case (`w-72 bg-obsidian-900 border border-zinc-800 text-sm`).
  - Filter Controls:
    - `Type`: Segmented toggle `[ All | Income | Expense ]`
    - `Category`: Predefined dropdown (`Consulting Fee`, `Retainer`, `Contractor`, `SaaS`, `Legal/Tax`, `Travel`, `Office/Hardware`, `Marketing`)
    - `Status`: Multi-select `[ Cleared | Pending | Void ]`
    - `Date Range`: Dropdown `[ Today | This Month | This Quarter | YTD | Custom ]`
    - `Case Filter`: Dropdown selector of active cases
  - Quick Actions: `+ New Entry (Cmd+N)`, `Export CSV`, `Export Excel`.

- **High-Density Table Grid (`font-mono text-xs`):**
  - Table Header: Sticky top header with sort indicators on click (Date, Amount, Category).
  - Columns:
    1. `Date`: `YYYY-MM-DD` (Geist Mono, w-24)
    2. `Type`: Pill badge (🟢 `INC` / 🔴 `EXP`, w-16)
    3. `Category`: Categorical pill tag (w-32)
    4. `Description`: Full description with inline edit capability (flex-1)
    5. `Case / Project`: Linked case chip (clickable, opens Case Detail drawer, w-36)
    6. `Original Amount`: Formatted original currency (e.g. `€4,500.00 EUR`, w-28 text-right)
    7. `FX Rate`: Conversion multiplier (e.g. `1.0850`, w-20 text-right text-zinc-400)
    8. `Base Amount`: Consolidated base currency amount (e.g. `$4,882.50 USD`, w-32 text-right font-bold)
    9. `Status`: Interactive pill toggle (🟢 `Cleared` / 🟡 `Pending` / ⚪ `Void`, w-24)
    10. `Actions`: Row action menu (Edit, Clone, Void, Delete, w-16)

- **Inline Editing Interaction:**
  - Double-click any cell or press `Enter` on focused row to activate inline input.
  - Press `Tab` to navigate to the next cell.
  - Press `Enter` to commit edit (triggers encrypted SQLCipher update).
  - Press `Escape` to cancel and discard changes.

- **Sticky Summary Footer:**
  - Real-time calculations for currently filtered dataset:
    - `Total Inflows`: `+$XX,XXX.XX` (Green)
    - `Total Outflows`: `-$XX,XXX.XX` (Red)
    - `Net Cash Flow`: `+$XX,XXX.XX` (Green/Red based on sign)
    - `Filtered Records`: `XXX / YYY entries`

---

#### 3.3 View 3: Case Pipeline & Detail

**Layout & Capabilities:**
- **Pipeline Header:**
  - Pipeline Stats Bar: Total Active Pipeline Value (`$XXX,XXX`), Weighted Value, Active Case Count, Win Rate.
  - Action Button: `+ New Case` (`Cmd+N`).

- **5-Stage Kanban Board:**
  1. `Leads`: Initial prospect, inquiry, discovery call.
  2. `Quotations`: Formal proposal sent, contract negotiation.
  3. `Active Projects`: Proposal accepted, active delivery & milestones.
  4. `Completed`: All milestones delivered, final invoice collected (Won proposal).
  5. `Lost`: Proposal declined or abandoned (Lost proposal).

- **Kanban Card Elements:**
  - Header: Client Name (bold) and Case Title.
  - Contract Value: Highlighted monetary value in base currency (`$15,000`).
  - Realized Margin Pill: `Net: +$8,500 (56.7%)` (calculated dynamically from linked Blotter income and expenses).
  - Milestone Progress Indicator: Mini step progress bar (`3 / 5 milestones`).
  - Target Close / Delivery Date: Due date pill with warning highlight if overdue.
  - Drag-and-drop handles and stage move context menu.

- **Case Detail Drawer (Slide-Over Panel):**
  - **Project PnL Header Banner:**
    - Contract Sum: `$50,000.00`
    - Realized Income: `$30,000.00`
    - Realized Expenses: `$8,500.00`
    - Net Project Margin: `+$21,500.00` (`71.6% profit margin`)
  - **Milestones Section:**
    - Interactive table with Milestone Title, Target Date, Status (`Pending`, `In Progress`, `Completed`, `Billed`), Deliverables checklist, and Linked Billing Amount.
  - **Financial Ledger Section:**
    - Filtered sub-blotter displaying all transactions linked specifically to this case.
  - **Case Diary / Operations Notes:**
    - Dedicated Markdown log for project notes, decisions, and meeting summaries.

---

#### 3.4 View 4: Operations Journal

**Layout & Capabilities:**
- **Feed & Editor Split-View:**
  - **Left Pane (Chronological Feed - w-80 border-r border-zinc-800):**
    - Search Bar and Tag Filter Pills (`#strategy`, `#client`, `#architecture`, `#blocker`).
    - Date-Grouped Entry Cards: Title, linked Case chip, snippet preview, timestamp, word count.
  - **Right Pane (Markdown Editor & Live Preview):**
    - Title Input: High-density borderless title (`text-xl font-bold font-sans text-zinc-100`).
    - Metadata Bar: Date/Time picker, Linked Case dropdown, Tags input.
    - Markdown Toolbar: Quick formatting buttons (H1, H2, Bold, Italic, Bullet List, Task List `[ ]`, Code Block, Table, Link Case).
    - Editor Mode Toggle: `[ Raw Markdown | Split View | Live Preview ]`.
    - Auto-Save Status: "Saved to encrypted vault" indicator with debounce timer.

- **Zen Mode (`Cmd+\`):**
  - When toggled via `Cmd+\`:
    - Collapses Navigation Sidebar (`w-0`) and Journal Feed Pane (`w-0`).
    - Expands editor into centered, distraction-free container (`max-w-3xl mx-auto px-6 py-12`).
    - Hides non-essential toolbars; displays subtle word count and auto-save pill.
    - Pressing `Cmd+\` or `Escape` restores the standard multi-pane layout.

---

### 4. Keyboard Velocity Engine & Global Shortcut Matrix

| Shortcut | Scope | Action | Expected Behavior |
|----------|-------|--------|-------------------|
| `Cmd+K` / `Ctrl+K` | Global | Open Command Palette | Displays centered Raycast-style search modal with fuzzy matching across actions, navigation, cases, and transactions. |
| `Cmd+N` / `Ctrl+N` | Global | Open Quick-Capture Modal | Opens fast entry modal with focus on Transaction/Note/Case tab for immediate keyboard entry. |
| `1` | Global (outside inputs) | Switch to Executive Dashboard | Navigates to Dashboard view with zero lag. |
| `2` | Global (outside inputs) | Switch to Financial Blotter | Navigates to Blotter data table view. |
| `3` | Global (outside inputs) | Switch to Case Pipeline | Navigates to Kanban board view. |
| `4` | Global (outside inputs) | Switch to Operations Journal | Navigates to Markdown journal view. |
| `Cmd+\` / `Ctrl+\` | Operations Journal | Toggle Zen Mode | Collapses sidebars/panes into centered distraction-free editor canvas. |
| `Cmd+L` / `Ctrl+L` | Global | Instant Vault Lock | Immediately clears decrypted state from memory and displays Master Password lock screen. |
| `Escape` | Global | Dismiss / Exit | Closes open modals, clears active search filters, exits inline cell edit, exits Zen mode. |
| `Enter` | Modal / Table | Confirm / Edit | Executes highlighted Command Palette action, submits form, or enters inline cell edit mode. |
| `Tab` / `Shift+Tab` | Forms / Tables | Next / Prev Field | Cycles through form fields or moves to next/previous table cell in Blotter inline editing. |
| `Cmd+Enter` | Quick-Capture / Forms | Save & Close | Validates and commits record to encrypted database, closing the modal. |
| `Shift+Cmd+Enter` | Quick-Capture | Save & Add Another | Commits record and immediately resets form for rapid batch entry. |

---

### 5. Acceptance Criteria Verification Mapping

| Req ID | Acceptance Criterion | Concrete UI/UX Specification & Verification Steps | Expected Observable Behavior |
|--------|----------------------|---------------------------------------------------|------------------------------|
| AC-1 | Encrypted Database at rest | Raw binary inspection of database file on macOS filesystem. | File header is unreadable random ciphertext; contains zero plaintext strings, descriptions, or amounts without master password derivation via Argon2id. |
| AC-2 | Inactivity Auto-Lock & Session Unlock | Configure auto-lock to 1 minute in Settings; leave app idle. | After 60s idle, screen blurs and displays dark Master Password unlock prompt. Entering correct password restores state; entering invalid password displays shake animation and error. |
| AC-3 | Deterministic PnL Calculations | Create 5 income entries ($10,000 total) and 3 expense entries ($3,500 total) across USD, EUR, and GBP. | PnL accurately computes `$10,000 - $3,500 = +$6,500.00` in Base Currency. Multi-currency conversions apply exact stored exchange rates without floating-point drift. |
| AC-4 | Cumulative Equity Curve Accuracy | Add transactions on 5 distinct dates. | Recharts line series accurately renders running cumulative balance at each date milestone, matching the sum of all historical net flows. |
| AC-5 | Proposal Win Rate Metric | Create 10 total cases: 6 Completed (Won), 2 Lost, 2 Active. | Win Rate card calculates `(6 / (6 + 2)) * 100 = 75.0%`. Active cases are excluded from the denominator. |
| AC-6 | Instant 4 Core Views Switching | Press keys `1`, `2`, `3`, `4` in sequence. | App shell transitions between Dashboard, Blotter, Pipeline, and Journal instantly (<16ms frame time) without layout flicker or blank flashes. |
| AC-7 | Keyboard Velocity (Cmd+K, Cmd+N) | Press `Cmd+K` anywhere in app; press `Cmd+N` anywhere in app. | Command Palette and Quick-Capture modals appear immediately with autofocus on primary input field. Esc dismisses both overlays reliably. |
| AC-8 | Markdown Editor & Zen Mode (Cmd+\) | Open Journal, write rich markdown with `# Header`, `**bold**`, `[ ] checkbox`, and code block; press `Cmd+\`. | Split live preview renders formatted HTML with syntax highlighting. Pressing `Cmd+\` enters Zen mode, hiding all sidebars and centering editor. |
| AC-9 | 1-Click Encrypted .vault Backup & Restore | Click "Export Backup (.vault)"; reset local database; click "Restore Backup" and select `.vault` file with master password. | All cases, transactions, journal entries, and settings are restored with 100% data integrity and zero corruption. |
| AC-10 | CSV & Excel Blotter Export | Filter Blotter by "This Quarter" and click "Export CSV". | Generates standard UTF-8 `.csv` file matching table records with correct headers (`Date,Type,Category,Description,Case,OriginalAmount,Currency,FXRate,BaseAmount,Status`) and exact 2-decimal precision. |

---

## Conclusion & Implementation Guidelines

The UI/UX architecture defined above provides a comprehensive, professional, non-generic dark trading journal experience. The combination of `#09090b` obsidian background, `#8B5CF6` electric purple accents, Geist Mono typography, and high-density information architecture satisfies all operational requirements for consultants and agencies while maintaining strict cryptographic security and high keyboard velocity.
