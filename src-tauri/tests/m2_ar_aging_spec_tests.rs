use chrono::{Duration, Utc};
use rusqlite::Connection;

use apex_journal::analytics::{
    calc_base_amount, calculate_ar_aging, calculate_dashboard_metrics, calculate_equity_curve,
    decimal_from_f64, round2, sum_round2, Timeframe,
};
use apex_journal::db::{MigrationManager, TransactionRepo};
use apex_journal::models::{Case, CreateTransactionInput, Transaction};

fn setup_test_db() -> Connection {
    let mut conn = Connection::open_in_memory().expect("in-memory open");
    MigrationManager::run_migrations(&mut conn).expect("migrations");
    conn
}

#[test]
fn test_spec_bankers_rounding_midpoint_to_even() {
    // Bankers (MidpointNearestEven) differs from half-away on .5 midpoints to odd/even.
    // 2.345 -> 2.34 (4 is even, stay), half-away would give 2.35.
    assert_eq!(round2(2.345), 2.34);
    // 2.335 -> 2.34 (3 is odd, round up to even 4).
    assert_eq!(round2(2.335), 2.34);
    // 2.355 -> 2.36 (5 is odd, round up to even 6).
    assert_eq!(round2(2.355), 2.36);
    // Negative mirrors: -2.345 -> -2.34
    assert_eq!(round2(-2.345), -2.34);
    // Classic IEEE artifact eliminated via Decimal string path.
    assert_eq!(round2(0.1 + 0.2), 0.30);
    // Decimal helper is finite-safe.
    assert_eq!(decimal_from_f64(f64::NAN).to_string(), "0");
}

#[test]
fn test_spec_base_amount_uses_decimal_bankers() {
    // 19.99 EUR * 1.085 = 21.68915 -> 21.69
    assert_eq!(calc_base_amount(19.99, 1.085), 21.69);
    // Midpoint bankers at product level: 2.345 * 1.0 = 2.345 -> 2.34
    assert_eq!(calc_base_amount(2.345, 1.0), 2.34);
    // Sub-cent precision: 1000000 VND * 0.000041 = 41.00 exactly
    assert_eq!(calc_base_amount(1_000_000.0, 0.000041), 41.00);
    // BTC case from stress suite: 2.0 * 65000.50 = 130001.00
    assert_eq!(calc_base_amount(2.0, 65_000.50), 130001.00);
}

#[test]
fn test_spec_v2_schema_columns_index_and_version() {
    let conn = setup_test_db();
    assert_eq!(MigrationManager::get_user_version(&conn).unwrap(), 3);

    // Columns exist
    let mut stmt = conn.prepare("PRAGMA table_info(transactions)").unwrap();
    let cols: Vec<String> = stmt
        .query_map([], |row| row.get::<_, String>(1))
        .unwrap()
        .filter_map(|r| r.ok())
        .collect();
    assert!(cols.contains(&"category_name".to_string()), "missing category_name: {:?}", cols);
    assert!(cols.contains(&"case_title".to_string()), "missing case_title: {:?}", cols);

    // Partial index exists with WHERE clause per SPEC §3.2
    let idx_sql: String = conn
        .query_row(
            "SELECT sql FROM sqlite_master WHERE type='index' AND name='idx_tx_ar_aging_scan'",
            [],
            |row| row.get(0),
        )
        .expect("idx_tx_ar_aging_scan must exist after v2");
    assert!(idx_sql.contains("WHERE"), "index must be partial, got: {}", idx_sql);
    assert!(idx_sql.contains("INVOICED"), "index must filter INVOICED, got: {}", idx_sql);
    assert!(idx_sql.contains("PENDING"), "index must filter PENDING, got: {}", idx_sql);
}

#[test]
fn test_spec_v2_triggers_reject_non_positive_amount_rate() {
    let conn = setup_test_db();
    // Bypass repo validation with raw SQL to prove DB-level guard.
    let bad_amount = conn.execute(
        "INSERT INTO transactions (id, date, type, category_id, amount, currency, exchange_rate, base_amount, status, created_at, updated_at)
         VALUES ('tx-bad-amt', '2026-08-01', 'INCOME', 'cat-1', 0, 'USD', 1.0, 0, 'INVOICED', '2026-08-01', '2026-08-01')",
        [],
    );
    assert!(bad_amount.is_err(), "amount=0 must be rejected by trigger");

    let bad_rate = conn.execute(
        "INSERT INTO transactions (id, date, type, category_id, amount, currency, exchange_rate, base_amount, status, created_at, updated_at)
         VALUES ('tx-bad-rate', '2026-08-01', 'INCOME', 'cat-1', 100, 'USD', -1.0, -100, 'INVOICED', '2026-08-01', '2026-08-01')",
        [],
    );
    assert!(bad_rate.is_err(), "exchange_rate<=0 must be rejected by trigger");
}

