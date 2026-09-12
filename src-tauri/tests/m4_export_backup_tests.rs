//! Milestone 4 Integration & Cryptographic Verification Tests
//!
//! Tests:
//! 1. Shannon Entropy (> 7.80 bits/byte) on AES-256 encrypted .vault backup.
//! 2. 100% data parity across full backup & restore roundtrip.
//! 3. Invalid master password rejection on restore (AppError::InvalidPassword).
//! 4. Corrupted backup container HMAC rejection (AppError::IntegrityViolation).
//! 5. Exact CSV header and formatting verification for transactions, cases, and journal entries.
//! 6. Excel multi-sheet export verification.

use apex_journal::crypto::KeyDerivationEngine;
use apex_journal::db::{
    CaseRepo, DatabaseManager, JournalRepo, MigrationManager, MilestoneRepo, TransactionRepo,
};
use apex_journal::error::AppError;
use apex_journal::models::{
    CreateCaseInput, CreateJournalInput, CreateMilestoneInput, CreateTransactionInput,
};
use apex_journal::state::VaultState;
use apex_journal::vault::{BackupEngine, ExportEngine, HEADER_LEN};
use tempfile::tempdir;

/// Calculate Shannon entropy for a byte slice
fn calculate_shannon_entropy(data: &[u8]) -> f64 {
    if data.is_empty() {
        return 0.0;
    }
    let mut counts = [0usize; 256];
    for &byte in data {
        counts[byte as usize] += 1;
    }
    let total = data.len() as f64;
    let mut entropy = 0.0;
    for &count in counts.iter() {
        if count > 0 {
            let p = count as f64 / total;
            entropy -= p * p.log2();
        }
    }
    entropy
}

#[tokio::test]
async fn test_backup_high_entropy_ciphertext() {
    let dir = tempdir().unwrap();
    let vault_dir = dir.path().join("vault");
    let state = VaultState::new(vault_dir);

    let password = "ApexPassword2026!";
    state
        .setup_vault(password, false, 15)
        .await
        .expect("Setup vault failed");

    // Populate vault with realistic records
    state
        .with_connection(|conn| {
            TransactionRepo::create(
                conn,
                CreateTransactionInput {
                    id: Some("tx-entropy-1".into()),
                    date: "2026-08-30".into(),
                    r#type: "INCOME".into(),
                    category_id: Some("cat-1".into()),
                    category_name: None,
                    amount: 15000.0,
                    currency: Some("USD".into()),
                    exchange_rate: Some(1.0),
                    status: Some("CLEARED".into()),
                    case_id: None,
                    case_title: None,
                    notes: Some("Retainer fee for high performance consultancy".into()),
                },
            )?;
            Ok(())
        })
        .await
        .expect("Insert transaction failed");

    let backup_path = dir.path().join("test_entropy.vault");
    let res = BackupEngine::export_backup(&state, &backup_path)
        .await
        .expect("Export backup failed");

    assert!(res.success);
    assert!(backup_path.exists());

    let file_bytes = std::fs::read(&backup_path).expect("Read backup failed");
    assert!(file_bytes.len() > HEADER_LEN);

    // Evaluate Shannon entropy on ciphertext body
    let ciphertext_body = &file_bytes[HEADER_LEN..];
    let entropy = calculate_shannon_entropy(ciphertext_body);

    println!(
        "Encrypted .vault body length: {} bytes, Shannon Entropy: {:.4} bits/byte",
        ciphertext_body.len(),
        entropy
    );

    // Standard requirement: Entropy must exceed 7.80 bits/byte (ideal random is ~8.00)
    assert!(
        entropy > 7.80,
        "Expected entropy > 7.80, got {:.4} bits/byte",
        entropy
    );
}

