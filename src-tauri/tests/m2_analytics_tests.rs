use chrono::{DateTime, Utc};
use rusqlite::Connection;

use apex_journal::analytics::{
    calculate_ar_aging, calculate_case_pnl, calculate_dashboard_metrics, calculate_equity_curve,
    calculate_portfolio_pnl, calculate_win_rate, round2, Timeframe,
};
use apex_journal::db::{
    CaseRepo, CategoryRepo, ExchangeRateRepo, JournalRepo, MigrationManager, MilestoneRepo,
    TransactionRepo,
};
use apex_journal::models::{
    Case, CreateCaseInput, CreateJournalInput, CreateMilestoneInput,
    CreateTransactionInput, Transaction, TransactionFilter,
};

fn setup_test_db() -> Connection {
    let mut conn = Connection::open_in_memory().expect("Failed to open in-memory SQLite");
    MigrationManager::run_migrations(&mut conn).expect("Failed to run migrations");
    conn
}

// =========================================================================
// 1. DETERMINISTIC FINANCIAL MATH & PnL TESTS
// =========================================================================

#[test]
fn test_round2_deterministic_precision() {
    assert_eq!(round2(0.0), 0.0);
    assert_eq!(round2(-0.0), 0.0);
    assert_eq!(round2(0.1 + 0.2), 0.30);
    assert_eq!(round2(10.555), 10.56);
    assert_eq!(round2(10.554), 10.55);
    assert_eq!(round2(-10.556), -10.56);
}

#[test]
fn test_case_pnl_realized_vs_unrealized() {
    let txs = vec![
        Transaction {
            id: "tx-1".into(),
            date: "2026-08-01".into(),
            r#type: "INCOME".into(),
            category_id: "cat-1".into(),
            category_name: Some("Client Consulting Fee".into()),
            amount: 5000.0,
            currency: "USD".into(),
            exchange_rate: 1.0,
            base_amount: 5000.0,
            status: "CLEARED".into(),
            case_id: Some("case-alpha".into()),
            case_title: Some("Project Alpha".into()),
            notes: None,
        },
        Transaction {
            id: "tx-2".into(),
            date: "2026-08-05".into(),
            r#type: "EXPENSE".into(),
            category_id: "cat-3".into(),
            category_name: Some("Subcontractor".into()),
            amount: 1500.0,
            currency: "USD".into(),
            exchange_rate: 1.0,
            base_amount: 1500.0,
            status: "PAID".into(),
            case_id: Some("case-alpha".into()),
            case_title: Some("Project Alpha".into()),
            notes: None,
        },
        // Unrealized income: should NOT count towards realized PnL
        Transaction {
            id: "tx-3".into(),
            date: "2026-08-10".into(),
            r#type: "INCOME".into(),
            category_id: "cat-1".into(),
            category_name: Some("Client Consulting Fee".into()),
            amount: 10000.0,
            currency: "USD".into(),
            exchange_rate: 1.0,
            base_amount: 10000.0,
            status: "INVOICED".into(),
            case_id: Some("case-alpha".into()),
            case_title: Some("Project Alpha".into()),
            notes: None,
        },
        // Other case: should NOT count when filtering by case-alpha
        Transaction {
            id: "tx-4".into(),
            date: "2026-08-12".into(),
            r#type: "INCOME".into(),
            category_id: "cat-1".into(),
            category_name: Some("Client Consulting Fee".into()),
            amount: 8000.0,
            currency: "USD".into(),
            exchange_rate: 1.0,
            base_amount: 8000.0,
            status: "CLEARED".into(),
            case_id: Some("case-beta".into()),
            case_title: Some("Project Beta".into()),
            notes: None,
        },
    ];

    let pnl = calculate_case_pnl(&txs, Some("case-alpha"));
    assert_eq!(pnl.realized_income, 5000.0);
    assert_eq!(pnl.realized_expense, 1500.0);
    assert_eq!(pnl.net_margin, 3500.0);
    assert_eq!(pnl.profit_margin_pct, 70.0);

    // Portfolio PnL (aggregating all cases)
    let portfolio_pnl = calculate_portfolio_pnl(&txs);
    assert_eq!(portfolio_pnl.realized_income, 13000.0); // 5000 + 8000
    assert_eq!(portfolio_pnl.realized_expense, 1500.0);
    assert_eq!(portfolio_pnl.net_margin, 11500.0);
    assert_eq!(portfolio_pnl.profit_margin_pct, 88.46); // (11500 / 13000) * 100 = 88.4615... -> 88.46
}

