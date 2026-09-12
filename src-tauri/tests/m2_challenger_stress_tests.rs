use chrono::{DateTime, Duration, Utc};
use rusqlite::Connection;

use apex_journal::analytics::{
    calculate_ar_aging, calculate_case_pnl, calculate_dashboard_metrics, calculate_equity_curve,
    calculate_win_rate, round2, Timeframe,
};
use apex_journal::db::{
    CaseRepo, ExchangeRateRepo, MigrationManager,
    TransactionRepo,
};
use apex_journal::models::{
    Case, CreateCaseInput,
    CreateTransactionInput, Transaction,
};

fn setup_test_db() -> Connection {
    let mut conn = Connection::open_in_memory().expect("Failed to open in-memory SQLite");
    MigrationManager::run_migrations(&mut conn).expect("Failed to run migrations");
    conn
}

// =========================================================================
// CHALLENGER 1: MATHEMATICAL & NUMERICAL PRECISION STRESS TESTS
// =========================================================================

#[test]
fn test_round2_adversarial_precision_and_negative_zeros() {
    // Exact zero representations
    assert_eq!(round2(0.0), 0.0);
    assert_eq!(round2(-0.0), 0.0);
    assert_eq!(round2(0.000001), 0.0);
    assert_eq!(round2(-0.000001), 0.0);

    // Floating point arithmetic inaccuracies
    assert_eq!(round2(0.1 + 0.2), 0.30);
    assert_eq!(round2(1.0 - 0.9), 0.10);
    assert_eq!(round2(0.7 + 0.1), 0.80);

    // Boundary roundings (half-up)
    assert_eq!(round2(10.555), 10.56);
    assert_eq!(round2(10.5549), 10.55);
    assert_eq!(round2(10.5541), 10.55);
    assert_eq!(round2(-10.555), -10.56);
    assert_eq!(round2(-10.5549), -10.55);

    // Extreme magnitudes
    assert_eq!(round2(999_999_999_999.994), 999_999_999_999.99);
    assert_eq!(round2(999_999_999_999.995), 1_000_000_000_000.00);

    // Accumulation stress test: 10,000 increments of 0.01
    let mut acc = 0.0;
    for _ in 0..10_000 {
        acc += 0.01;
    }
    assert_eq!(round2(acc), 100.00);
}

// =========================================================================
// CHALLENGER 2: CASE PnL & MARGIN STRESS & CORNER CASES
// =========================================================================