#[tokio::test]
async fn test_backup_and_restore_full_roundtrip_parity() {
    let dir = tempdir().unwrap();
    let vault1_dir = dir.path().join("vault1");
    let state1 = VaultState::new(vault1_dir);

    let master_password = "PrimaryMasterPassword!123";
    state1
        .setup_vault(master_password, false, 30)
        .await
        .expect("Setup vault 1 failed");

    // Seed comprehensive data in Vault 1
    state1
        .with_connection(|conn| {
            // 1. Create a case
            let case = CaseRepo::create(
                conn,
                CreateCaseInput {
                    id: Some("case-parity-101".into()),
                    code: Some("CS-PARITY".into()),
                    title: "Quantum Trading Engine Integration".into(),
                    client_name: "Aether Quantitative Ltd".into(),
                    client_contact: Some("trading@aether.com".into()),
                    stage: Some("ACTIVE".into()),
                    quoted_amount: Some(85000.0),
                    currency: Some("USD".into()),
                    start_date: Some("2026-08-01".into()),
                    target_completion_date: Some("2026-12-31".into()),
                    closed_date: None,
                    notes: Some("High frequency kernel integration".into()),
                    created_at: None,
                    updated_at: None,
                },
            )?;

            // 2. Create a milestone for the case
            MilestoneRepo::create(
                conn,
                CreateMilestoneInput {
                    id: Some("ms-parity-1".into()),
                    case_id: case.id.clone(),
                    title: "Architecture & Latency Benchmark".into(),
                    description: Some("Sub-microsecond validation".into()),
                    due_date: Some("2026-09-15".into()),
                    completed: Some(true),
                    amount: Some(25000.0),
                },
            )?;

            // 3. Create transactions
            TransactionRepo::create(
                conn,
                CreateTransactionInput {
                    id: Some("tx-parity-1".into()),
                    date: "2026-08-15".into(),
                    r#type: "INCOME".into(),
                    category_id: Some("cat-1".into()),
                    category_name: None,
                    amount: 25000.0,
                    currency: Some("USD".into()),
                    exchange_rate: Some(1.0),
                    status: Some("PAID".into()),
                    case_id: Some(case.id.clone()),
                    case_title: None,
                    notes: Some("Milestone 1 payment received".into()),
                },
            )?;

            TransactionRepo::create(
                conn,
                CreateTransactionInput {
                    id: Some("tx-parity-2".into()),
                    date: "2026-08-18".into(),
                    r#type: "EXPENSE".into(),
                    category_id: Some("cat-4".into()),
                    category_name: None,
                    amount: 3200.0,
                    currency: Some("EUR".into()),
                    exchange_rate: Some(1.085),
                    status: Some("CLEARED".into()),
                    case_id: Some(case.id.clone()),
                    case_title: None,
                    notes: Some("Dedicated server infrastructure".into()),
                },
            )?;

            // 4. Create journal entry
            JournalRepo::create(
                conn,
                CreateJournalInput {
                    id: Some("jr-parity-1".into()),
                    date: Some("2026-08-20".into()),
                    title: Some("Latency Benchmarks Exceeded".into()),
                    content: "# Performance Audit\n\nKernel latency reduced to **320ns**.".into(),
                    case_id: Some(case.id.clone()),
                    tags: Some(vec!["performance".into(), "kernel".into()]),
                    is_starred: Some(true),
                },
            )?;

            Ok(())
        })
        .await
        .expect("Data seeding failed");

    // Export backup container from Vault 1
    let backup_file = dir.path().join("apex_backup.vault");
    let export_res = BackupEngine::export_backup(&state1, &backup_file)
        .await
        .expect("Backup export failed");
    assert!(export_res.bytes_written > 0);

    // Create fresh Vault 2 and restore
    let vault2_dir = dir.path().join("vault2");
    let state2 = VaultState::new(vault2_dir);

    BackupEngine::restore_backup(&state2, &backup_file, master_password)
        .await
        .expect("Restore backup failed");

    // Verify 100% data parity in restored Vault 2
    state2
        .with_connection(|conn| {
            // Verify Cases
            let cases = CaseRepo::list(conn)?;
            assert_eq!(cases.len(), 1);
            let c = &cases[0];
            assert_eq!(c.id, "case-parity-101");
            assert_eq!(c.code, "CS-PARITY");
            assert_eq!(c.title, "Quantum Trading Engine Integration");
            assert_eq!(c.client_name, "Aether Quantitative Ltd");
            assert_eq!(c.quoted_amount, 85000.0);
            assert_eq!(c.stage, "ACTIVE");

            // Verify Milestones
            let milestones = MilestoneRepo::list_by_case(conn, "case-parity-101")?;
            assert_eq!(milestones.len(), 1);
            assert_eq!(milestones[0].title, "Architecture & Latency Benchmark");
            assert!(milestones[0].completed);
            assert_eq!(milestones[0].amount, 25000.0);

            // Verify Transactions
            let txs = TransactionRepo::list(conn, None)?;
            assert_eq!(txs.len(), 2);

            let tx1 = txs.iter().find(|t| t.id == "tx-parity-1").unwrap();
            assert_eq!(tx1.amount, 25000.0);
            assert_eq!(tx1.currency, "USD");
            assert_eq!(tx1.status, "PAID");
            assert_eq!(tx1.case_id.as_deref(), Some("case-parity-101"));

            let tx2 = txs.iter().find(|t| t.id == "tx-parity-2").unwrap();
            assert_eq!(tx2.amount, 3200.0);
            assert_eq!(tx2.currency, "EUR");
            assert_eq!(tx2.exchange_rate, 1.085);
            assert_eq!(tx2.base_amount, 3472.0); // 3200 * 1.085
            assert_eq!(tx2.status, "CLEARED");

            // Verify Journal Entries
            let journal_entries = JournalRepo::list(conn, None)?;
            assert_eq!(journal_entries.len(), 1);
            let j = &journal_entries[0];
            assert_eq!(j.id, "jr-parity-1");
            assert_eq!(j.title, "Latency Benchmarks Exceeded");
            assert!(j.is_starred);
            assert_eq!(j.tags, vec!["performance", "kernel"]);
            assert!(j.content.contains("Kernel latency reduced to **320ns**"));

            Ok(())
        })
        .await
        .expect("Verification query failed");
}

