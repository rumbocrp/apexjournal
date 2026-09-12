# Test Infrastructure & Verification Architecture: ApexJournal

## 1. Executive Summary

ApexJournal utilizes an independent, opaque-box, 4-tier E2E testing framework engineered to rigorously verify all functional, security, mathematical, and real-world performance contracts defined in `ORIGINAL_REQUEST.md` and `PROJECT.md`.

The test infrastructure operates independently of implementation internals, evaluating the system exclusively through its external IPC interfaces (Tauri v2 invoke commands), cryptographic disk artifacts, and mathematical oracles.

---

## 2. Directory Layout

```
/Users/nuevo/apex_journal/
├── tests/
│   ├── e2e_runner.sh                 # Master executable test runner (Bash + ANSI formatting)
│   ├── runner.js                     # CLI Node test execution engine
│   ├── harness/
│   │   ├── index.js                  # Unified harness export
│   │   ├── framework.js              # BDD assertions (describe, test, expect, deepEqual)
│   │   ├── oracle.js                 # Authoritative mathematical and cryptographic reference
│   │   ├── ipc_bridge.js             # Tauri IPC contract invoker & simulation engine
│   │   └── test_db_manager.js        # Isolated temporary database lifecycle manager
│   ├── tier1_feature_tests/          # Feature Coverage (>=5 tests per feature)
│   │   ├── 01_vault_setup_test.js
│   │   ├── 02_vault_unlock_test.js
│   │   ├── 03_bad_password_test.js
│   │   ├── 04_autolock_test.js
│   │   ├── 05_disk_encryption_entropy_test.js
│   │   ├── 06_transactions_crud_test.js
│   │   ├── 07_multicurrency_test.js
│   │   ├── 08_case_pnl_test.js
│   │   ├── 09_equity_curve_test.js
│   │   ├── 10_win_rate_test.js
│   │   ├── 11_ar_aging_test.js
│   │   ├── 12_vault_backup_restore_test.js
│   │   └── 13_csv_export_test.js
│   ├── tier2_boundary_tests/         # Boundary & Corner Cases (>=5 tests per feature)
│   │   ├── 01_zero_division_winrate_test.js
│   │   ├── 02_empty_database_test.js
│   │   ├── 03_leap_year_dates_test.js
│   │   ├── 04_extreme_amounts_test.js
│   │   ├── 05_corrupted_backup_test.js
│   │   └── 06_memory_zeroization_test.js
│   ├── tier3_pairwise_tests/         # Cross-Feature Pairwise Interactions
│   │   ├── 01_tx_to_case_pnl_equity_sync_test.js
│   │   ├── 02_stage_change_to_winrate_sync_test.js
│   │   ├── 03_backup_restore_data_integrity_test.js
│   │   ├── 04_multicurrency_ar_equity_sync_test.js
│   │   └── 05_milestone_invoiced_volume_sync_test.js
│   └── tier4_workload_tests/         # Real-World Consulting Workload Scenarios
│       ├── 01_digital_agency_annual_lifecycle_test.js
│       ├── 02_freelance_consultant_velocity_test.js
│       ├── 03_crisis_recovery_restructuring_test.js
│       ├── 04_disaster_recovery_migration_test.js
│       └── 05_intensive_operating_diary_test.js
├── TEST_INFRA.md                     # Test infrastructure specification
└── TEST_READY.md                     # Formal test suite signoff and readiness declaration
```

---

## 3. Four-Tier Testing Methodology

### Tier 1: Feature Coverage (>=5 test cases per feature)
Verifies individual functional requirements in isolation against contract specifications:
1. **Vault Setup**: Initialization with Argon2id salt generation, minimum password length enforcement, duplicate setup prevention, default chart of accounts initialization.
2. **Vault Unlock**: Successful password unlock, status reflection, biometric unlock mock bridge, activity timestamp updating.
3. **Bad Password Rejection**: Rejection of incorrect passwords, truncated passwords, casing differences, symbol variations, persistent locked state post-failure.
4. **Auto-Lock & Session Inactivity**: Dropping decrypted key on manual lock or inactivity timeout, query failure rejection while locked, seamless re-unlock flow.
5. **Disk Encryption Binary Entropy**: Byte-level Shannon entropy calculation ($H > 7.90$ bits/byte), verification of absence of SQLite header magic bytes (`SQLite format 3\000`), absence of plaintext leakage in ciphertext.
6. **Transactions CRUD**: Creating Income/Expense movements, inline editing amounts and statuses, deletion, multi-column and text filtering.
7. **Multi-Currency System**: Accurate conversion to base currency using FX rates (USD, EUR, GBP, JPY with 0 decimals), rejection of non-positive exchange rates.
8. **Case PnL**: Realized income, expense, and net margin calculation per case, profit margin percentage computation.
9. **Equity Curve Series**: Daily delta and running cumulative cash flow series aggregation, timeframe filtering (1W, 1M, 3M, 1Y, ALL).
10. **Proposal Win Rate**: Formula $(Won / TotalClosed) \times 100$, verification of open proposal exclusion.
11. **Accounts Receivable Aging**: 4-bucket schedule (0-30d, 31-60d, 61-90d, 90+d), traffic-light indicators (GREEN, YELLOW, RED).
12. **Encrypted .vault Backup/Restore**: AES-256-GCM container export, clean restoration into fresh instances, corrupted tag rejection.
13. **CSV Export**: Standard CSV formatting with escaped quotes and commas for transactions, cases, and journal entries.