#[test]
fn test_case_pnl_edge_cases_zero_income_and_drawdown() {
    // Zero income with expenses -> profit margin % is 0.0, not NaN or -Inf
    let txs_expenses_only = vec![Transaction {
        id: "tx-1".into(),
        date: "2026-08-01".into(),
        r#type: "EXPENSE".into(),
        category_id: "cat-4".into(),
        category_name: None,
        amount: 250.0,
        currency: "USD".into(),
        exchange_rate: 1.0,
        base_amount: 250.0,
        status: "CLEARED".into(),
        case_id: Some("case-zero".into()),
        case_title: None,
        notes: None,
    }];

    let pnl = calculate_case_pnl(&txs_expenses_only, Some("case-zero"));
    assert_eq!(pnl.realized_income, 0.0);
    assert_eq!(pnl.realized_expense, 250.0);
    assert_eq!(pnl.net_margin, -250.0);
    assert_eq!(pnl.profit_margin_pct, 0.0);

    // Drawdown (Income 1000, Expense 1500 -> Net -500, Profit Margin -50.0%)
    let txs_drawdown = vec![
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
            case_id: None,
            case_title: None,
            notes: None,
        },
        Transaction {
            id: "tx-exp".into(),
            date: "2026-08-02".into(),
            r#type: "EXPENSE".into(),
            category_id: "cat-3".into(),
            category_name: None,
            amount: 1500.0,
            currency: "USD".into(),
            exchange_rate: 1.0,
            base_amount: 1500.0,
            status: "PAID".into(),
            case_id: None,
            case_title: None,
            notes: None,
        },
    ];

    let pnl_drawdown = calculate_portfolio_pnl(&txs_drawdown);
    assert_eq!(pnl_drawdown.realized_income, 1000.0);
    assert_eq!(pnl_drawdown.realized_expense, 1500.0);
    assert_eq!(pnl_drawdown.net_margin, -500.0);
    assert_eq!(pnl_drawdown.profit_margin_pct, -50.0);
}

// =========================================================================
// 2. PROPOSAL WIN RATE ENGINE TESTS
// =========================================================================

