use std::path::PathBuf;

/// Closed IPC contract: every command name must exist on all four surfaces.
/// Drift between any two surfaces is a compat bug (backend/harness/mock/frontend).
/// Surfaces:
///   1. src-tauri/src/lib.rs            (generate_handler registration)
///   2. src/api/client.ts               (mock router `case '...':`)
///   3. tests/harness/ipc_bridge.js     (`async <name>(` method)
///   4. src/api/analytics.ts            (AR-aging canonical-first, checked separately)
///
/// Compat note (2026-09-09): `analytics_get_ar_aging` is the legacy alias of
/// canonical `get_ar_aging_summary`. Earliest removal: after every shipped
/// client migrates to the canonical name + one release. Removing it means
/// deleting the name from EXPECTED_COMMANDS here first (red), then from the
/// four surfaces.
const EXPECTED_COMMANDS: &[&str] = &[
    // Auth & Vault
    "vault_get_status",
    "vault_setup",
    "vault_unlock",
    "vault_unlock_biometric",
    "vault_lock",
    "vault_touch",
    // Transactions & Categories
    "transaction_create",
    "transaction_update",
    "transaction_delete",
    "transaction_list",
    "category_list",
    // Cases & Milestones
    "case_create",
    "case_update",
    "case_list",
    "case_get_detail",
    "milestone_create",
    "milestone_toggle",
    // Journal
    "journal_create",
    "journal_update",
    "journal_list",
    // Analytics (canonical + legacy alias both first-class)
    "analytics_get_dashboard",
    "analytics_get_equity_curve",
    "analytics_get_ar_aging",
    "get_ar_aging_summary",
    // Vault Backup & Export
    "vault_export_backup",
    "vault_restore_backup",
    "export_csv",
    "export_excel",
];

fn repo_root() -> PathBuf {
    let cwd = std::env::current_dir().expect("current_dir");
    // Integration tests run with CWD = src-tauri/.
    if cwd.join("src/lib.rs").exists() && cwd.join("Cargo.toml").exists() {
        return cwd.parent().expect("workspace root").to_path_buf();
    }
    // Fallback: already at workspace root.
    if cwd.join("src-tauri/src/lib.rs").exists() {
        return cwd;
    }
    panic!(
        "cannot locate repo root from CWD {:?}: expected src-tauri/ or workspace root",
        cwd
    );
}

fn read_surface(root: &std::path::Path, rel: &str) -> String {
    let path = root.join(rel);
    std::fs::read_to_string(&path)
        .unwrap_or_else(|e| panic!("contract test cannot read {}: {}", path.display(), e))
}

#[test]
fn test_ipc_contract_closed_across_surfaces() {
    let root = repo_root();
    let lib_rs = read_surface(&root, "src-tauri/src/lib.rs");
    let client_ts = read_surface(&root, "src/api/client.ts");
    let bridge_js = read_surface(&root, "tests/harness/ipc_bridge.js");

    // The handler block is the source of truth for what Tauri exposes.
    let handler_start = lib_rs
        .find("generate_handler![")
        .expect("lib.rs must contain generate_handler![");
    let handler = &lib_rs[handler_start..];

    let mut failures: Vec<String> = Vec::new();
    for cmd in EXPECTED_COMMANDS {
        if !handler.contains(cmd) {
            failures.push(format!("{} missing in lib.rs generate_handler", cmd));
        }
        if !client_ts.contains(&format!("case '{}':", cmd)) {
            failures.push(format!("{} missing in client.ts mock router", cmd));
        }
        if !bridge_js.contains(&format!("async {}(", cmd)) {
            failures.push(format!("{} missing in ipc_bridge.js harness", cmd));
        }
    }
    assert!(
        failures.is_empty(),
        "IPC contract drift ({}):\n{}",
        failures.len(),
        failures.join("\n")
    );
    assert_eq!(EXPECTED_COMMANDS.len(), 28);
}

#[test]
fn test_ar_aging_canonical_first_in_frontend() {
    // SPEC §6.2: frontend must try get_ar_aging_summary before the legacy alias.
    let root = repo_root();
    let analytics_ts = read_surface(&root, "src/api/analytics.ts");
    let canon = analytics_ts
        .find("get_ar_aging_summary")
        .expect("analytics.ts must reference canonical name");
    let legacy = analytics_ts
        .find("analytics_get_ar_aging")
        .expect("analytics.ts must keep legacy fallback");
    assert!(
        canon < legacy,
        "canonical get_ar_aging_summary must precede legacy fallback in analytics.ts"
    );
}
