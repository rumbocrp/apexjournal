//! Database Migrations Engine

use rusqlite::Connection;
use crate::db::schema::INITIAL_SCHEMA_SQL;
use crate::error::AppError;

pub struct MigrationManager;

impl MigrationManager {
    /// Get current database user_version
    pub fn get_user_version(conn: &Connection) -> Result<u32, AppError> {
        let version: u32 = conn.query_row("PRAGMA user_version;", [], |row| row.get(0))?;
        Ok(version)
    }

    fn column_exists(conn: &Connection, table: &str, column: &str) -> bool {
        let mut stmt = match conn.prepare(&format!("PRAGMA table_info({})", table)) {
            Ok(s) => s,
            Err(_) => return false,
        };
        let cols: Vec<String> = stmt
            .query_map([], |row| row.get::<_, String>(1))
            .map(|rows| rows.filter_map(|r| r.ok()).collect())
            .unwrap_or_default();
        cols.iter().any(|c| c == column)
    }

    /// Run all pending migrations on an open SQLite/SQLCipher connection
    pub fn run_migrations(conn: &mut Connection) -> Result<(), AppError> {
        let current_version = Self::get_user_version(conn)?;

        if current_version == 0 {
            log::info!("Applying initial schema migration (v1)...");
            let tx = conn.transaction()?;
            tx.execute_batch(INITIAL_SCHEMA_SQL)?;
            tx.execute_batch("PRAGMA user_version = 1;")?;
            tx.commit()?;
            log::info!("Initial schema migration (v1) applied successfully.");
        }

        let current_version = Self::get_user_version(conn)?;
        if current_version == 1 {
            log::info!("Applying SPEC Sistema de Luces migration (v2)...");
            let tx = conn.transaction()?;
            // 1. Denormalized display columns per SPEC §3.1 (nullable-safe for backcompat).
            // base_amount stays app-computed Decimal Bankers (§2.2): SQLite GENERATED
            // would use binary-float ROUND, losing Bankers precision. Integrity is
            // enforced via app layer + triggers below.
            if !Self::column_exists(&tx, "transactions", "category_name") {
                tx.execute_batch(
                    "ALTER TABLE transactions ADD COLUMN category_name TEXT NOT NULL DEFAULT '';",
                )?;
            }
            if !Self::column_exists(&tx, "transactions", "case_title") {
                tx.execute_batch("ALTER TABLE transactions ADD COLUMN case_title TEXT;")?;
            }
            // 2. Backfill denormalized copies from canonical JOIN sources.
            tx.execute_batch(
                "UPDATE transactions SET category_name = (
                    SELECT c.name FROM categories c WHERE c.id = transactions.category_id
                ) WHERE (category_name IS NULL OR category_name = '')
                  AND EXISTS (SELECT 1 FROM categories c WHERE c.id = transactions.category_id);
                 UPDATE transactions SET case_title = (
                    SELECT cs.title FROM cases cs WHERE cs.id = transactions.case_id
                ) WHERE case_id IS NOT NULL AND case_title IS NULL
                  AND EXISTS (SELECT 1 FROM cases cs WHERE cs.id = transactions.case_id);",
            )?;
            // 3. Single-pass AR aging partial index per SPEC §3.2.
            tx.execute_batch(
                "CREATE INDEX IF NOT EXISTS idx_tx_ar_aging_scan
                 ON transactions(type, status, date)
                 WHERE type = 'INCOME' AND status IN ('INVOICED', 'PENDING');",
            )?;
            // 4. DB-level guards for SPEC §3.1 CHECK(amount > 0), CHECK(exchange_rate > 0).
            // ALTER TABLE cannot add CHECKs retroactively, so triggers enforce them.
            tx.execute_batch(
                "CREATE TRIGGER IF NOT EXISTS trg_transactions_amount_positive_insert
                 BEFORE INSERT ON transactions
                 BEGIN
                   SELECT CASE WHEN NEW.amount IS NULL OR NEW.amount <= 0
                     THEN RAISE(ABORT, 'CHECK failed: transactions.amount must be > 0') END;
                   SELECT CASE WHEN NEW.exchange_rate IS NULL OR NEW.exchange_rate <= 0
                     THEN RAISE(ABORT, 'CHECK failed: transactions.exchange_rate must be > 0') END;
                 END;
                 CREATE TRIGGER IF NOT EXISTS trg_transactions_amount_positive_update
                 BEFORE UPDATE ON transactions
                 BEGIN
                   SELECT CASE WHEN NEW.amount IS NULL OR NEW.amount <= 0
                     THEN RAISE(ABORT, 'CHECK failed: transactions.amount must be > 0') END;
                   SELECT CASE WHEN NEW.exchange_rate IS NULL OR NEW.exchange_rate <= 0
                     THEN RAISE(ABORT, 'CHECK failed: transactions.exchange_rate must be > 0') END;
                 END;",
            )?;
            tx.execute_batch("PRAGMA user_version = 2;")?;
            tx.commit()?;
            log::info!("SPEC Sistema de Luces migration (v2) applied successfully.");
        }