#[test]
fn test_win_rate_edge_cases_and_proposals() {
    // 1. Empty case list
    assert_eq!(calculate_win_rate(&[]), 0.0);

    // 2. Only open cases (LEAD, QUOTATION, ACTIVE) -> closed_cases = 0 -> returns 0.0
    let open_cases = vec![
        Case {
            id: "c-1".into(),
            code: "CASE-01".into(),
            title: "Lead 1".into(),
            client_name: "Client A".into(),
            client_contact: None,
            stage: "LEAD".into(),
            quoted_amount: 10000.0,
            currency: "USD".into(),
            proposal_value_base: 10000.0,
            start_date: None,
            target_completion_date: None,
            closed_date: None,
            notes: None,
            created_at: "".into(),
            updated_at: "".into(),
        },
        Case {
            id: "c-2".into(),
            code: "CASE-02".into(),
            title: "Quotation 1".into(),
            client_name: "Client B".into(),
            client_contact: None,
            stage: "QUOTATION".into(),
            quoted_amount: 15000.0,
            currency: "USD".into(),
            proposal_value_base: 15000.0,
            start_date: None,
            target_completion_date: None,
            closed_date: None,
            notes: None,
            created_at: "".into(),
            updated_at: "".into(),
        },
        Case {
            id: "c-3".into(),
            code: "CASE-03".into(),
            title: "Active 1".into(),
            client_name: "Client C".into(),
            client_contact: None,
            stage: "ACTIVE".into(),
            quoted_amount: 20000.0,
            currency: "USD".into(),
            proposal_value_base: 20000.0,
            start_date: None,
            target_completion_date: None,
            closed_date: None,
            notes: None,
            created_at: "".into(),
            updated_at: "".into(),
        },
    ];
    assert_eq!(calculate_win_rate(&open_cases), 0.0);

    // 3. 100% Win Rate (2 COMPLETED, 0 LOST)
    let won_cases = vec![
        Case {
            id: "c-1".into(),
            code: "CASE-01".into(),
            title: "Won 1".into(),
            client_name: "Client A".into(),
            client_contact: None,
            stage: "COMPLETED".into(),
            quoted_amount: 10000.0,
            currency: "USD".into(),
            proposal_value_base: 10000.0,
            start_date: None,
            target_completion_date: None,
            closed_date: None,
            notes: None,
            created_at: "".into(),
            updated_at: "".into(),
        },
        Case {
            id: "c-2".into(),
            code: "CASE-02".into(),
            title: "Won 2".into(),
            client_name: "Client B".into(),
            client_contact: None,
            stage: "COMPLETED".into(),
            quoted_amount: 15000.0,
            currency: "USD".into(),
            proposal_value_base: 15000.0,
            start_date: None,
            target_completion_date: None,
            closed_date: None,
            notes: None,
            created_at: "".into(),
            updated_at: "".into(),
        },
    ];
    assert_eq!(calculate_win_rate(&won_cases), 100.0);

    // 4. 0% Win Rate (0 COMPLETED, 3 LOST)
    let lost_cases = vec![
        Case {
            id: "c-1".into(),
            code: "CASE-01".into(),
            title: "Lost 1".into(),
            client_name: "Client A".into(),
            client_contact: None,
            stage: "LOST".into(),
            quoted_amount: 10000.0,
            currency: "USD".into(),
            proposal_value_base: 10000.0,
            start_date: None,
            target_completion_date: None,
            closed_date: None,
            notes: None,
            created_at: "".into(),
            updated_at: "".into(),
        },
        Case {
            id: "c-2".into(),
            code: "CASE-02".into(),
            title: "Lost 2".into(),
            client_name: "Client B".into(),
            client_contact: None,
            stage: "LOST".into(),
            quoted_amount: 5000.0,
            currency: "USD".into(),
            proposal_value_base: 5000.0,
            start_date: None,
            target_completion_date: None,
            closed_date: None,
            notes: None,
            created_at: "".into(),
            updated_at: "".into(),
        },
    ];
    assert_eq!(calculate_win_rate(&lost_cases), 0.0);

    // 5. Mixed: 3 COMPLETED, 1 LOST, 1 ACTIVE -> 3 / 4 = 75.0%
    let mut mixed_cases = won_cases;
    mixed_cases.push(Case {
        id: "c-3".into(),
        code: "CASE-03".into(),
        title: "Won 3".into(),
        client_name: "Client C".into(),
        client_contact: None,
        stage: "COMPLETED".into(),
        quoted_amount: 25000.0,
        currency: "USD".into(),
        proposal_value_base: 25000.0,
        start_date: None,
        target_completion_date: None,
        closed_date: None,
        notes: None,
        created_at: "".into(),
        updated_at: "".into(),
    });
    mixed_cases.push(Case {
        id: "c-4".into(),
        code: "CASE-04".into(),
        title: "Lost 1".into(),
        client_name: "Client D".into(),
        client_contact: None,
        stage: "LOST".into(),
        quoted_amount: 8000.0,
        currency: "USD".into(),
        proposal_value_base: 8000.0,
        start_date: None,
        target_completion_date: None,
        closed_date: None,
        notes: None,
        created_at: "".into(),
        updated_at: "".into(),
    });
    mixed_cases.push(Case {
        id: "c-5".into(),
        code: "CASE-05".into(),
        title: "Active Project".into(),
        client_name: "Client E".into(),
        client_contact: None,
        stage: "ACTIVE".into(),
        quoted_amount: 50000.0,
        currency: "USD".into(),
        proposal_value_base: 50000.0,
        start_date: None,
        target_completion_date: None,
        closed_date: None,
        notes: None,
        created_at: "".into(),
        updated_at: "".into(),
    });
    assert_eq!(calculate_win_rate(&mixed_cases), 75.0);
}

// =========================================================================
// 3. CUMULATIVE EQUITY CURVE & TIMEFRAME BASELINE PRESERVATION
// =========================================================================