#[test]
fn test_case_pnl_adversarial_scenarios() {
    // 1. Empty transactions slice
    let pnl_empty = calculate_case_pnl(&[], None);
    assert_eq!(pnl_empty.realized_income, 0.0);
    assert_eq!(pnl_empty.realized_expense, 0.0);
    assert_eq!(pnl_empty.net_margin, 0.0);
    assert_eq!(pnl_empty.profit_margin_pct, 0.0);

    // 2. Case with ONLY expenses (Income = 0.0, Expense = 5,000.0)
    // Net Margin must be -5000.0, Profit Margin % must be 0.0 (no division by zero / no -Infinity)
    let expense_only = vec![Transaction {
        id: "tx-exp-1".into(),
        date: "2026-08-01".into(),
        r#type: "EXPENSE".into(),
        category_id: "cat-3".into(),
        category_name: None,
        amount: 5000.0,
        currency: "USD".into(),
        exchange_rate: 1.0,
        base_amount: 5000.0,
        status: "PAID".into(),
        case_id: Some("case-exp".into()),
        case_title: None,
        notes: None,
    }];
    let pnl_exp = calculate_case_pnl(&expense_only, Some("case-exp"));
    assert_eq!(pnl_exp.realized_income, 0.0);
    assert_eq!(pnl_exp.realized_expense, 5000.0);
    assert_eq!(pnl_exp.net_margin, -5000.0);
    assert_eq!(pnl_exp.profit_margin_pct, 0.0);
    assert!(!pnl_exp.profit_margin_pct.is_nan());
    assert!(!pnl_exp.profit_margin_pct.is_infinite());

    // 3. Negative net margin with positive income (Income = 1,000, Expense = 3,000)
    // Net Margin = -2,000, Profit Margin % = (-2000 / 1000) * 100 = -200.0%
    let drawdown = vec![
        Transaction {
            id: "tx-inc".into(),
            date: "2026-08-01".into(),
            r#type: "INCOME".into(),
            category_id: "cat-1".into(),
            category_name: None,
            amount: 1000.0,
            currency: "USD".into(),
            exchange_rate: 1.0,
            base_amount: 1000.0,
            status: "CLEARED".into(),
            case_id: Some("case-dd".into()),
            case_title: None,
            notes: None,
        },
        Transaction {
            id: "tx-exp".into(),
            date: "2026-08-02".into(),
            r#type: "EXPENSE".into(),
            category_id: "cat-3".into(),
            category_name: None,
            amount: 3000.0,
            currency: "USD".into(),
            exchange_rate: 1.0,
            base_amount: 3000.0,
            status: "PAID".into(),
            case_id: Some("case-dd".into()),
            case_title: None,
            notes: None,
        },
    ];
    let pnl_dd = calculate_case_pnl(&drawdown, Some("case-dd"));
    assert_eq!(pnl_dd.realized_income, 1000.0);
    assert_eq!(pnl_dd.realized_expense, 3000.0);
    assert_eq!(pnl_dd.net_margin, -2000.0);
    assert_eq!(pnl_dd.profit_margin_pct, -200.0);

    // 4. Case sensitivity in transaction status and type
    let mixed_case_txs = vec![
        Transaction {
            id: "tx-m1".into(),
            date: "2026-08-01".into(),
            r#type: "income".into(),
            category_id: "cat-1".into(),
            category_name: None,
            amount: 4000.0,
            currency: "USD".into(),
            exchange_rate: 1.0,
            base_amount: 4000.0,
            status: "cleared".into(),
            case_id: Some("case-mix".into()),
            case_title: None,
            notes: None,
        },
        Transaction {
            id: "tx-m2".into(),
            date: "2026-08-02".into(),
            r#type: "Expense".into(),
            category_id: "cat-3".into(),
            category_name: None,
            amount: 1000.0,
            currency: "USD".into(),
            exchange_rate: 1.0,
            base_amount: 1000.0,
            status: "Paid".into(),
            case_id: Some("case-mix".into()),
            case_title: None,
            notes: None,
        },
        // Unrealized status: "invoiced", "pending", "overdue", "cancelled"
        Transaction {
            id: "tx-m3".into(),
            date: "2026-08-03".into(),
            r#type: "INCOME".into(),
            category_id: "cat-1".into(),
            category_name: None,
            amount: 10000.0,
            currency: "USD".into(),
            exchange_rate: 1.0,
            base_amount: 10000.0,
            status: "INVOICED".into(),
            case_id: Some("case-mix".into()),
            case_title: None,
            notes: None,
        },
        Transaction {
            id: "tx-m4".into(),
            date: "2026-08-04".into(),
            r#type: "EXPENSE".into(),
            category_id: "cat-3".into(),
            category_name: None,
            amount: 2000.0,
            currency: "USD".into(),
            exchange_rate: 1.0,
            base_amount: 2000.0,
            status: "PENDING".into(),
            case_id: Some("case-mix".into()),
            case_title: None,
            notes: None,
        },
    ];
    let pnl_mix = calculate_case_pnl(&mixed_case_txs, Some("case-mix"));
    assert_eq!(pnl_mix.realized_income, 4000.0);
    assert_eq!(pnl_mix.realized_expense, 1000.0);
    assert_eq!(pnl_mix.net_margin, 3000.0);
    assert_eq!(pnl_mix.profit_margin_pct, 75.0);
}

// =========================================================================
// CHALLENGER 3: CUMULATIVE EQUITY CURVE & TIMEFRAME BASELINE PRESERVATION
// =========================================================================