        let current_version = Self::get_user_version(conn)?;
        if current_version == 2 {
            log::info!("Applying AR pre-aggregation migration (v3)...");
            let tx = conn.transaction()?;
            // Daily outstanding totals keyed by transaction day. Buckets depend
            // on *today*, so only per-day sums are materialized; bucketing
            // stays at read time over at most a few thousand day-rows instead
            // of scanning every transaction. Correct on any date, no staleness.
            tx.execute_batch(
                "CREATE TABLE IF NOT EXISTS ar_daily_outstanding (
                    tx_date TEXT PRIMARY KEY NOT NULL,
                    total REAL NOT NULL DEFAULT 0.0
                );
                INSERT OR REPLACE INTO ar_daily_outstanding (tx_date, total)
                    SELECT substr(date, 1, 10), COALESCE(SUM(base_amount), 0)
                    FROM transactions
                    WHERE type = 'INCOME' AND status IN ('INVOICED', 'PENDING')
                    GROUP BY substr(date, 1, 10);
                CREATE TRIGGER IF NOT EXISTS trg_ar_daily_insert
                AFTER INSERT ON transactions
                WHEN NEW.type = 'INCOME' AND NEW.status IN ('INVOICED', 'PENDING')
                BEGIN
                    INSERT INTO ar_daily_outstanding (tx_date, total)
                    VALUES (substr(NEW.date, 1, 10), NEW.base_amount)
                    ON CONFLICT(tx_date) DO UPDATE SET total = total + excluded.total;
                END;
                CREATE TRIGGER IF NOT EXISTS trg_ar_daily_delete
                AFTER DELETE ON transactions
                WHEN OLD.type = 'INCOME' AND OLD.status IN ('INVOICED', 'PENDING')
                BEGIN
                    UPDATE ar_daily_outstanding
                    SET total = total - OLD.base_amount
                    WHERE tx_date = substr(OLD.date, 1, 10);
                END;
                CREATE TRIGGER IF NOT EXISTS trg_ar_daily_upd_remove
                AFTER UPDATE ON transactions
                WHEN OLD.type = 'INCOME' AND OLD.status IN ('INVOICED', 'PENDING')
                BEGIN
                    UPDATE ar_daily_outstanding
                    SET total = total - OLD.base_amount
                    WHERE tx_date = substr(OLD.date, 1, 10);
                END;
                CREATE TRIGGER IF NOT EXISTS trg_ar_daily_upd_add
                AFTER UPDATE ON transactions
                WHEN NEW.type = 'INCOME' AND NEW.status IN ('INVOICED', 'PENDING')
                BEGIN
                    INSERT INTO ar_daily_outstanding (tx_date, total)
                    VALUES (substr(NEW.date, 1, 10), NEW.base_amount)
                    ON CONFLICT(tx_date) DO UPDATE SET total = total + excluded.total;
                END;",
            )?;
            tx.execute_batch("PRAGMA user_version = 3;")?;
            tx.commit()?;
            log::info!("AR pre-aggregation migration (v3) applied successfully.");
        }

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn test_initial_migration_in_memory() {
        let mut conn = Connection::open_in_memory().unwrap();
        assert_eq!(MigrationManager::get_user_version(&conn).unwrap(), 0);

        MigrationManager::run_migrations(&mut conn).unwrap();
        assert_eq!(MigrationManager::get_user_version(&conn).unwrap(), 3);

        // Verify tables created
        let table_count: i64 = conn
            .query_row(
                "SELECT count(*) FROM sqlite_master WHERE type='table' AND name IN ('categories', 'cases', 'transactions', 'journal_entries', 'app_settings');",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(table_count, 5);
    }

    #[test]
    fn test_v1_legacy_data_migrates_to_v2() {
        // Simulate a pre-existing v1 database: raw v1 schema + legacy rows,
        // no v2 columns, user_version pinned at 1.
        let mut conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(INITIAL_SCHEMA_SQL).unwrap();
        conn.execute_batch("PRAGMA user_version = 1;").unwrap();

        // Legacy case + transaction (v1 has no category_name/case_title columns).
        conn.execute(
            "INSERT INTO cases (id, code, title, client_name, stage, quoted_amount, currency)
             VALUES ('case-leg', 'CASE-LEG', 'Legacy Project', 'Legacy Client', 'ACTIVE', 10000.0, 'USD')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO transactions (id, date, type, category_id, amount, currency, exchange_rate, base_amount, status, case_id, notes, created_at, updated_at)
             VALUES ('tx-leg', '2026-08-10', 'INCOME', 'cat-1', 2500.0, 'USD', 1.0, 2500.0, 'INVOICED', 'case-leg', 'legacy note', '2026-08-10', '2026-08-10')",
            [],
        )
        .unwrap();

        // Migrate and verify version bump.
        MigrationManager::run_migrations(&mut conn).unwrap();
        assert_eq!(MigrationManager::get_user_version(&conn).unwrap(), 3);

        // Backfill: denormalized copies resolved from canonical JOIN sources.
        let (cat_name, case_title): (String, Option<String>) = conn
            .query_row(
                "SELECT category_name, case_title FROM transactions WHERE id = 'tx-leg'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .unwrap();
        assert_eq!(cat_name, "Client Consulting Fee");
        assert_eq!(case_title.as_deref(), Some("Legacy Project"));

        // Legacy row content preserved verbatim otherwise.
        let (amount, base, status, notes): (f64, f64, String, Option<String>) = conn
            .query_row(
                "SELECT amount, base_amount, status, notes FROM transactions WHERE id = 'tx-leg'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .unwrap();
        assert_eq!(amount, 2500.0);
        assert_eq!(base, 2500.0);
        assert_eq!(status, "INVOICED");
        assert_eq!(notes.as_deref(), Some("legacy note"));

        // v2 guards active on migrated DB: partial index + triggers.
        let idx: String = conn
            .query_row(
                "SELECT sql FROM sqlite_master WHERE type='index' AND name='idx_tx_ar_aging_scan'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert!(idx.contains("WHERE"));
        let rejected = conn.execute(
            "INSERT INTO transactions (id, date, type, category_id, amount, currency, exchange_rate, base_amount, status, created_at, updated_at)
             VALUES ('tx-leg-bad', '2026-08-11', 'INCOME', 'cat-1', -5.0, 'USD', 1.0, -5.0, 'INVOICED', 'x', 'x')",
            [],
        );
        assert!(rejected.is_err());

        // v3 pre-aggregation backfilled the legacy eligible row.
        let day_total: f64 = conn
            .query_row(
                "SELECT total FROM ar_daily_outstanding WHERE tx_date = '2026-08-10'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(day_total, 2500.0);

        // Idempotency: second run is a no-op staying at v3.
        MigrationManager::run_migrations(&mut conn).unwrap();
        assert_eq!(MigrationManager::get_user_version(&conn).unwrap(), 3);
    }
}