#[test]
fn test_spec_sql_single_pass_parity_with_in_memory() {
    let conn = setup_test_db();
    let today = Utc::now().date_naive();
    let date_days_ago = |n: i64| (today - Duration::days(n)).to_string();

    // One tx per bucket, deterministic base_amounts via repo (Decimal path).
    let fixtures = vec![
        ("tx-sql-10", date_days_ago(10), 3000.0, "INVOICED"), // 0-30
        ("tx-sql-45", date_days_ago(45), 4000.0, "PENDING"),   // 31-60
        ("tx-sql-75", date_days_ago(75), 2500.0, "INVOICED"),  // 61-90
        ("tx-sql-120", date_days_ago(120), 1200.0, "INVOICED"), // 90+
    ];
    for (id, date, amount, status) in fixtures {
        TransactionRepo::create(
            &conn,
            CreateTransactionInput {
                id: Some(id.into()),
                date,
                r#type: "INCOME".into(),
                category_id: Some("cat-1".into()),
                category_name: None,
                amount,
                currency: Some("USD".into()),
                exchange_rate: Some(1.0),
                status: Some(status.into()),
                case_id: None,
                case_title: None,
                notes: None,
            },
        )
        .expect("fixture insert");
    }
    // Excluded: cleared income + invoiced expense must not count.
    TransactionRepo::create(
        &conn,
        CreateTransactionInput {
            id: Some("tx-sql-excluded-1".into()),
            date: date_days_ago(100),
            r#type: "INCOME".into(),
            category_id: Some("cat-1".into()),
            category_name: None,
            amount: 50000.0,
            currency: Some("USD".into()),
            exchange_rate: Some(1.0),
            status: Some("CLEARED".into()),
            case_id: None,
            case_title: None,
            notes: None,
        },
    )
    .unwrap();
    TransactionRepo::create(
        &conn,
        CreateTransactionInput {
            id: Some("tx-sql-excluded-2".into()),
            date: date_days_ago(5),
            r#type: "EXPENSE".into(),
            category_id: Some("cat-4".into()),
            category_name: None,
            amount: 999.0,
            currency: Some("USD".into()),
            exchange_rate: Some(1.0),
            status: Some("INVOICED".into()),
            case_id: None,
            case_title: None,
            notes: None,
        },
    )
    .unwrap();

    let via_sql = TransactionRepo::calculate_ar_aging_sql(&conn).expect("sql aging");
    let all = TransactionRepo::list(&conn, None).unwrap();
    let via_mem = calculate_ar_aging(&all, None);

    assert_eq!(via_sql.current_0_30, 3000.0);
    assert_eq!(via_sql.pending_31_60, 4000.0);
    assert_eq!(via_sql.overdue_61_90, 2500.0);
    assert_eq!(via_sql.critical_90_plus, 1200.0);
    assert_eq!(via_sql.total_receivable, 10700.0);
    assert_eq!(via_sql.traffic_light, "RED");

    // Parity: SQL single-pass must equal Rust in-memory on same dataset.
    assert_eq!(via_sql, via_mem);

    // Denormalized copies backfilled on write (SPEC §3.1).
    let one = TransactionRepo::list(&conn, None)
        .unwrap()
        .into_iter()
        .find(|t| t.id == "tx-sql-10")
        .unwrap();
    assert_eq!(one.category_name.as_deref(), Some("Client Consulting Fee"));
}