#[test]
fn test_equity_curve_stress_leap_year_shuffled_inputs_and_baseline_invariance() {
    let ref_date: DateTime<Utc> = "2028-03-05T00:00:00Z".parse().unwrap();

    // Out-of-order date transactions spanning Leap Day 2028-02-29 and multi-month windows
    let txs = vec![
        // 1. Transaction 400 days ago (2027-01-30) -> +20,000 USD
        Transaction {
            id: "tx-old".into(),
            date: "2027-01-30".into(),
            r#type: "INCOME".into(),
            category_id: "cat-1".into(),
            category_name: None,
            amount: 20000.0,
            currency: "USD".into(),
            exchange_rate: 1.0,
            base_amount: 20000.0,
            status: "CLEARED".into(),
            case_id: None,
            case_title: None,
            notes: None,
        },
        // 2. Transaction on Leap Day 2028-02-29 -> Income 5,000, Expense 1,200 on same date -> Net +3,800
        Transaction {
            id: "tx-leap-exp".into(),
            date: "2028-02-29T14:30:00Z".into(),
            r#type: "EXPENSE".into(),
            category_id: "cat-3".into(),
            category_name: None,
            amount: 1200.0,
            currency: "USD".into(),
            exchange_rate: 1.0,
            base_amount: 1200.0,
            status: "PAID".into(),
            case_id: None,
            case_title: None,
            notes: None,
        },
        Transaction {
            id: "tx-leap-inc".into(),
            date: "2028-02-29T09:00:00Z".into(),
            r#type: "INCOME".into(),
            category_id: "cat-1".into(),
            category_name: None,
            amount: 5000.0,
            currency: "USD".into(),
            exchange_rate: 1.0,
            base_amount: 5000.0,
            status: "CLEARED".into(),
            case_id: None,
            case_title: None,
            notes: None,
        },
        // 3. Transaction 60 days ago (2028-01-05) -> -3,000 USD
        Transaction {
            id: "tx-jan".into(),
            date: "2028-01-05".into(),
            r#type: "EXPENSE".into(),
            category_id: "cat-4".into(),
            category_name: None,
            amount: 3000.0,
            currency: "USD".into(),
            exchange_rate: 1.0,
            base_amount: 3000.0,
            status: "PAID".into(),
            case_id: None,
            case_title: None,
            notes: None,
        },
        // 4. Transaction on reference date (2028-03-05) -> +1,000 USD
        Transaction {
            id: "tx-today".into(),
            date: "2028-03-05".into(),
            r#type: "INCOME".into(),
            category_id: "cat-1".into(),
            category_name: None,
            amount: 1000.0,
            currency: "USD".into(),
            exchange_rate: 1.0,
            base_amount: 1000.0,
            status: "CLEARED".into(),
            case_id: None,
            case_title: None,
            notes: None,
        },
    ];

    // ALL timeframe: Complete chronological curve
    let curve_all = calculate_equity_curve(&txs, Timeframe::All, Some(ref_date));
    assert_eq!(curve_all.len(), 4);
    // Point 1: 2027-01-30 -> Delta = +20000, Cumulative = 20000
    assert_eq!(curve_all[0].date, "2027-01-30");
    assert_eq!(curve_all[0].daily_delta, 20000.0);
    assert_eq!(curve_all[0].cumulative_equity, 20000.0);

    // Point 2: 2028-01-05 -> Delta = -3000, Cumulative = 17000
    assert_eq!(curve_all[1].date, "2028-01-05");
    assert_eq!(curve_all[1].daily_delta, -3000.0);
    assert_eq!(curve_all[1].cumulative_equity, 17000.0);

    // Point 3: 2028-02-29 (Leap Day aggregated) -> Delta = +3800, Cumulative = 20800
    assert_eq!(curve_all[2].date, "2028-02-29");
    assert_eq!(curve_all[2].daily_delta, 3800.0);
    assert_eq!(curve_all[2].cumulative_equity, 20800.0);
    assert_eq!(curve_all[2].volume_income, 5000.0);
    assert_eq!(curve_all[2].volume_expense, 1200.0);

    // Point 4: 2028-03-05 -> Delta = +1000, Cumulative = 21800
    assert_eq!(curve_all[3].date, "2028-03-05");
    assert_eq!(curve_all[3].daily_delta, 1000.0);
    assert_eq!(curve_all[3].cumulative_equity, 21800.0);

    // 1 Month timeframe (30 days prior to 2028-03-05 is 2028-02-04)
    // Should include 2028-02-29 and 2028-03-05.
    // Crucial Invariant: Cumulative equity on 2028-02-29 must be 20800 (preserving prior 17000 baseline), NOT 3800!
    let curve_1m = calculate_equity_curve(&txs, Timeframe::OneMonth, Some(ref_date));
    assert_eq!(curve_1m.len(), 2);
    assert_eq!(curve_1m[0].date, "2028-02-29");
    assert_eq!(curve_1m[0].cumulative_equity, 20800.0);
    assert_eq!(curve_1m[1].date, "2028-03-05");
    assert_eq!(curve_1m[1].cumulative_equity, 21800.0);

    // 1 Week timeframe (7 days prior to 2028-03-05 is 2028-02-27)
    // Should include 2028-02-29 and 2028-03-05.
    let curve_1w = calculate_equity_curve(&txs, Timeframe::OneWeek, Some(ref_date));
    assert_eq!(curve_1w.len(), 2);
    assert_eq!(curve_1w[0].date, "2028-02-29");
    assert_eq!(curve_1w[0].cumulative_equity, 20800.0);
}

