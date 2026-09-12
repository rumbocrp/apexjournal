# DISPATCH — Survey Explorer 1 (Core Architecture & Tauri v2/Rust/SQLCipher Engine)

## 2026-08-30T19:38:14Z

## Assignment
You are Survey Explorer 1 for ApexJournal.
Your working directory is: `/Users/nuevo/apex_journal/.agents/survey_explorer_1`
Your mission is to perform a comprehensive survey and technical specification investigation for the Core Architecture, Tauri v2 + Rust backend, and SQLCipher/Rusqlite encrypted storage layer.

## Mandatory Inputs to Read
- Read `/Users/nuevo/apex_journal/.agents/ORIGINAL_REQUEST.md` completely.
- Check workspace root `/Users/nuevo/apex_journal` for any existing files/structure.

## Investigation Scope
1. Tauri v2 Desktop Shell setup on macOS, Rust project structure, Cargo dependencies (tauri v2, rusqlite with sqlcipher / bundled sqlcipher, argon2, zeroize, serde, tokio, etc.).
2. Database encryption at rest: AES-256-GCM / SQLCipher page-level encryption, PRAGMA key derivation, Argon2id parameters (memory, time, parallelism, salt generation/storage), database file structure on disk, memory wiping / zeroization of plaintext keys.
3. Session Security & Lifecycle: Master password entry, Touch ID / macOS Keychain integration (or mockable native bridge), inactivity timeout auto-lock, memory clearing upon lock, database connection re-authentication.
4. IPC Architecture: Tauri v2 commands (`invoke`) and events (`emit`) for frontend-backend communication (auth, query, mutation, export/import, lock/unlock).
5. Error handling, database migrations, connection pooling / mutex management.

## Deliverable
Write your findings to `/Users/nuevo/apex_journal/.agents/survey_explorer_1/survey_report.md` and complete a structured handoff report in `/Users/nuevo/apex_journal/.agents/survey_explorer_1/handoff.md`.
Report back when complete via `send_message`.