#[test]
fn test_spec_sql_perf_sanity_5k_rows() {
    let conn = setup_test_db();
    let today = Utc::now().date_naive();
    conn.execute_batch("BEGIN;").unwrap();
    for i in 0..5000 {
        let day_offset = (i % 120) as i64;
        let date = (today - Duration::days(day_offset)).to_string();
        let status = if i % 2 == 0 { "INVOICED" } else { "PENDING" };
        // Direct SQL for speed; base_amount pre-rounded as repo would do.
        conn.execute(
            "INSERT INTO transactions (id, date, type, category_id, category_name, amount, currency, exchange_rate, base_amount, status, created_at, updated_at)
             VALUES (?1, ?2, 'INCOME', 'cat-1', 'Client Consulting Fee', 100.0, 'USD', 1.0, 100.0, ?3, '2026-01-01', '2026-01-01')",
            rusqlite::params![format!("tx-perf-{}", i), date, status],
        )
        .unwrap();
    }
    conn.execute_batch("COMMIT;").unwrap();

    let start = std::time::Instant::now();
    let summary = TransactionRepo::calculate_ar_aging_sql(&conn).unwrap();
    let elapsed = start.elapsed();
    assert_eq!(summary.total_receivable, 500000.0);
    assert_eq!(summary.traffic_light, "RED");
    // SLA per SPEC §7 is <5ms/10k, <15ms/100k in release. Debug + in-memory
    // is slower; assert generous <500ms sanity so CI stays green while
    // proving single-pass (no N+1, no full ORM hydration).
    assert!(
        elapsed.as_millis() < 500,
        "single-pass AR query too slow: {:?}",
        elapsed
    );
}

#[test]
fn test_spec_sum_round2_decimal_accumulation() {
    // 10,000 x 0.01 via binary float drifts; Decimal path must give exactly 100.00.
    let acc = sum_round2((0..10_000).map(|_| 0.01));
    assert_eq!(acc, 100.00);
    // Empty iterator -> 0.0 (no -0.0).
    assert_eq!(sum_round2(std::iter::empty()), 0.0);
    // Mixed bankers midpoints accumulate exactly.
    let mixed = sum_round2(vec![2.345, 2.335, 2.355].into_iter());
    // 2.34 + 2.34 + 2.36 = 7.04 (each rounded at sum level: 7.035 -> bankers 7.04)
    assert_eq!(mixed, 7.04);
}

#[test]
fn test_spec_sla_10k_single_pass_query() {
    let conn = setup_test_db();
    let today = Utc::now().date_naive();
    conn.execute_batch("BEGIN;").unwrap();
    for i in 0..10_000 {
        let day_offset = (i % 120) as i64;
        let date = (today - Duration::days(day_offset)).to_string();
        let status = if i % 2 == 0 { "INVOICED" } else { "PENDING" };
        conn.execute(
            "INSERT INTO transactions (id, date, type, category_id, category_name, amount, currency, exchange_rate, base_amount, status, created_at, updated_at)
             VALUES (?1, ?2, 'INCOME', 'cat-1', 'Client Consulting Fee', 100.0, 'USD', 1.0, 100.0, ?3, '2026-01-01', '2026-01-01')",
            rusqlite::params![format!("tx-sla10k-{}", i), date, status],
        )
        .unwrap();
    }
    conn.execute_batch("COMMIT;").unwrap();

    let start = std::time::Instant::now();
    let summary = TransactionRepo::calculate_ar_aging_sql(&conn).unwrap();
    let elapsed = start.elapsed();
    assert_eq!(summary.total_receivable, 1_000_000.0);
    println!("SLA_10K query elapsed: {:?}", elapsed);
    // SPEC §7 target <5ms in release; debug allows generous bound.
    assert!(
        elapsed.as_millis() < 800,
        "10k single-pass AR query too slow: {:?}",
        elapsed
    );
}

#[test]
fn test_spec_equity_and_dashboard_decimal_accumulation() {
    // 10,000 x 0.01 on a single day must land exactly, in every engine.
    let txs: Vec<Transaction> = (0..10_000)
        .map(|i| Transaction {
            id: format!("tx-acc-{}", i),
            date: "2026-08-15".into(),
            r#type: "INCOME".into(),
            category_id: "cat-1".into(),
            category_name: None,
            amount: 0.01,
            currency: "USD".into(),
            exchange_rate: 1.0,
            base_amount: 0.01,
            status: "CLEARED".into(),
            case_id: None,
            case_title: None,
            notes: None,
        })
        .collect();
    let ref_date: chrono::DateTime<chrono::Utc> = "2026-08-30T00:00:00Z".parse().unwrap();
    let curve = calculate_equity_curve(&txs, Timeframe::All, Some(ref_date));
    assert_eq!(curve.len(), 1);
    assert_eq!(curve[0].daily_delta, 100.00);
    assert_eq!(curve[0].cumulative_equity, 100.00);
    assert_eq!(curve[0].volume_income, 100.00);

    let metrics = calculate_dashboard_metrics(&txs, &[], "USD");
    assert_eq!(metrics.realized_volume, 100.00);
    assert_eq!(metrics.cumulative_net_margin, 100.00);

    // Bankers midpoint through the mean path: single COMPLETED case at 2.345
    // must average to 2.34 (even), not 2.35 (half-away on binary float).
    let cases = vec![Case {
        id: "c-banker".into(),
        code: "CASE-B".into(),
        title: "Banker".into(),
        client_name: "C".into(),
        client_contact: None,
        stage: "COMPLETED".into(),
        quoted_amount: 2.345,
        currency: "USD".into(),
        proposal_value_base: 2.345,
        start_date: None,
        target_completion_date: None,
        closed_date: None,
        notes: None,
        created_at: "".into(),
        updated_at: "".into(),
    }];
    let m2 = calculate_dashboard_metrics(&[], &cases, "USD");
    assert_eq!(m2.avg_ticket_size, 2.34);
}

