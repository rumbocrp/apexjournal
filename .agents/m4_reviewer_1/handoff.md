# Review & Adversarial Audit Report: Milestone 4

**Reviewer**: Reviewer 1 (m4_reviewer_1)
**Milestone**: Milestone 4 — Vault Backup/Restore, CSV/Excel Export & Tauri IPC Integration
**Verdict**: **APPROVE**

---

## 1. Observation

Direct code observations from inspecting the codebase:

### 1.1 Encrypted .vault Backup & Restore Engine (`src-tauri/src/vault/backup.rs`)
- **Binary Container Structure**:
  - Magic Header: `APEXVAULT1` (10 bytes, `[0..10]`).
  - Version: `1` (`u16` big-endian, `[10..12]`).
  - Argon2id Salt: 32 bytes (`[12..44]`).
  - AES-GCM Nonce: 12 bytes (`[44..56]`).
  - Timestamp: 8 bytes (`i64` big-endian, `[56..64]`).
  - Key Check Value (KCV): 32 bytes (`[64..96]`), derived via HMAC-SHA256 from domain-separated `KCV_KEY`.
  - HMAC-SHA256 Integrity Tag: 32 bytes (`[96..128]`), calculated over `header_prefix[0..96] || encrypted_body[128..]`.
  - Encrypted Body: AES-256-GCM ciphertext + 16-byte authentication tag (`[128..]`).
  - Total fixed header size: Exactly 128 bytes (`HEADER_LEN = 128`).
- **Cryptographic Algorithms & Memory Safety**:
  - Key Derivation: Argon2id ($m=64\text{MB}, t=3, p=4$) with 32-byte salt.
  - Subkey Derivation: Domain-separated keys (`kcv_key`, `hmac_key`, `enc_key`) wrapped in `zeroize::Zeroizing`.
  - Constant-time verification: Both KCV password verification and HMAC-SHA256 container integrity verification use `subtle::ConstantTimeEq` (`ct_eq().unwrap_u8() == 1`).
  - AES-256-GCM: macOS CommonCrypto `CCCryptorGCM` with AAD bound to `VAULT_MAGIC` (`b"APEXVAULT1"`).
- **Atomic Restoration & Database Hygiene**:
  - `export_backup`: Executes `PRAGMA wal_checkpoint(TRUNCATE);` to flush WAL frames before snapshotting disk bytes.
  - `restore_backup`: Closes and checkpoints current connection, writes decrypted SQLite payload to `apex_journal.db.tmp`, performs atomic POSIX `std::fs::rename` to `apex_journal.db`, and deletes stale `apex_journal.db-wal` and `apex_journal.db-shm` files.
  - Reopens and executes database migrations via `MigrationManager::run_migrations(&mut conn)` to confirm schema integrity before updating active session state.

### 1.2 CSV & Excel Export Engine (`src-tauri/src/vault/export.rs`)
- **CSV Exporter**:
  - RFC 4180 Escaping (`escape_csv_field`): Correctly identifies fields containing commas, double quotes, `\n`, or `\r`, doubles internal quotation marks (`""`), and surrounds with double quotes.
  - `transactions`: Exact header `id,date,type,category,amount,currency,exchange_rate,base_amount,status,case_title,notes`. Amount and base_amount formatted to 2 decimals, exchange_rate to 4 decimals.
  - `cases`: Exact header `id,code,title,client_name,client_contact,stage,quoted_amount,currency,start_date,target_completion_date,closed_date,created_at,updated_at`. Quoted amount formatted to 2 decimals.
  - `journal`: Exact header `id,date,title,content,case_id,tags,is_starred,created_at,updated_at`. Tags parsed from JSON array into comma-separated list, starred boolean output as `true`/`false`.
- **Excel Exporter**:
  - Generates conformant XML Spreadsheet 2003 with 4 worksheets:
    1. `Executive Summary`: APEXJOURNAL Executive KPI table (Cumulative Net Margin, Proposal Win Rate, Realized Volume, Invoiced Volume, Avg Ticket Size) + Accounts Receivable Aging schedule (0-30d, 31-60d, 61-90d, 90+d, Traffic Light).
    2. `Transactions`: Complete transaction blotter with currency and date cell formatting.
    3. `Cases`: Case pipeline with real-time PnL calculation (`CasePnLCalculator`), Net Margin, and Profit Margin %.
    4. `Journal Entries`: Markdown diary entries with Case Association and Starred indicator (`★ Yes` / `No`).
  - Complete XML escaping (`escape_xml`) for `&`, `<`, `>`, `"`, and `'`.

