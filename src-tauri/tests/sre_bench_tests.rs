//! SRE benchmarks for SPEC §7 on real SQLCipher files (not in-memory).
//! Bounds here are generous so debug CI stays green; the release numbers
//! printed by these tests are the actual SLA evidence.

use chrono::{Duration, Utc};
use rusqlite::Connection;
use tempfile::tempdir;
use zeroize::Zeroizing;

use apex_journal::crypto::{KeyDerivationEngine, SecureKey};
use apex_journal::db::{DatabaseManager, MigrationManager, TransactionRepo};

fn shannon_entropy(bytes: &[u8]) -> f64 {
    let mut freq = [0u64; 256];
    for b in bytes {
        freq[*b as usize] += 1;
    }
    let len = bytes.len() as f64;
    freq.iter()
        .filter(|&&c| c > 0)
        .map(|&c| {
            let p = c as f64 / len;
            -p * p.log2()
        })
        .sum()
}

struct VaultFile {
    _dir: tempfile::TempDir,
    db_path: std::path::PathBuf,
    key: SecureKey,
}

fn build_vault_file(n_rows: usize) -> VaultFile {
    let dir = tempdir().expect("tempdir");
    let db_path = dir.path().join("apex_journal.db");
    let salt = KeyDerivationEngine::generate_salt();
    let key = KeyDerivationEngine::derive_master_key("SreBenchPassword123!", &salt)
        .expect("derive key");

    let today = Utc::now().date_naive();
    {
        let mut conn = DatabaseManager::open_encrypted(&db_path, &key).expect("open");
        MigrationManager::run_migrations(&mut conn).expect("migrate");
        conn.execute_batch("BEGIN;").unwrap();
        for i in 0..n_rows {
            let day_offset = (i % 120) as i64;
            let date = (today - Duration::days(day_offset)).to_string();
            let status = if i % 2 == 0 { "INVOICED" } else { "PENDING" };
            conn.execute(
                "INSERT INTO transactions (id, date, type, category_id, category_name, amount, currency, exchange_rate, base_amount, status, created_at, updated_at)
                 VALUES (?1, ?2, 'INCOME', 'cat-1', 'Client Consulting Fee', 100.0, 'USD', 1.0, 100.0, ?3, '2026-01-01', '2026-01-01')",
                rusqlite::params![format!("tx-sre-{}", i), date, status],
            )
            .unwrap();
        }
        conn.execute_batch("COMMIT;").unwrap();
        DatabaseManager::checkpoint_and_close(conn).expect("checkpoint");
    }

    VaultFile {
        _dir: dir,
        db_path,
        key,
    }
}

#[test]
fn sre_open_cold_start_and_entropy() {
    let vault = build_vault_file(1_000);

    // Cold-start decrypt: fresh open of an existing encrypted file.
    let start = std::time::Instant::now();
    let conn: Connection =
        DatabaseManager::open_encrypted(&vault.db_path, &vault.key).expect("reopen");
    let open_elapsed = start.elapsed();
    println!("SRE cold open (1k rows): {:?}", open_elapsed);
    // SPEC §7 target <200ms in release; generous bound for debug.
    assert!(
        open_elapsed.as_millis() < 30_000,
        "cold open too slow: {:?}",
        open_elapsed
    );

    // Encrypted-at-rest evidence: raw file must look random.
    DatabaseManager::checkpoint_and_close(conn).expect("checkpoint");
    let bytes = std::fs::read(&vault.db_path).expect("read db file");
    let entropy = shannon_entropy(&bytes);
    println!(
        "SRE db file entropy: {:.4} / 8.0 ({} bytes)",
        entropy,
        bytes.len()
    );
    assert!(
        entropy > 7.9,
        "encrypted vault entropy too low: {:.4}",
        entropy
    );
}

#[test]
fn sre_10k_file_query() {
    let vault = build_vault_file(10_000);
    let conn: Connection =
        DatabaseManager::open_encrypted(&vault.db_path, &vault.key).expect("reopen");

    let start = std::time::Instant::now();
    let summary = TransactionRepo::calculate_ar_aging_sql(&conn).expect("aging");
    let elapsed = start.elapsed();
    assert_eq!(summary.total_receivable, 1_000_000.0);
    assert_eq!(summary.traffic_light, "RED");
    println!("SRE 10k file query: {:?}", elapsed);
    assert!(
        elapsed.as_millis() < 30_000,
        "10k file query too slow: {:?}",
        elapsed
    );
    DatabaseManager::checkpoint_and_close(conn).expect("checkpoint");
}

#[test]
fn sre_zeroize_latency() {
    // Proxy for master-key zeroization cost: drop 10k 32-byte secrets.
    let start = std::time::Instant::now();
    for i in 0..10_000u32 {
        drop(SecureKey::new(Zeroizing::new([(i & 0xFF) as u8; 32])));
    }
    let elapsed = start.elapsed();
    println!(
        "SRE zeroize 10k drops: {:?} (avg {:?}/op)",
        elapsed,
        elapsed / 10_000
    );
    // SPEC §7 target <1ms per lock; bound here is absurdly generous.
    assert!(
        elapsed.as_millis() < 30_000,
        "zeroize path too slow: {:?}",
        elapsed
    );
}

/// 100k file run. Ignored in the default suite (minutes on SQLCipher files);
/// run explicitly: `cargo test --release -- --ignored sre_100k`.
#[test]
#[ignore]
fn sre_100k_file_query() {
    let vault = build_vault_file(100_000);
    let conn: Connection =
        DatabaseManager::open_encrypted(&vault.db_path, &vault.key).expect("reopen");

    let _ = TransactionRepo::calculate_ar_aging_sql(&conn).expect("warmup");
    let iters = 3;
    let start = std::time::Instant::now();
    for _ in 0..iters {
        let s = TransactionRepo::calculate_ar_aging_sql(&conn).expect("aging");
        assert_eq!(s.total_receivable, 10_000_000.0);
    }
    let elapsed = start.elapsed();
    println!(
        "SRE 100k file query: {:?} total for {} iters (avg {:?})",
        elapsed,
        iters,
        elapsed / iters
    );
    DatabaseManager::checkpoint_and_close(conn).expect("checkpoint");
}