// =========================================================================
// CHALLENGER 4: PROPOSAL WIN RATE STRESS & PROPERTY TESTS
// =========================================================================

#[test]
fn test_win_rate_stress_and_property_invariants() {
    // 1. Zero cases
    assert_eq!(calculate_win_rate(&[]), 0.0);

    // 2. Only unclosed cases (LEAD, QUOTATION, ACTIVE) -> Win rate is 0.0
    let cases_open = vec![
        create_mock_case("c1", "LEAD", 10000.0),
        create_mock_case("c2", "QUOTATION", 20000.0),
        create_mock_case("c3", "ACTIVE", 30000.0),
    ];
    assert_eq!(calculate_win_rate(&cases_open), 0.0);

    // 3. Exactly 1 WON out of 3 closed (1 / 3 = 33.3333... -> 33.33%)
    let cases_third = vec![
        create_mock_case("c1", "COMPLETED", 10000.0),
        create_mock_case("c2", "LOST", 20000.0),
        create_mock_case("c3", "LOST", 30000.0),
        create_mock_case("c4", "ACTIVE", 40000.0), // Ignored
    ];
    assert_eq!(calculate_win_rate(&cases_third), 33.33);

    // 4. Exactly 2 WON out of 3 closed (2 / 3 = 66.6666... -> 66.67%)
    let cases_two_thirds = vec![
        create_mock_case("c1", "COMPLETED", 10000.0),
        create_mock_case("c2", "COMPLETED", 20000.0),
        create_mock_case("c3", "LOST", 30000.0),
    ];
    assert_eq!(calculate_win_rate(&cases_two_thirds), 66.67);

    // 5. 1 WON out of 7 closed (1 / 7 = 14.2857... -> 14.29%)
    let cases_seventh = vec![
        create_mock_case("c1", "COMPLETED", 10000.0),
        create_mock_case("c2", "LOST", 10000.0),
        create_mock_case("c3", "LOST", 10000.0),
        create_mock_case("c4", "LOST", 10000.0),
        create_mock_case("c5", "LOST", 10000.0),
        create_mock_case("c6", "LOST", 10000.0),
        create_mock_case("c7", "LOST", 10000.0),
    ];
    assert_eq!(calculate_win_rate(&cases_seventh), 14.29);

    // 6. Case sensitivity test: "completed", "lost" in lowercase
    let cases_lowercase = vec![
        create_mock_case("c1", "completed", 10000.0),
        create_mock_case("c2", "lost", 10000.0),
    ];
    assert_eq!(calculate_win_rate(&cases_lowercase), 50.0);

    // 7. Property test: 5,000 cases with 2,500 completed and 2,500 lost -> exactly 50.0%
    let mut large_cases = Vec::with_capacity(5000);
    for i in 0..2500 {
        large_cases.push(create_mock_case(&format!("w-{}", i), "COMPLETED", 1000.0));
        large_cases.push(create_mock_case(&format!("l-{}", i), "LOST", 1000.0));
    }
    assert_eq!(calculate_win_rate(&large_cases), 50.0);
}

// =========================================================================
// CHALLENGER 5: ACCOUNTS RECEIVABLE AGING STRICT BOUNDARY & TRAFFIC LIGHT
// =========================================================================