#[tokio::test]
async fn test_backup_restore_invalid_password_fails() {
    let dir = tempdir().unwrap();
    let vault_dir = dir.path().join("vault_pw");
    let state = VaultState::new(vault_dir);

    let correct_password = "CorrectHorseBatteryStaple!";
    state
        .setup_vault(correct_password, false, 15)
        .await
        .expect("Setup vault failed");

    let backup_file = dir.path().join("test_pw.vault");
    BackupEngine::export_backup(&state, &backup_file)
        .await
        .expect("Export backup failed");

    // Attempt restore onto fresh vault with WRONG password
    let fresh_dir = dir.path().join("vault_fresh_pw");
    let fresh_state = VaultState::new(fresh_dir);

    let wrong_password = "WrongPassword123!";
    let result = BackupEngine::restore_backup(&fresh_state, &backup_file, wrong_password).await;

    assert!(result.is_err(), "Expected restore with wrong password to fail");
    match result.err().unwrap() {
        AppError::InvalidPassword => (),
        other => panic!("Expected AppError::InvalidPassword, got {:?}", other),
    }
}

#[tokio::test]
async fn test_backup_restore_corrupted_container_rejection() {
    let dir = tempdir().unwrap();
    let vault_dir = dir.path().join("vault_corrupt");
    let state = VaultState::new(vault_dir);

    let password = "StrictIntegrityKey123!";
    state
        .setup_vault(password, false, 15)
        .await
        .expect("Setup vault failed");

    let backup_file = dir.path().join("test_corrupt.vault");
    BackupEngine::export_backup(&state, &backup_file)
        .await
        .expect("Export backup failed");

    // Read container bytes and tamper with 1 byte in ciphertext body
    let mut file_bytes = std::fs::read(&backup_file).expect("Read backup failed");
    let corrupt_idx = HEADER_LEN + 10;
    file_bytes[corrupt_idx] ^= 0xFF; // Flip bits

    let tampered_file = dir.path().join("tampered.vault");
    std::fs::write(&tampered_file, &file_bytes).expect("Write tampered file failed");

    // Attempt restore with CORRECT password on tampered container
    let fresh_dir = dir.path().join("vault_fresh_corrupt");
    let fresh_state = VaultState::new(fresh_dir);

    let result = BackupEngine::restore_backup(&fresh_state, &tampered_file, password).await;

    assert!(result.is_err(), "Expected restore on corrupted file to fail");
    match result.err().unwrap() {
        AppError::IntegrityViolation(msg) => {
            println!("Integrity violation successfully caught: {}", msg);
        }
        other => panic!("Expected AppError::IntegrityViolation, got {:?}", other),
    }
}