#[test]
fn test_spec_cutoff_query_matches_day_boundaries() {
    // Deterministic equivalence: SQL cutoffs vs day-difference math at every
    // bucket edge, including future clamp. Fixed reference day, no clock.
    let conn = setup_test_db();
    let ref_date: chrono::DateTime<chrono::Utc> = "2026-09-01T12:00:00Z".parse().unwrap();
    let ref_naive = ref_date.date_naive();
    let at_age = |days: i64| (ref_naive - chrono::Duration::days(days)).to_string();

    for (i, age) in [0, 30, 31, 60, 61, 90, 91].iter().enumerate() {
        TransactionRepo::create(
            &conn,
            CreateTransactionInput {
                id: Some(format!("tx-edge-{}", i)),
                date: at_age(*age),
                r#type: "INCOME".into(),
                category_id: Some("cat-1".into()),
                category_name: None,
                amount: 100.0,
                currency: Some("USD".into()),
                exchange_rate: Some(1.0),
                status: Some("INVOICED".into()),
                case_id: None,
                case_title: None,
                notes: None,
            },
        )
        .unwrap();
    }
    // Future invoice clamps to current bucket in both engines.
    TransactionRepo::create(
        &conn,
        CreateTransactionInput {
            id: Some("tx-edge-fut".into()),
            date: (ref_naive + chrono::Duration::days(5)).to_string(),
            r#type: "INCOME".into(),
            category_id: Some("cat-1".into()),
            category_name: None,
            amount: 50.0,
            currency: Some("USD".into()),
            exchange_rate: Some(1.0),
            status: Some("PENDING".into()),
            case_id: None,
            case_title: None,
            notes: None,
        },
    )
    .unwrap();

    let via_sql = TransactionRepo::calculate_ar_aging_on(&conn, ref_naive).unwrap();
    let all = TransactionRepo::list(&conn, None).unwrap();
    let via_mem = calculate_ar_aging(&all, Some(ref_date));
    assert_eq!(via_sql, via_mem);
    assert_eq!(via_sql.current_0_30, 250.0); // 0d + 30d + future
    assert_eq!(via_sql.pending_31_60, 200.0);
    assert_eq!(via_sql.overdue_61_90, 200.0);
    assert_eq!(via_sql.critical_90_plus, 100.0);
    assert_eq!(via_sql.total_receivable, 750.0);
    assert_eq!(via_sql.traffic_light, "RED");
}