#[test]
fn test_ar_aging_strict_day_boundaries_and_traffic_light_priority() {
    let ref_date: DateTime<Utc> = "2026-09-01T00:00:00Z".parse().unwrap();
    let ref_naive = ref_date.date_naive();

    // Create transactions for each exact day boundary:
    // age 0  -> 2026-09-01 -> Bucket 1 (0-30d)
    // age 30 -> 2026-08-02 -> Bucket 1 (0-30d)
    // age 31 -> 2026-08-01 -> Bucket 2 (31-60d)
    // age 60 -> 2026-07-03 -> Bucket 2 (31-60d)
    // age 61 -> 2026-07-02 -> Bucket 3 (61-90d)
    // age 90 -> 2026-06-03 -> Bucket 3 (61-90d)
    // age 91 -> 2026-06-02 -> Bucket 4 (90+d)
    let d_0 = (ref_naive - Duration::days(0)).to_string();
    let d_30 = (ref_naive - Duration::days(30)).to_string();
    let d_31 = (ref_naive - Duration::days(31)).to_string();
    let d_60 = (ref_naive - Duration::days(60)).to_string();
    let d_61 = (ref_naive - Duration::days(61)).to_string();
    let d_90 = (ref_naive - Duration::days(90)).to_string();
    let d_91 = (ref_naive - Duration::days(91)).to_string();

    let tx_0 = create_mock_tx("t0", &d_0, "INCOME", 100.0, "INVOICED");
    let tx_30 = create_mock_tx("t30", &d_30, "INCOME", 200.0, "PENDING");
    let tx_31 = create_mock_tx("t31", &d_31, "INCOME", 400.0, "INVOICED");
    let tx_60 = create_mock_tx("t60", &d_60, "INCOME", 800.0, "PENDING");
    let tx_61 = create_mock_tx("t61", &d_61, "INCOME", 1600.0, "INVOICED");
    let tx_90 = create_mock_tx("t90", &d_90, "INCOME", 3200.0, "PENDING");
    let tx_91 = create_mock_tx("t91", &d_91, "INCOME", 6400.0, "INVOICED");

    // Test Bucket 1 only (age 0 and age 30) -> Traffic Light GREEN
    let ar_b1 = calculate_ar_aging(&[tx_0.clone(), tx_30.clone()], Some(ref_date));
    assert_eq!(ar_b1.current_0_30, 300.0);
    assert_eq!(ar_b1.pending_31_60, 0.0);
    assert_eq!(ar_b1.overdue_61_90, 0.0);
    assert_eq!(ar_b1.critical_90_plus, 0.0);
    assert_eq!(ar_b1.total_receivable, 300.0);
    assert_eq!(ar_b1.traffic_light, "GREEN");

    // Test Bucket 2 boundary (age 31 and age 60) -> Traffic Light still GREEN
    let ar_b2 = calculate_ar_aging(&[tx_31.clone(), tx_60.clone()], Some(ref_date));
    assert_eq!(ar_b2.current_0_30, 0.0);
    assert_eq!(ar_b2.pending_31_60, 1200.0);
    assert_eq!(ar_b2.overdue_61_90, 0.0);
    assert_eq!(ar_b2.critical_90_plus, 0.0);
    assert_eq!(ar_b2.total_receivable, 1200.0);
    assert_eq!(ar_b2.traffic_light, "GREEN");

    // Test Bucket 3 boundary (age 61 and age 90) -> Traffic Light transitions to YELLOW
    let ar_b3 = calculate_ar_aging(&[tx_61.clone(), tx_90.clone()], Some(ref_date));
    assert_eq!(ar_b3.current_0_30, 0.0);
    assert_eq!(ar_b3.pending_31_60, 0.0);
    assert_eq!(ar_b3.overdue_61_90, 4800.0);
    assert_eq!(ar_b3.critical_90_plus, 0.0);
    assert_eq!(ar_b3.total_receivable, 4800.0);
    assert_eq!(ar_b3.traffic_light, "YELLOW");

    // Test Bucket 4 boundary (age 91) -> Traffic Light transitions to RED
    let ar_b4 = calculate_ar_aging(&[tx_91.clone()], Some(ref_date));
    assert_eq!(ar_b4.current_0_30, 0.0);
    assert_eq!(ar_b4.pending_31_60, 0.0);
    assert_eq!(ar_b4.overdue_61_90, 0.0);
    assert_eq!(ar_b4.critical_90_plus, 6400.0);
    assert_eq!(ar_b4.total_receivable, 6400.0);
    assert_eq!(ar_b4.traffic_light, "RED");

    // Test Priority: All buckets together -> Traffic Light must be RED (because critical_90_plus > 0)
    let all_txs = vec![tx_0, tx_30, tx_31, tx_60, tx_61, tx_90, tx_91];
    let ar_all = calculate_ar_aging(&all_txs, Some(ref_date));
    assert_eq!(ar_all.current_0_30, 300.0);
    assert_eq!(ar_all.pending_31_60, 1200.0);
    assert_eq!(ar_all.overdue_61_90, 4800.0);
    assert_eq!(ar_all.critical_90_plus, 6400.0);
    assert_eq!(ar_all.total_receivable, 12700.0);
    assert_eq!(ar_all.traffic_light, "RED");

    // Test Future-dated invoice (e.g. 5 days in future) -> clamped to age 0 -> goes into current_0_30
    let d_future = (ref_naive + Duration::days(5)).to_string();
    let tx_future = create_mock_tx("tf", &d_future, "INCOME", 500.0, "INVOICED");
    let ar_future = calculate_ar_aging(&[tx_future], Some(ref_date));
    assert_eq!(ar_future.current_0_30, 500.0);
    assert_eq!(ar_future.total_receivable, 500.0);
    assert_eq!(ar_future.traffic_light, "GREEN");
}