#[test]
fn test_equity_curve_running_cumulative_and_timeframes() {
    let ref_date: DateTime<Utc> = "2026-08-30T00:00:00Z".parse().unwrap();

    let txs = vec![
        // Old transaction: 60 days ago (2026-07-01) -> Net +10,000
        Transaction {
            id: "tx-1".into(),
            date: "2026-07-01".into(),
            r#type: "INCOME".into(),
            category_id: "cat-1".into(),
            category_name: None,
            amount: 10000.0,
            currency: "USD".into(),
            exchange_rate: 1.0,
            base_amount: 10000.0,
            status: "CLEARED".into(),
            case_id: None,
            case_title: None,
            notes: None,
        },
        // 20 days ago (2026-08-10) -> Net -2,000
        Transaction {
            id: "tx-2".into(),
            date: "2026-08-10".into(),
            r#type: "EXPENSE".into(),
            category_id: "cat-3".into(),
            category_name: None,
            amount: 2000.0,
            currency: "USD".into(),
            exchange_rate: 1.0,
            base_amount: 2000.0,
            status: "PAID".into(),
            case_id: None,
            case_title: None,
            notes: None,
        },
        // 5 days ago (2026-08-25) -> Income 5,000, Expense 1,000 on SAME date -> Net +4,000
        Transaction {
            id: "tx-3a".into(),
            date: "2026-08-25".into(),
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
        Transaction {
            id: "tx-3b".into(),
            date: "2026-08-25".into(),
            r#type: "EXPENSE".into(),
            category_id: "cat-4".into(),
            category_name: None,
            amount: 1000.0,
            currency: "USD".into(),
            exchange_rate: 1.0,
            base_amount: 1000.0,
            status: "PAID".into(),
            case_id: None,
            case_title: None,
            notes: None,
        },
    ];

    // Full Series (ALL)
    let curve_all = calculate_equity_curve(&txs, Timeframe::All, Some(ref_date));
    assert_eq!(curve_all.len(), 3);

    // Point 1: 2026-07-01 -> daily_delta = 10000, cumulative = 10000
    assert_eq!(curve_all[0].date, "2026-07-01");
    assert_eq!(curve_all[0].daily_delta, 10000.0);
    assert_eq!(curve_all[0].cumulative_equity, 10000.0);
    assert_eq!(curve_all[0].volume_income, 10000.0);
    assert_eq!(curve_all[0].volume_expense, 0.0);

    // Point 2: 2026-08-10 -> daily_delta = -2000, cumulative = 8000
    assert_eq!(curve_all[1].date, "2026-08-10");
    assert_eq!(curve_all[1].daily_delta, -2000.0);
    assert_eq!(curve_all[1].cumulative_equity, 8000.0);
    assert_eq!(curve_all[1].volume_income, 0.0);
    assert_eq!(curve_all[1].volume_expense, 2000.0);

    // Point 3: 2026-08-25 -> daily_delta = +4000, cumulative = 12000
    assert_eq!(curve_all[2].date, "2026-08-25");
    assert_eq!(curve_all[2].daily_delta, 4000.0);
    assert_eq!(curve_all[2].cumulative_equity, 12000.0);
    assert_eq!(curve_all[2].volume_income, 5000.0);
    assert_eq!(curve_all[2].volume_expense, 1000.0);

    // Timeframe: 1 Month (30 days -> cutoff is 2026-07-31)
    // Should contain 2026-08-10 and 2026-08-25, but cumulative equity MUST PRESERVE prior baseline (starts at 8000, not -2000)
    let curve_1m = calculate_equity_curve(&txs, Timeframe::OneMonth, Some(ref_date));
    assert_eq!(curve_1m.len(), 2);
    assert_eq!(curve_1m[0].date, "2026-08-10");
    assert_eq!(curve_1m[0].cumulative_equity, 8000.0);
    assert_eq!(curve_1m[1].date, "2026-08-25");
    assert_eq!(curve_1m[1].cumulative_equity, 12000.0);

    // Timeframe: 1 Week (7 days -> cutoff is 2026-08-23)
    // Should contain only 2026-08-25, with cumulative equity = 12000
    let curve_1w = calculate_equity_curve(&txs, Timeframe::OneWeek, Some(ref_date));
    assert_eq!(curve_1w.len(), 1);
    assert_eq!(curve_1w[0].date, "2026-08-25");
    assert_eq!(curve_1w[0].cumulative_equity, 12000.0);
}

// =========================================================================
// 4. ACCOUNTS RECEIVABLE AGING & TRAFFIC LIGHT LOGIC
// =========================================================================

#[test]
fn test_ar_aging_4_buckets_and_traffic_light_indicators() {
    let ref_date: DateTime<Utc> = "2026-08-30T00:00:00Z".parse().unwrap();

    let txs = vec![
        // 1. Current: 10 days ago (2026-08-20) -> INVOICED 3000 -> 0-30 days
        Transaction {
            id: "tx-current".into(),
            date: "2026-08-20".into(),
            r#type: "INCOME".into(),
            category_id: "cat-1".into(),
            category_name: None,
            amount: 3000.0,
            currency: "USD".into(),
            exchange_rate: 1.0,
            base_amount: 3000.0,
            status: "INVOICED".into(),
            case_id: None,
            case_title: None,
            notes: None,
        },
        // 2. Pending: 45 days ago (2026-07-16) -> PENDING 4000 -> 31-60 days
        Transaction {
            id: "tx-pending".into(),
            date: "2026-07-16".into(),
            r#type: "INCOME".into(),
            category_id: "cat-1".into(),
            category_name: None,
            amount: 4000.0,
            currency: "USD".into(),
            exchange_rate: 1.0,
            base_amount: 4000.0,
            status: "PENDING".into(),
            case_id: None,
            case_title: None,
            notes: None,
        },
        // 3. Paid/Cleared: should NOT be included in AR aging
        Transaction {
            id: "tx-cleared".into(),
            date: "2026-05-01".into(),
            r#type: "INCOME".into(),
            category_id: "cat-1".into(),
            category_name: None,
            amount: 50000.0,
            currency: "USD".into(),
            exchange_rate: 1.0,
            base_amount: 50000.0,
            status: "CLEARED".into(),
            case_id: None,
            case_title: None,
            notes: None,
        },
        // 4. Expense: should NOT be included in AR aging
        Transaction {
            id: "tx-exp".into(),
            date: "2026-05-01".into(),
            r#type: "EXPENSE".into(),
            category_id: "cat-4".into(),
            category_name: None,
            amount: 5000.0,
            currency: "USD".into(),
            exchange_rate: 1.0,
            base_amount: 5000.0,
            status: "INVOICED".into(),
            case_id: None,
            case_title: None,
            notes: None,
        },
    ];

    // Only current and pending -> GREEN
    let ar_green = calculate_ar_aging(&txs, Some(ref_date));
    assert_eq!(ar_green.current_0_30, 3000.0);
    assert_eq!(ar_green.pending_31_60, 4000.0);
    assert_eq!(ar_green.overdue_61_90, 0.0);
    assert_eq!(ar_green.critical_90_plus, 0.0);
    assert_eq!(ar_green.total_receivable, 7000.0);
    assert_eq!(ar_green.traffic_light, "GREEN");

    // Add overdue 61-90 days (75 days ago: 2026-06-16) -> YELLOW
    let mut txs_yellow = txs.clone();
    txs_yellow.push(Transaction {
        id: "tx-overdue".into(),
        date: "2026-06-16".into(),
        r#type: "INCOME".into(),
        category_id: "cat-1".into(),
        category_name: None,
        amount: 2500.0,
        currency: "USD".into(),
        exchange_rate: 1.0,
        base_amount: 2500.0,
        status: "INVOICED".into(),
        case_id: None,
        case_title: None,
        notes: None,
    });
    let ar_yellow = calculate_ar_aging(&txs_yellow, Some(ref_date));
    assert_eq!(ar_yellow.overdue_61_90, 2500.0);
    assert_eq!(ar_yellow.traffic_light, "YELLOW");

    // Add critical 90+ days (120 days ago: 2026-05-02) -> RED
    let mut txs_red = txs_yellow.clone();
    txs_red.push(Transaction {
        id: "tx-critical".into(),
        date: "2026-05-02".into(),
        r#type: "INCOME".into(),
        category_id: "cat-1".into(),
        category_name: None,
        amount: 1200.0,
        currency: "USD".into(),
        exchange_rate: 1.0,
        base_amount: 1200.0,
        status: "INVOICED".into(),
        case_id: None,
        case_title: None,
        notes: None,
    });
    let ar_red = calculate_ar_aging(&txs_red, Some(ref_date));
    assert_eq!(ar_red.critical_90_plus, 1200.0);
    assert_eq!(ar_red.total_receivable, 10700.0);
    assert_eq!(ar_red.traffic_light, "RED");
}

// =========================================================================
// 5. EXECUTIVE DASHBOARD METRICS AGGREGATION
// =========================================================================

#[test]
fn test_dashboard_metrics_aggregation() {
    let cases = vec![
        Case {
            id: "c-1".into(),
            code: "CASE-01".into(),
            title: "Project Alpha".into(),
            client_name: "Client A".into(),
            client_contact: None,
            stage: "COMPLETED".into(),
            quoted_amount: 20000.0,
            currency: "USD".into(),
            proposal_value_base: 20000.0,
            start_date: None,
            target_completion_date: None,
            closed_date: None,
            notes: None,
            created_at: "".into(),
            updated_at: "".into(),
        },
        Case {
            id: "c-2".into(),
            code: "CASE-02".into(),
            title: "Project Beta".into(),
            client_name: "Client B".into(),
            client_contact: None,
            stage: "COMPLETED".into(),
            quoted_amount: 40000.0,
            currency: "USD".into(),
            proposal_value_base: 40000.0,
            start_date: None,
            target_completion_date: None,
            closed_date: None,
            notes: None,
            created_at: "".into(),
            updated_at: "".into(),
        },
        Case {
            id: "c-3".into(),
            code: "CASE-03".into(),
            title: "Project Gamma".into(),
            client_name: "Client C".into(),
            client_contact: None,
            stage: "LOST".into(),
            quoted_amount: 10000.0,
            currency: "USD".into(),
            proposal_value_base: 10000.0,
            start_date: None,
            target_completion_date: None,
            closed_date: None,
            notes: None,
            created_at: "".into(),
            updated_at: "".into(),
        },
        Case {
            id: "c-4".into(),
            code: "CASE-04".into(),
            title: "Project Delta".into(),
            client_name: "Client D".into(),
            client_contact: None,
            stage: "ACTIVE".into(),
            quoted_amount: 15000.0,
            currency: "USD".into(),
            proposal_value_base: 15000.0,
            start_date: None,
            target_completion_date: None,
            closed_date: None,
            notes: None,
            created_at: "".into(),
            updated_at: "".into(),
        },
    ];

    let txs = vec![
        Transaction {
            id: "t-1".into(),
            date: "2026-08-01".into(),
            r#type: "INCOME".into(),
            category_id: "cat-1".into(),
            category_name: None,
            amount: 20000.0,
            currency: "USD".into(),
            exchange_rate: 1.0,
            base_amount: 20000.0,
            status: "CLEARED".into(),
            case_id: Some("c-1".into()),
            case_title: None,
            notes: None,
        },
        Transaction {
            id: "t-2".into(),
            date: "2026-08-02".into(),
            r#type: "EXPENSE".into(),
            category_id: "cat-3".into(),
            category_name: None,
            amount: 5000.0,
            currency: "USD".into(),
            exchange_rate: 1.0,
            base_amount: 5000.0,
            status: "PAID".into(),
            case_id: Some("c-1".into()),
            case_title: None,
            notes: None,
        },
        // Invoiced income transaction
        Transaction {
            id: "t-3".into(),
            date: "2026-08-03".into(),
            r#type: "INCOME".into(),
            category_id: "cat-1".into(),
            category_name: None,
            amount: 8000.0,
            currency: "USD".into(),
            exchange_rate: 1.0,
            base_amount: 8000.0,
            status: "INVOICED".into(),
            case_id: None,
            case_title: None,
            notes: None,
        },
    ];

    let metrics = calculate_dashboard_metrics(&txs, &cases, "USD");
    assert_eq!(metrics.cumulative_net_margin, 15000.0); // 20000 - 5000
    assert_eq!(metrics.realized_volume, 20000.0);
    // Win Rate: 2 won out of 3 closed = 66.67%
    assert_eq!(metrics.proposal_win_rate, 66.67);
    // Invoiced Volume: (20000 + 40000 + 15000) from cases in COMPLETED/ACTIVE + 8000 from INVOICED tx = 83000.0
    assert_eq!(metrics.invoiced_volume, 83000.0);
    // Average Ticket Size: (20000 + 40000) / 2 completed cases = 30000.0
    assert_eq!(metrics.avg_ticket_size, 30000.0);
    assert_eq!(metrics.base_currency, "USD");
}

// =========================================================================
// 6. DATABASE REPOSITORIES CRUD, MULTI-CURRENCY & CASCADE INTEGRITY
// =========================================================================

#[test]
fn test_database_crud_multi_currency_and_cascades() {
    let conn = setup_test_db();

    // 1. Verify default seed categories (6 categories)
    let categories = CategoryRepo::list(&conn).expect("Failed to list categories");
    assert_eq!(categories.len(), 6);
    assert!(categories.iter().any(|c| c.name == "Client Consulting Fee" && c.r#type == "INCOME"));
    assert!(categories.iter().any(|c| c.name == "Software & SaaS Subscriptions" && c.r#type == "EXPENSE"));

    // 2. Verify default seed exchange rates
    let eur_rate = ExchangeRateRepo::get_rate(&conn, "EUR").expect("Failed to get EUR rate");
    assert_eq!(eur_rate, 1.085);
    let gbp_rate = ExchangeRateRepo::get_rate(&conn, "GBP").expect("Failed to get GBP rate");
    assert_eq!(gbp_rate, 1.28);
    let jpy_rate = ExchangeRateRepo::get_rate(&conn, "JPY").expect("Failed to get JPY rate");
    assert_eq!(jpy_rate, 0.0068);
    let usd_rate = ExchangeRateRepo::get_rate(&conn, "USD").expect("Failed to get USD rate");
    assert_eq!(usd_rate, 1.0);

    // 3. Create a Case
    let case = CaseRepo::create(
        &conn,
        CreateCaseInput {
            id: None,
            code: None,
            title: "Apex Launch Campaign".into(),
            client_name: "Apex Global".into(),
            client_contact: Some("alex@apex.com".into()),
            stage: Some("ACTIVE".into()),
            quoted_amount: Some(50000.0),
            currency: Some("EUR".into()),
            start_date: Some("2026-08-01".into()),
            target_completion_date: Some("2026-12-31".into()),
            closed_date: None,
            notes: Some("High priority engagement".into()),
            created_at: None,
            updated_at: None,
        },
    )
    .expect("Failed to create case");
    assert_eq!(case.title, "Apex Launch Campaign");
    assert_eq!(case.stage, "ACTIVE");

    // 4. Create Milestones for this case
    let ms1 = MilestoneRepo::create(
        &conn,
        CreateMilestoneInput {
            id: None,
            case_id: case.id.clone(),
            title: "Architecture Signoff".into(),
            description: Some("Sign off technical architecture".into()),
            due_date: Some("2026-09-01".into()),
            completed: Some(false),
            amount: Some(15000.0),
        },
    )
    .expect("Failed to create milestone");
    assert!(!ms1.completed);

    // Toggle milestone completion
    let ms1_completed = MilestoneRepo::toggle(&conn, &ms1.id, true).expect("Failed to toggle milestone");
    assert!(ms1_completed.completed);
    assert!(ms1_completed.completed_date.is_some());

    // 5. Create Multi-Currency Transactions
    // Foreign currency (EUR) transaction with rate looked up from DB (1.085)
    let tx_eur = TransactionRepo::create(
        &conn,
        CreateTransactionInput {
            id: None,
            date: "2026-08-15".into(),
            r#type: "INCOME".into(),
            category_id: Some("cat-1".into()),
            category_name: None,
            amount: 10000.0, // 10,000 EUR
            currency: Some("EUR".into()),
            exchange_rate: None, // should resolve to 1.085 -> base_amount = 10850.00
            status: Some("CLEARED".into()),
            case_id: Some(case.id.clone()),
            case_title: None,
            notes: Some("First milestone payment".into()),
        },
    )
    .expect("Failed to create EUR transaction");
    assert_eq!(tx_eur.exchange_rate, 1.085);
    assert_eq!(tx_eur.base_amount, 10850.0);
    assert_eq!(tx_eur.case_title.as_deref(), Some("Apex Launch Campaign"));

    // Expense transaction in GBP with explicit override rate (1.30)
    let tx_gbp = TransactionRepo::create(
        &conn,
        CreateTransactionInput {
            id: None,
            date: "2026-08-16".into(),
            r#type: "EXPENSE".into(),
            category_id: Some("cat-3".into()),
            category_name: None,
            amount: 2000.0,
            currency: Some("GBP".into()),
            exchange_rate: Some(1.30),
            status: Some("PAID".into()),
            case_id: Some(case.id.clone()),
            case_title: None,
            notes: Some("Subcontractor invoice".into()),
        },
    )
    .expect("Failed to create GBP transaction");
    assert_eq!(tx_gbp.exchange_rate, 1.30);
    assert_eq!(tx_gbp.base_amount, 2600.0);

    // 6. Create Journal Entries linked to the case
    let jrn = JournalRepo::create(
        &conn,
        CreateJournalInput {
            id: None,
            date: Some("2026-08-15".into()),
            title: Some("Kickoff Review".into()),
            content: "Completed kickoff with the leadership team.".into(),
            case_id: Some(case.id.clone()),
            tags: Some(vec!["kickoff".into(), "governance".into()]),
            is_starred: Some(true),
        },
    )
    .expect("Failed to create journal entry");
    assert_eq!(jrn.tags, vec!["kickoff", "governance"]);
    assert!(jrn.is_starred);

    // 7. Case Detail query should populate Case PnL, Milestones and Diary Entries
    let detail = CaseRepo::get_detail(&conn, &case.id).expect("Failed to get case detail");
    assert_eq!(detail.id, case.id);
    assert_eq!(detail.realized_income, 10850.0);
    assert_eq!(detail.realized_expense, 2600.0);
    assert_eq!(detail.net_margin, 8250.0);
    assert_eq!(detail.profit_margin_pct, 76.04); // (8250 / 10850) * 100 = 76.0368... -> 76.04
    assert_eq!(detail.milestones.len(), 1);
    assert_eq!(detail.diary_entries.len(), 1);

    // 8. Test Transaction Filtering
    let filter_income = TransactionFilter {
        r#type: Some("INCOME".into()),
        ..Default::default()
    };
    let income_txs = TransactionRepo::list(&conn, Some(&filter_income)).unwrap();
    assert_eq!(income_txs.len(), 1);
    assert_eq!(income_txs[0].id, tx_eur.id);

    let filter_search = TransactionFilter {
        search: Some("subcontractor".into()),
        ..Default::default()
    };
    let search_txs = TransactionRepo::list(&conn, Some(&filter_search)).unwrap();
    assert_eq!(search_txs.len(), 1);
    assert_eq!(search_txs[0].id, tx_gbp.id);

    // 9. Cascade Delete Integrity: Deleting Case deletes Milestones and nullifies Case FK on Transactions/Journal
    conn.execute("DELETE FROM cases WHERE id = ?1", rusqlite::params![case.id]).expect("Failed to delete case");

    // Milestones must be cascaded and gone
    let remaining_milestones = MilestoneRepo::list_by_case(&conn, &case.id).unwrap();
    assert!(remaining_milestones.is_empty());

    // Transactions must still exist, with case_id set to null
    let tx_eur_after = TransactionRepo::get_by_id(&conn, &tx_eur.id).unwrap();
    assert!(tx_eur_after.case_id.is_none());
    assert!(tx_eur_after.case_title.is_none());

    // Journal entries must still exist, with case_id set to null
    let jrn_after = JournalRepo::get_by_id(&conn, &jrn.id).unwrap();
    assert!(jrn_after.case_id.is_none());
}

#[test]
fn test_validation_errors_in_repos() {
    let conn = setup_test_db();

    // 1. Transaction empty date
    let err_tx_date = TransactionRepo::create(
        &conn,
        CreateTransactionInput {
            id: None,
            date: "  ".into(),
            r#type: "INCOME".into(),
            category_id: None,
            category_name: None,
            amount: 100.0,
            currency: None,
            exchange_rate: None,
            status: None,
            case_id: None,
            case_title: None,
            notes: None,
        },
    );
    assert!(err_tx_date.is_err());

    // 2. Transaction negative amount
    let err_tx_amt = TransactionRepo::create(
        &conn,
        CreateTransactionInput {
            id: None,
            date: "2026-08-01".into(),
            r#type: "INCOME".into(),
            category_id: None,
            category_name: None,
            amount: -50.0,
            currency: None,
            exchange_rate: None,
            status: None,
            case_id: None,
            case_title: None,
            notes: None,
        },
    );
    assert!(err_tx_amt.is_err());

    // 3. Transaction invalid exchange rate (<= 0)
    let err_tx_rate = TransactionRepo::create(
        &conn,
        CreateTransactionInput {
            id: None,
            date: "2026-08-01".into(),
            r#type: "INCOME".into(),
            category_id: None,
            category_name: None,
            amount: 100.0,
            currency: None,
            exchange_rate: Some(0.0),
            status: None,
            case_id: None,
            case_title: None,
            notes: None,
        },
    );
    assert!(err_tx_rate.is_err());

    // 4. Case empty title
    let err_case = CaseRepo::create(
        &conn,
        CreateCaseInput {
            id: None,
            code: None,
            title: "".into(),
            client_name: "Client".into(),
            client_contact: None,
            stage: None,
            quoted_amount: None,
            currency: None,
            start_date: None,
            target_completion_date: None,
            closed_date: None,
            notes: None,
            created_at: None,
            updated_at: None,
        },
    );
    assert!(err_case.is_err());

    // 5. Journal empty content
    let err_jrn = JournalRepo::create(
        &conn,
        CreateJournalInput {
            id: None,
            date: None,
            title: None,
            content: "   ".into(),
            case_id: None,
            tags: None,
            is_starred: None,
        },
    );
    assert!(err_jrn.is_err());
}