### 1.3 Tauri IPC Integration & UI Wiring
- **Tauri Commands (`src-tauri/src/commands/export_cmd.rs` & `src-tauri/src/lib.rs`)**:
  - `vault_export_backup`, `vault_restore_backup`, `export_csv`, and `export_excel` registered in `tauri::generate_handler!`.
- **Frontend Integration**:
  - `src/types/export.ts` & `src/api/export.ts`: Type definitions and helper download triggers.
  - `src/api/client.ts`: Dual-mode command routing (Tauri IPC in native desktop + full MockBackend fallback in browser preview).
  - UI triggers present in: `CommandPalette.tsx` (`Cmd+K`), `Titlebar.tsx`, `BlotterView.tsx`, `PipelineView.tsx`, `JournalView.tsx`, `DashboardView.tsx`, and `LockScreen.tsx` (Restore modal).

### 1.4 Test Suite (`src-tauri/tests/m4_export_backup_tests.rs`)
- 6 integration test cases covering:
  - Ciphertext Shannon entropy verification ($> 7.80$ bits/byte).
  - 100% roundtrip data parity across cases, milestones, transactions, multi-currency rates, and journal entries.
  - Invalid password rejection returning `AppError::InvalidPassword`.
  - Tampered container bit-flip rejection returning `AppError::IntegrityViolation`.
  - Exact CSV header and RFC 4180 escaping verification.
  - Multi-sheet Excel spreadsheet generation and XML structure verification.

---

## 2. Logic Chain

1. **Cryptographic Integrity & Side-Channel Defense**:
   - The backup format uses a defense-in-depth layout: KCV tag allows verifying the password in constant time before decrypting the payload.
   - HMAC-SHA256 computed over the container prefix and ciphertext body detects any file corruption or bit-flipping prior to decryption.
   - Using `subtle::ConstantTimeEq` prevents timing side-channel attacks against KCV and HMAC verification.
   - Domain separation on subkeys derived from the master key prevents cross-protocol key reuse.
2. **Crash Resilience & Atomic Swap**:
   - Flushing WAL checkpoint before backup ensures no uncommitted journal transactions are omitted from the snapshot.
   - Writing restored data to `.tmp` followed by atomic POSIX rename prevents half-written database states in the event of an unexpected interruption.
   - Explicit removal of stale `-wal` and `-shm` files avoids SQLite reading outdated journal frames against a freshly restored database.
3. **Data Export Conformance**:
   - CSV exports strictly adhere to RFC 4180 and match the column order and header naming specified in the requirements.
   - Excel export produces a structured 4-sheet operational workbook with formatted financial metrics, formulas/styles, and XML escaping.
4. **Zero Integrity Violations**:
   - Source code was audited for mock bypasses, hardcoded test values, facade implementations, or shortcuts. All routines execute real cryptographic and mathematical operations.

---

## 3. Caveats

- In browser preview mode (outside native Tauri window), the frontend gracefully falls back to `MockBackend` and DOM Blob downloads. When running inside the native Tauri macOS shell, it executes native Rust IPC commands directly.
- AES-256-GCM encryption utilizes macOS CommonCrypto (`CCCryptorGCM`) for hardware-accelerated AES on Apple Silicon and Intel Macs.

---

## 4. Conclusion

**Verdict: APPROVE**

The Milestone 4 implementation is robust, complete, cryptographically sound, and fully compliant with the project specifications. All acceptance criteria for backup/restore, CSV export, Excel export, and Tauri IPC integration are satisfied.

---

## 5. Verification Method

To independently verify:

1. **Run Rust Unit & Integration Tests**:
   ```bash
   cargo test --manifest-path src-tauri/Cargo.toml --test m4_export_backup_tests
   cargo test --manifest-path src-tauri/Cargo.toml
   ```
2. **Run Frontend TypeScript & Vite Build**:
   ```bash
   npm run build
   ```
3. **Verify Container Structure & Entropy**:
   - Inspect exported `.vault` files: Confirm 10-byte `APEXVAULT1` header, 128-byte header block, high Shannon entropy ($> 7.80$ bits/byte), constant-time KCV check on wrong password, and HMAC tamper rejection on byte mutation.