#[tokio::test]
async fn test_csv_export_exact_headers_and_formatting() {
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("csv_test.db");
    let salt = KeyDerivationEngine::generate_salt();
    let key = KeyDerivationEngine::derive_master_key("CSVPassword123!", &salt).unwrap();

    let mut conn = DatabaseManager::open_encrypted(&db_path, &key).expect("Open db failed");
    MigrationManager::run_migrations(&mut conn).expect("Migrations failed");

    // Seed data
    let case = CaseRepo::create(
        &conn,
        CreateCaseInput {
            id: Some("case-csv-1".into()),
            code: Some("CS-CSV-01".into()),
            title: "Financial Audit, Strategy & Advisory".into(), // contains comma
            client_name: "Acme \"Global\" Corp".into(),          // contains quotes
            client_contact: Some("contact@acme.com".into()),
            stage: Some("ACTIVE".into()),
            quoted_amount: Some(50000.0),
            currency: Some("USD".into()),
            start_date: Some("2026-01-01".into()),
            target_completion_date: Some("2026-06-30".into()),
            closed_date: None,
            notes: Some("Case notes with \"quotes\" and commas, here".into()),
            created_at: None,
            updated_at: None,
        },
    )
    .expect("Create case failed");

    TransactionRepo::create(
        &conn,
        CreateTransactionInput {
            id: Some("tx-csv-1".into()),
            date: "2026-08-15".into(),
            r#type: "INCOME".into(),
            category_id: Some("cat-1".into()),
            category_name: None,
            amount: 25000.0,
            currency: Some("USD".into()),
            exchange_rate: Some(1.0),
            status: Some("PAID".into()),
            case_id: Some(case.id.clone()),
            case_title: None,
            notes: Some("Retainer fee, month 1".into()),
        },
    )
    .expect("Create tx failed");

    JournalRepo::create(
        &conn,
        CreateJournalInput {
            id: Some("jr-csv-1".into()),
            date: Some("2026-08-20".into()),
            title: Some("Initial Kickoff & Roadmap".into()),
            content: "Project started smoothly.\nLine 2 with comma, and \"quotes\".".into(),
            case_id: Some(case.id.clone()),
            tags: Some(vec!["kickoff".into(), "strategy".into()]),
            is_starred: Some(true),
        },
    )
    .expect("Create journal failed");

    // 1. Test Transactions CSV
    let tx_csv = ExportEngine::export_csv(&conn, "transactions").expect("Export tx csv failed");
    let tx_lines: Vec<&str> = tx_csv.lines().collect();
    assert_eq!(
        tx_lines[0],
        "id,date,type,category,amount,currency,exchange_rate,base_amount,status,case_title,notes"
    );
    assert_eq!(tx_lines.len(), 2);
    assert!(tx_lines[1].contains("tx-csv-1"));
    assert!(tx_lines[1].contains("25000.00"));
    assert!(tx_lines[1].contains("PAID"));
    assert!(tx_lines[1].contains("\"Financial Audit, Strategy & Advisory\""));
    assert!(tx_lines[1].contains("\"Retainer fee, month 1\""));

    // 2. Test Cases CSV
    let case_csv = ExportEngine::export_csv(&conn, "cases").expect("Export cases csv failed");
    let case_lines: Vec<&str> = case_csv.lines().collect();
    assert_eq!(
        case_lines[0],
        "id,code,title,client_name,client_contact,stage,quoted_amount,currency,start_date,target_completion_date,closed_date,created_at,updated_at"
    );
    assert_eq!(case_lines.len(), 2);
    assert!(case_lines[1].contains("CS-CSV-01"));
    assert!(case_lines[1].contains("\"Financial Audit, Strategy & Advisory\""));
    assert!(case_lines[1].contains("\"Acme \"\"Global\"\" Corp\"")); // RFC 4180 escaped quotes
    assert!(case_lines[1].contains("50000.00"));

    // 3. Test Journal CSV
    let journal_csv = ExportEngine::export_csv(&conn, "journal").expect("Export journal csv failed");
    let journal_lines: Vec<&str> = journal_csv.lines().collect();
    assert_eq!(
        journal_lines[0],
        "id,date,title,content,case_id,tags,is_starred,created_at,updated_at"
    );
    assert!(journal_csv.contains("jr-csv-1"));
    assert!(journal_csv.contains("Initial Kickoff & Roadmap"));
    assert!(journal_csv.contains("true"));
    assert!(journal_csv.contains("\"kickoff, strategy\""));
}

