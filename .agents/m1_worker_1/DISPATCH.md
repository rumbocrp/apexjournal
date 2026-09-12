## 2026-08-30T19:47:45Z
You are the Milestone 1 Worker for ApexJournal.
Your working directory is: /Users/nuevo/apex_journal/.agents/m1_worker_1
Read /Users/nuevo/apex_journal/.agents/ORIGINAL_REQUEST.md and /Users/nuevo/apex_journal/PROJECT.md completely.
Read explorer findings:
- /Users/nuevo/.gemini/antigravity-cli/brain/cb7373c7-0c43-4cd9-939c-8568b69240f7/plan.md
- /Users/nuevo/.gemini/antigravity-cli/brain/c03a3c9d-06d3-4a66-994a-df29232a5f47/plan.md
- /Users/nuevo/.gemini/antigravity-cli/brain/2ab37a14-c69c-4f4c-b6bf-34571fe9a580 (see explorer 3 report)

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your scope of work for Milestone 1 (Desktop Shell, Rust Core, SQLCipher Storage, Argon2id & Session Unlock):
1. Setup Tauri v2 project structure in /Users/nuevo/apex_journal:
   - src-tauri/Cargo.toml with rusqlite (features = ["bundled-sqlcipher-vendored-openssl"]), argon2, zeroize, tokio, chrono, serde, serde_json, thiserror, uuid, security-framework, log, env_logger, tempfile.
   - src-tauri/tauri.conf.json & capabilities/default.json configured for macOS overlay titlebar and obsidian theme.
   - Root package.json, vite.config.ts, tsconfig.json, tailwind.config.js with React 18, Tailwind, Lucide React, and TypeScript.
2. Implement src-tauri/src/error.rs with unified AppError enum and rusqlite conversion.
3. Implement src-tauri/src/crypto/ (argon.rs with Argon2id m=64MB, t=3, p=4 and 32-byte salt; keychain.rs with macOS Security.framework Touch ID / Keychain bridge and mock fallback).
4. Implement src-tauri/src/db/ (connection.rs with open_encrypted_connection, PRAGMA key, kdf_iter=1, cipher_page_size=4096, WAL mode, foreign_keys; migrations.rs with initial schema migration).
5. Implement src-tauri/src/models/auth.rs and state/ (mod.rs with Arc<Mutex<SessionManager>>, VaultState, with_connection guard, inactivity timeout; watchdog.rs with background auto-lock task).
6. Implement src-tauri/src/commands/ (auth_cmd.rs with vault_setup, vault_unlock, vault_unlock_biometric, vault_lock, vault_get_status, vault_touch).
7. Implement src-tauri/src/main.rs and lib.rs wiring commands and state.
8. Write and execute thorough unit tests:
   - Argon2id determinism and key derivation
   - SQLCipher raw disk encryption binary inspection (confirming SQLite header magic is ABSENT and file is unreadable with standard sqlite3)
   - Zeroize memory clearing
   - Inactivity auto-lock timeout enforcement
   - Concurrent with_connection access
9. Run `cargo test --manifest-path src-tauri/Cargo.toml` and ensure 100% tests pass.
10. Write /Users/nuevo/apex_journal/.agents/m1_worker_1/handoff.md with passing test outputs, and send a message when finished.
