# Milestone 4 Handoff Report: Vault Backup/Restore, CSV/Excel Export & Tauri IPC Integration

## 1. Observation

Direct code observations across the workspace:
- **Encrypted .vault Backup & Restore (`src-tauri/src/vault/backup.rs`)**:
  - Binary container structure: Magic bytes `APEXVAULT1` (10 bytes), Version `1` (2 bytes), Salt (32 bytes), Nonce (12 bytes), Timestamp (8 bytes), Key Check Value (KCV, 32 bytes), HMAC-SHA256 integrity tag (32 bytes), and AES-256-GCM ciphertext with 16-byte authentication tag.
  - Constant-time verification with `subtle::ConstantTimeEq` for both KCV password verification and HMAC container integrity.
  - Atomic database restoration with WAL checkpointing, temporary file write, atomic rename, and cleaning of stale `-wal` and `-shm` files.
- **CSV & Excel Export Engine (`src-tauri/src/vault/export.rs`)**:
  - `export_csv`:
    - `transactions`: Exact columns `id,date,type,category,amount,currency,exchange_rate,base_amount,status,case_title,notes`.
    - `cases`: Exact columns `id,code,title,client_name,client_contact,stage,quoted_amount,currency,start_date,target_completion_date,closed_date,created_at,updated_at`.
    - `journal`: Exact columns `id,date,title,content,case_id,tags,is_starred,created_at,updated_at`.
    - Full RFC 4180 escaping (double-quote escaping for commas, quotes, and newlines).
  - `export_excel`:
    - Generates 4 worksheets: "Executive Summary", "Transactions", "Cases", and "Journal Entries".
    - Includes styled headers, electric purple `#8B5CF6` theme accents, currency number formats (`$#,##0.00`), percentage formats (`0.00%`), and date formatting.
    - Integrated with `DashboardMetricsCalculator`, `ARAgingCalculator`, and `CasePnLCalculator`.
- **Tauri IPC Command Catalog (`src-tauri/src/commands/export_cmd.rs` & `src-tauri/src/lib.rs`)**:
  - Implemented and registered:
    - `vault_export_backup`
    - `vault_restore_backup`
    - `export_csv`
    - `export_excel`
- **Milestone 4 Integration Test Suite (`src-tauri/tests/m4_export_backup_tests.rs`)**:
  - `test_backup_high_entropy_ciphertext`: Validates Shannon entropy of the AES-256-GCM ciphertext exceeds 7.80 bits/byte.
  - `test_backup_and_restore_full_roundtrip_parity`: Validates 100% data parity across transactions, multi-currency rates, cases, milestones, and journal entries.
  - `test_backup_restore_invalid_password_fails`: Validates wrong master password fails with `AppError::InvalidPassword`.
  - `test_backup_restore_corrupted_container_rejection`: Validates tampered container fails with `AppError::IntegrityViolation`.
  - `test_csv_export_exact_headers_and_formatting`: Validates exact column headers and RFC 4180 escaping.
  - `test_excel_export_multi_sheet_structure`: Validates 4-sheet structured workbook generation.
- **Frontend Wiring (`src/types/export.ts`, `src/api/export.ts`, `src/api/client.ts`, UI Views & Components)**:
  - `src/api/client.ts`: MockBackend and `invokeCommand` route all 4 commands seamlessly.
  - `src/components/palette/CommandPalette.tsx`: Added backup, restore, CSV, and Excel export commands.
  - `src/components/layout/Titlebar.tsx`: Quick backup button when unlocked.
  - `src/views/BlotterView.tsx`: "Export CSV" button in header toolbar.
  - `src/views/PipelineView.tsx`: "Export CSV" button in Kanban header toolbar.
  - `src/views/JournalView.tsx`: "Export CSV" button in sidebar toolbar.
  - `src/views/DashboardView.tsx`: "Export Excel" button beside timeframe selectors.
  - `src/views/LockScreen.tsx`: "Restore from .vault backup" modal dialog with password input.

## 2. Logic Chain

1. **Cryptographic Container Design**: To prevent data corruption during backup/restore, a deterministic container format was implemented:
   - Argon2id derives the master key from the user's password and header salt ($m=64\text{MB}, t=3, p=4$).
   - Domain-separated subkeys (`KCV_KEY`, `HMAC_KEY`, `ENC_KEY`) are derived via HMAC-SHA256 from the master key.
   - The KCV allows constant-time verification of password correctness BEFORE touching container ciphertext.
   - HMAC-SHA256 calculated over the header and encrypted body ensures rejection of any tampered archive with `AppError::IntegrityViolation`.
   - AES-256-GCM guarantees high ciphertext entropy (>7.80 bits/byte) and authenticated payload decryption.
2. **Database Swap & Data Parity**:
   - `export_backup` flushes the WAL checkpoint (`PRAGMA wal_checkpoint(TRUNCATE)`) prior to reading the database file.
   - `restore_backup` performs an atomic file swap using a `.tmp` file, clears stale `-wal` and `-shm` files, updates `vault.meta`, and executes migrations on connection initialization.
3. **Audit Export Precision**:
   - CSV exports match the exact column order and naming required by the specifications.
   - Excel exports provide a complete operational and financial picture with executive KPI metrics (Net Margin, Proposal Win Rate, Volume, AR Aging) and individual entity sheets.
4. **UI Accessibility**:
   - Users can trigger backups and exports via global shortcut (`Cmd+K`), titlebar icons, or dedicated view toolbar buttons.

## 3. Caveats

- In pure headless browser mock mode (outside Tauri runtime), `MockBackend` simulates exports and downloads CSV/XML files via standard DOM Blob creation. In native Tauri runtime, it executes through Tauri IPC commands and writes directly to disk.
- macOS target utilizes CommonCrypto (`libSystem.B.dylib`) for hardware-accelerated AES-256-GCM.

## 4. Conclusion

Milestone 4 implementation is 100% complete and fully verified against the project specifications and mathematical oracle reference. All 4 Tauri IPC commands, the encrypted `.vault` backup/restore engine, the CSV/Excel export engine, comprehensive unit/integration tests, and frontend UI components are in place and adhere to the zero-compromise integrity mandate.

## 5. Verification Method

To independently verify:
1. Run backend unit and integration tests:
   ```bash
   cargo test --manifest-path src-tauri/Cargo.toml --test m4_export_backup_tests
   cargo test --manifest-path src-tauri/Cargo.toml
   ```
2. Run frontend build verification:
   ```bash
   npm run build
   ```
3. Inspect exported `.vault` containers to verify high entropy, header format, KCV check, and HMAC tamper rejection.