### Tier 2: Boundary & Corner Cases (>=5 test cases per feature)
Stress tests extreme numerical, temporal, and failure conditions:
1. **0-Division Win Rate**: Handles 0 closed proposals, all leads, or all active cases gracefully returning `0.0%` without `NaN` or `Infinity`.
2. **Empty Database Operations**: Clean zero-state metrics across dashboard, empty equity curve array, zero-receivable AR schedule.
3. **Leap Years & Date Boundaries**: Transactions on Feb 29 leap years, Dec 31 to Jan 01 turnover, timezone offsets.
4. **Extreme Amounts & Precision**: Sub-cent micro amounts ($0.01), billions ($999,999,999,999.99), floating point sum precision ($0.10 + 0.20 = 0.30$).
5. **Corrupted Backup Rejection**: Truncated payloads, invalid magic bytes, tampered IV, tampered ciphertext bits.
6. **Memory Zeroization**: `zeroize::Zeroizing` byte wipe verification, memory drop on vault lock.

### Tier 3: Cross-Feature Pairwise Interactions
Validates state synchronization across multiple subsystems:
1. **Transaction -> Case PnL & Equity Curve Sync**: Real-time margin update on transaction add/edit/delete.
2. **Stage Change -> Win Rate Sync**: Advancing cases across Kanban stages immediately updates executive KPIs.
3. **Backup Restore -> Full Data Integrity**: Export, wipe, restore, and 100% bitwise parity check of all analytics and relational models.
4. **Multi-Currency AR Aging -> Equity Curve**: Unpaid foreign invoices tracked in AR until cleared, then advancing equity curve.
5. **Milestone Completion -> Invoiced Volume Sync**: Milestone checklist completion updating invoiced vs realized volumes.

### Tier 4: Real-World Consulting Workload Scenarios
Validates end-to-end multi-month agency lifecycles:
1. **Multi-National Digital Agency Annual Lifecycle**: 12-month agency operations with 5 clients in USD, EUR, GBP, monthly retainers, overhead expenses, equity curve trends.
2. **High-Velocity Freelance Strategy Consultant**: Rapid 10-proposal pitching, 70% win rate, fast milestone invoicing.
3. **Crisis Recovery & Restructuring Engagement**: Scope creep overrun, negative project margin, delayed invoice payment entering critical 90+d red bucket, emergency change order recovery.
4. **Full System Disaster Recovery & Migration**: 6-month operating instance export, complete machine wipe, restore on new machine with zero data loss.
5. **Intensive Operating Diary & Case Audit Trail**: Multi-stage case with 25+ rich Markdown entries, tag indexing, search queries, and CSV export.

---

## 4. Execution Commands

### Run Full Test Suite (All 4 Tiers)
```bash
./tests/e2e_runner.sh
```

### Run Specific Test Tier
```bash
node tests/runner.js --tier=1
node tests/runner.js --tier=2
node tests/runner.js --tier=3
node tests/runner.js --tier=4
```

### Run Individual Test File
```bash
node tests/runner.js 01_vault_setup_test.js
node tests/runner.js 08_case_pnl_test.js
```

---

## 5. Mathematical & Cryptographic Oracles

### Shannon Entropy Formula
$$H(X) = -\sum_{i=0}^{255} p_i \log_2(p_i)$$
Where $p_i$ is the empirical frequency of byte value $i$. Unencrypted plaintext has $H \approx 3.5 - 5.0$. SQLCipher AES-256 encrypted storage produces $H > 7.90$ bits/byte.

### Case Net Margin & Profit Margin
$$\text{Realized Income} = \sum_{t \in \text{Cleared Income}} \text{BaseAmount}(t)$$
$$\text{Realized Expense} = \sum_{t \in \text{Cleared Expense}} \text{BaseAmount}(t)$$
$$\text{Net Margin} = \text{Realized Income} - \text{Realized Expense}$$
$$\text{Profit Margin \%} = \begin{cases} \frac{\text{Net Margin}}{\text{Realized Income}} \times 100 & \text{if Realized Income} > 0 \\ 0.0 & \text{otherwise} \end{cases}$$

### Cumulative Equity Curve Series
$$\Delta E(d) = \sum_{t \in \text{Income}(d)} \text{BaseAmount}(t) - \sum_{t \in \text{Expense}(d)} \text{BaseAmount}(t)$$
$$E(d) = \sum_{k \le d} \Delta E(k)$$

### Proposal Win Rate
$$\text{Win Rate \%} = \begin{cases} \frac{|\text{Cases with stage}=\text{COMPLETED}|}{|\text{Cases with stage} \in \{\text{COMPLETED}, \text{LOST}\}|} \times 100 & \text{if Closed Cases} > 0 \\ 0.0 & \text{if Closed Cases} = 0 \end{cases}$$