// =========================================================================
// CHALLENGER 6: EXECUTIVE DASHBOARD METRICS INTEGRATION & MULTI-CURRENCY
// =========================================================================

#[test]
fn test_dashboard_and_multi_currency_stress() {
    let conn = setup_test_db();

    // Set custom exchange rates
    ExchangeRateRepo::set_rate(&conn, "BTC", 65000.50).expect("Failed to set BTC rate");
    ExchangeRateRepo::set_rate(&conn, "VND", 0.000041).expect("Failed to set VND rate");

    // 1. Create a Completed Case (Quoted 100,000 USD)
    let case1 = CaseRepo::create(
        &conn,
        CreateCaseInput {
            id: None,
            code: None,
            title: "Enterprise Overhaul".into(),
            client_name: "MegaCorp".into(),
            client_contact: None,
            stage: Some("COMPLETED".into()),
            quoted_amount: Some(100000.0),
            currency: Some("USD".into()),
            start_date: None,
            target_completion_date: None,
            closed_date: None,
            notes: None,
            created_at: None,
            updated_at: None,
        },
    )
    .expect("Failed to create case 1");

    // 2. Create an Active Case (Quoted 50,000 USD)
    let case2 = CaseRepo::create(
        &conn,
        CreateCaseInput {
            id: None,
            code: None,
            title: "Ongoing Advisory".into(),
            client_name: "Acme LLC".into(),
            client_contact: None,
            stage: Some("ACTIVE".into()),
            quoted_amount: Some(50000.0),
            currency: Some("USD".into()),
            start_date: None,
            target_completion_date: None,
            closed_date: None,
            notes: None,
            created_at: None,
            updated_at: None,
        },
    )
    .expect("Failed to create case 2");

    // 3. Create a Lost Case (Quoted 80,000 USD)
    let _case3 = CaseRepo::create(
        &conn,
        CreateCaseInput {
            id: None,
            code: None,
            title: "Failed Pitch".into(),
            client_name: "Unicorn Inc".into(),
            client_contact: None,
            stage: Some("LOST".into()),
            quoted_amount: Some(80000.0),
            currency: Some("USD".into()),
            start_date: None,
            target_completion_date: None,
            closed_date: None,
            notes: None,
            created_at: None,
            updated_at: None,
        },
    )
    .expect("Failed to create case 3");

    // 4. Create Transactions
    // Transaction in BTC: 2.0 BTC @ 65000.50 = 130001.00 USD (Income, CLEARED)
    let tx_btc = TransactionRepo::create(
        &conn,
        CreateTransactionInput {
            id: None,
            date: "2026-08-10".into(),
            r#type: "INCOME".into(),
            category_id: Some("cat-1".into()),
            category_name: None,
            amount: 2.0,
            currency: Some("BTC".into()),
            exchange_rate: None,
            status: Some("CLEARED".into()),
            case_id: Some(case1.id.clone()),
            case_title: None,
            notes: None,
        },
    )
    .expect("Failed to create BTC tx");
    assert_eq!(tx_btc.base_amount, 130001.00);

    // Transaction in VND: 1,000,000 VND @ 0.000041 = 41.00 USD (Expense, PAID)
    let tx_vnd = TransactionRepo::create(
        &conn,
        CreateTransactionInput {
            id: None,
            date: "2026-08-11".into(),
            r#type: "EXPENSE".into(),
            category_id: Some("cat-4".into()),
            category_name: None,
            amount: 1000000.0,
            currency: Some("VND".into()),
            exchange_rate: None,
            status: Some("PAID".into()),
            case_id: Some(case1.id.clone()),
            case_title: None,
            notes: None,
        },
    )
    .expect("Failed to create VND tx");
    assert_eq!(tx_vnd.base_amount, 41.00);

    // Invoiced Transaction in USD: 15,000 USD (Income, INVOICED)
    let tx_inv = TransactionRepo::create(
        &conn,
        CreateTransactionInput {
            id: None,
            date: "2026-08-12".into(),
            r#type: "INCOME".into(),
            category_id: Some("cat-1".into()),
            category_name: None,
            amount: 15000.0,
            currency: Some("USD".into()),
            exchange_rate: Some(1.0),
            status: Some("INVOICED".into()),
            case_id: Some(case2.id.clone()),
            case_title: None,
            notes: None,
        },
    )
    .expect("Failed to create Invoiced tx");
    assert_eq!(tx_inv.base_amount, 15000.00);

    // Fetch all cases and transactions from DB
    let cases = CaseRepo::list(&conn).expect("Failed to list cases");
    let txs = TransactionRepo::list(&conn, None).expect("Failed to list txs");

    let metrics = calculate_dashboard_metrics(&txs, &cases, "USD");

    // Realized Net Margin: 130001.00 - 41.00 = 129960.00 USD
    assert_eq!(metrics.cumulative_net_margin, 129960.00);
    assert_eq!(metrics.realized_volume, 130001.00);

    // Win Rate: 1 COMPLETED out of 2 closed (COMPLETED + LOST) = 50.0%
    assert_eq!(metrics.proposal_win_rate, 50.00);

    // Invoiced Volume: (100,000 COMPLETED + 50,000 ACTIVE) + 15,000 INVOICED tx = 165,000.00 USD
    assert_eq!(metrics.invoiced_volume, 165000.00);

    // Average Ticket Size: Only 1 COMPLETED case with 100,000.00 USD quoted -> 100,000.00 USD
    assert_eq!(metrics.avg_ticket_size, 100000.00);
    assert_eq!(metrics.base_currency, "USD");
}

// =========================================================================
// TEST HELPERS
// =========================================================================

fn create_mock_case(id: &str, stage: &str, quoted_amount: f64) -> Case {
    Case {
        id: id.into(),
        code: format!("CASE-{}", id),
        title: format!("Case {}", id),
        client_name: "Mock Client".into(),
        client_contact: None,
        stage: stage.into(),
        quoted_amount,
        currency: "USD".into(),
        proposal_value_base: quoted_amount,
        start_date: None,
        target_completion_date: None,
        closed_date: None,
        notes: None,
        created_at: "".into(),
        updated_at: "".into(),
    }
}

fn create_mock_tx(id: &str, date: &str, r#type: &str, amount: f64, status: &str) -> Transaction {
    Transaction {
        id: id.into(),
        date: date.into(),
        r#type: r#type.into(),
        category_id: "cat-1".into(),
        category_name: None,
        amount,
        currency: "USD".into(),
        exchange_rate: 1.0,
        base_amount: amount,
        status: status.into(),
        case_id: None,
        case_title: None,
        notes: None,
    }
}