#[tokio::test]
async fn test_excel_export_multi_sheet_structure() {
    let dir = tempdir().unwrap();
    let db_path = dir.path().join("excel_test.db");
    let salt = KeyDerivationEngine::generate_salt();
    let key = KeyDerivationEngine::derive_master_key("ExcelPassword123!", &salt).unwrap();

    let mut conn = DatabaseManager::open_encrypted(&db_path, &key).expect("Open db failed");
    MigrationManager::run_migrations(&mut conn).expect("Migrations failed");

    // Insert sample transaction and case
    let case = CaseRepo::create(
        &conn,
        CreateCaseInput {
            id: Some("case-xl-1".into()),
            code: Some("CS-XL-01".into()),
            title: "Global Supply Chain Modeling".into(),
            client_name: "Logix Intl".into(),
            client_contact: Some("ops@logix.com".into()),
            stage: Some("COMPLETED".into()),
            quoted_amount: Some(60000.0),
            currency: Some("USD".into()),
            start_date: Some("2026-02-01".into()),
            target_completion_date: Some("2026-06-30".into()),
            closed_date: Some("2026-06-28".into()),
            notes: None,
            created_at: None,
            updated_at: None,
        },
    )
    .expect("Create case failed");

    TransactionRepo::create(
        &conn,
        CreateTransactionInput {
            id: Some("tx-xl-1".into()),
            date: "2026-06-28".into(),
            r#type: "INCOME".into(),
            category_id: Some("cat-1".into()),
            category_name: None,
            amount: 60000.0,
            currency: Some("USD".into()),
            exchange_rate: Some(1.0),
            status: Some("PAID".into()),
            case_id: Some(case.id),
            case_title: None,
            notes: Some("Final delivery settled in full".into()),
        },
    )
    .expect("Create tx failed");

    let excel_path = dir.path().join("financial_report.xml");
    ExportEngine::export_excel(&conn, &excel_path).expect("Export excel failed");

    assert!(excel_path.exists());
    let xml_content = std::fs::read_to_string(&excel_path).expect("Read excel xml failed");

    // Validate 4 Multi-sheet worksheets
    assert!(xml_content.contains("<Worksheet ss:Name=\"Executive Summary\">"));
    assert!(xml_content.contains("<Worksheet ss:Name=\"Transactions\">"));
    assert!(xml_content.contains("<Worksheet ss:Name=\"Cases\">"));
    assert!(xml_content.contains("<Worksheet ss:Name=\"Journal Entries\">"));

    // Validate KPI metrics and calculations
    assert!(xml_content.contains("APEXJOURNAL EXECUTIVE KPI SUMMARY"));
    assert!(xml_content.contains("Cumulative Net Margin (Realized PnL)"));
    assert!(xml_content.contains("Proposal Win Rate"));
    assert!(xml_content.contains("Accounts Receivable Aging Bucket"));

    // Validate case and transaction rows
    assert!(xml_content.contains("Global Supply Chain Modeling"));
    assert!(xml_content.contains("Final delivery settled in full"));
}
