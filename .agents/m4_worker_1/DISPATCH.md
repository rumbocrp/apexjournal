## 2026-08-30T21:57:33Z

You are Worker 1 for Milestone 4 (Vault Backup/Restore, CSV/Excel Export & Tauri IPC Integration) of ApexJournal.

Working directory: /Users/nuevo/apex_journal/.agents/m4_worker_1
Workspace: /Users/nuevo/apex_journal
Original Request: /Users/nuevo/apex_journal/.agents/ORIGINAL_REQUEST.md
Spec: /Users/nuevo/apex_journal/PROJECT.md
Oracle Reference: /Users/nuevo/apex_journal/tests/harness/oracle.js

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your task:
Implement the complete Milestone 4 backend and UI integration:
1. Encrypted .vault Backup & Restore (`src-tauri/src/vault/backup.rs`):
   - Export: Create an AES-256-GCM encrypted `.vault` binary container containing database snapshot, metadata header (magic bytes `APEXVAULT1`, salt, nonce, timestamp, HMAC-SHA256 integrity tag).
   - Restore: Decrypts `.vault` with master password, verifies HMAC integrity, checks schema version compatibility, checkpoints and cleanly swaps the active SQLCipher database file without data loss.
2. CSV & Excel Export Engine (`src-tauri/src/vault/export.rs`):
   - CSV Export (`export_csv`):
     - `transactions`: Exact columns (`id,date,type,category,amount,currency,exchange_rate,base_amount,status,case_title,notes`).
     - `cases`: Exact columns (`id,code,title,client_name,client_contact,stage,quoted_amount,currency,start_date,target_completion_date,closed_date,created_at,updated_at`).
     - `journal`: Exact columns (`id,date,title,content,case_id,tags,is_starred,created_at,updated_at`).
   - Excel Export (`export_excel`): Structured multi-sheet `.xlsx` workbook (or standard XML Spreadsheet format/zip) containing Transactions, Cases, Journal Entries, and Executive KPI Summary with headers and number formats.
3. Tauri IPC Commands (`src-tauri/src/commands/export_cmd.rs` & `src-tauri/src/lib.rs`):
   - `vault_export_backup({ destinationPath: string }) -> BackupResult`
   - `vault_restore_backup({ sourcePath: string, masterPassword: string }) -> void`
   - `export_csv({ exportType: string }) -> string`
   - `export_excel({ destinationPath: string }) -> void`
   - Register all 4 commands in `src-tauri/src/lib.rs`.
4. Tests (`src-tauri/tests/m4_export_backup_tests.rs`):
   - Test backup export producing high-entropy AES-256 ciphertext (>7.80 bits/byte).
   - Test full restore roundtrip verifying 100% data parity.
   - Test invalid password on restore failing with `AppError::InvalidPassword`.
   - Test corrupted backup container HMAC rejection with `AppError::IntegrityViolation`.
   - Test CSV export exact header and data output formatting.
5. Frontend Wiring:
   - Ensure `src/api/client.ts` routes `vault_export_backup`, `vault_restore_backup`, `export_csv`, and `export_excel` seamlessly to Tauri IPC and handles downloads/dialogs.
   - Wire export actions into `CommandPalette.tsx`, `Titlebar.tsx`, and views.

Verify by running `cargo test --manifest-path src-tauri/Cargo.toml` and `npm run build`.
Write your handoff report to `/Users/nuevo/apex_journal/.agents/m4_worker_1/handoff.md` and send a message when done.