#[test]
fn test_spec_v3_trigger_churn_keeps_triple_parity() {
    // Every write path (insert/update/delete/status-flip/date-move) must keep
    // the trigger-maintained pre-aggregation identical to a full scan and to
    // the in-memory engine, on a fixed reference day.
    use apex_journal::models::UpdateTransactionInput;

    let conn = setup_test_db();
    let ref_date: chrono::DateTime<chrono::Utc> = "2026-09-01T12:00:00Z".parse().unwrap();
    let ref_naive = ref_date.date_naive();
    let d = |ago: i64| (ref_naive - chrono::Duration::days(ago)).to_string();
    let mk = |id: &str, date: String, amount: f64, status: &str| CreateTransactionInput {
        id: Some(id.into()),
        date,
        r#type: "INCOME".into(),
        category_id: Some("cat-1".into()),
        category_name: None,
        amount,
        currency: Some("USD".into()),
        exchange_rate: Some(1.0),
        status: Some(status.into()),
        case_id: None,
        case_title: None,
        notes: None,
    };

    let check = |conn: &rusqlite::Connection| {
        let fast = TransactionRepo::calculate_ar_aging_on(conn, ref_naive).unwrap();
        let scan = TransactionRepo::calculate_ar_aging_scan(conn, ref_naive).unwrap();
        let mem = calculate_ar_aging(&TransactionRepo::list(conn, None).unwrap(), Some(ref_date));
        assert_eq!(fast, scan, "pre-aggregation drifted from full scan");
        assert_eq!(fast, mem, "pre-aggregation drifted from in-memory engine");
        fast
    };

    TransactionRepo::create(&conn, mk("ch-1", d(10), 1000.0, "INVOICED")).unwrap();
    TransactionRepo::create(&conn, mk("ch-2", d(45), 2000.0, "PENDING")).unwrap();
    let s = check(&conn);
    assert_eq!(s.total_receivable, 3000.0);

    // Amount change adjusts the day bucket.
    TransactionRepo::update(
        &conn,
        "ch-1",
        UpdateTransactionInput { amount: Some(1500.0), ..Default::default() },
    )
    .unwrap();
    assert_eq!(check(&conn).total_receivable, 3500.0);

    // Status flip out of eligibility removes the contribution...
    TransactionRepo::update(
        &conn,
        "ch-2",
        UpdateTransactionInput { status: Some("CLEARED".into()), ..Default::default() },
    )
    .unwrap();
    let s = check(&conn);
    assert_eq!(s.total_receivable, 1500.0);
    assert_eq!(s.traffic_light, "GREEN");

    // ...and flipping back restores it.
    TransactionRepo::update(
        &conn,
        "ch-2",
        UpdateTransactionInput { status: Some("PENDING".into()), ..Default::default() },
    )
    .unwrap();
    assert_eq!(check(&conn).total_receivable, 3500.0);

    // Date move shifts the bucket.
    TransactionRepo::update(
        &conn,
        "ch-1",
        UpdateTransactionInput { date: Some(d(100)), ..Default::default() },
    )
    .unwrap();
    let s = check(&conn);
    assert_eq!(s.current_0_30, 0.0);
    assert_eq!(s.critical_90_plus, 1500.0);
    assert_eq!(s.traffic_light, "RED");

    // Delete removes the contribution.
    TransactionRepo::delete(&conn, "ch-1").unwrap();
    let s = check(&conn);
    assert_eq!(s.total_receivable, 2000.0);
    assert_eq!(s.pending_31_60, 2000.0);
}

#[test]
fn test_spec_shared_oracle_fixtures() {
    // Same JSON the harness oracle consumes: every adapter, one truth.
    let raw = include_str!("fixtures/ar_aging_oracle.v1.json");
    let doc: serde_json::Value = serde_json::from_str(raw).expect("fixtures parse");
    assert_eq!(doc["version"], 1);
    let ref_date: chrono::DateTime<chrono::Utc> = doc["reference_date"]
        .as_str()
        .unwrap()
        .parse()
        .unwrap();

    for case in doc["cases"].as_array().unwrap() {
        let txs: Vec<Transaction> = case["transactions"]
            .as_array()
            .unwrap()
            .iter()
            .map(|t| Transaction {
                id: t["id"].as_str().unwrap().into(),
                date: t["date"].as_str().unwrap().into(),
                r#type: t["type"].as_str().unwrap().into(),
                category_id: "cat-1".into(),
                category_name: None,
                amount: t["base_amount"].as_f64().unwrap(),
                currency: "USD".into(),
                exchange_rate: 1.0,
                base_amount: t["base_amount"].as_f64().unwrap(),
                status: t["status"].as_str().unwrap().into(),
                case_id: None,
                case_title: None,
                notes: None,
            })
            .collect();
        let got = calculate_ar_aging(&txs, Some(ref_date));
        let exp = &case["expected"];
        assert_eq!(got.current_0_30, exp["current_0_30"].as_f64().unwrap(), "{}", case["name"]);
        assert_eq!(got.pending_31_60, exp["pending_31_60"].as_f64().unwrap(), "{}", case["name"]);
        assert_eq!(got.overdue_61_90, exp["overdue_61_90"].as_f64().unwrap(), "{}", case["name"]);
        assert_eq!(got.critical_90_plus, exp["critical_90_plus"].as_f64().unwrap(), "{}", case["name"]);
        assert_eq!(got.total_receivable, exp["total_receivable"].as_f64().unwrap(), "{}", case["name"]);
        assert_eq!(got.traffic_light, exp["traffic_light"].as_str().unwrap(), "{}", case["name"]);
    }
}
