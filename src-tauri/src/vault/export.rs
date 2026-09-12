//! CSV & Excel Export Engine
//!
//! Provides deterministic data export for:
//! 1. CSV format for `transactions`, `cases`, and `journal`.
//! 2. Multi-sheet Excel workbook export containing Executive KPI Summary, Transactions, Cases, and Journal Entries.

use rusqlite::Connection;
use std::path::Path;

use crate::analytics::{calculate_ar_aging, calculate_case_pnl, calculate_dashboard_metrics};
use crate::db::{CaseRepo, ExchangeRateRepo, TransactionRepo};
use crate::error::AppError;

pub struct ExportEngine;

impl ExportEngine {
    /// Escape and quote a single CSV cell according to RFC 4180
    pub fn escape_csv_field(val: &str) -> String {
        if val.contains(',') || val.contains('"') || val.contains('\n') || val.contains('\r') {
            let escaped = val.replace('"', "\"\"");
            format!("\"{}\"", escaped)
        } else {
            val.to_string()
        }
    }

    /// Export database records to CSV based on export_type: 'transactions' | 'cases' | 'journal'
    pub fn export_csv(conn: &Connection, export_type: &str) -> Result<String, AppError> {
        match export_type.to_lowercase().as_str() {
            "transactions" | "transaction" | "blotter" => Self::export_transactions_csv(conn),
            "cases" | "case" | "pipeline" => Self::export_cases_csv(conn),
            "journal" | "journal_entries" | "diary" => Self::export_journal_csv(conn),
            other => Err(AppError::ValidationError(format!(
                "Unknown export type: '{}'. Supported types are: transactions, cases, journal",
                other
            ))),
        }
    }

    /// CSV export for transactions with exact column headers:
    /// id,date,type,category,amount,currency,exchange_rate,base_amount,status,case_title,notes
    fn export_transactions_csv(conn: &Connection) -> Result<String, AppError> {
        let mut stmt = conn.prepare(
            "SELECT 
                t.id,
                t.date,
                t.type,
                COALESCE(c.name, '') AS category,
                t.amount,
                t.currency,
                t.exchange_rate,
                t.base_amount,
                t.status,
                COALESCE(cs.title, '') AS case_title,
                COALESCE(t.notes, '') AS notes
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN cases cs ON t.case_id = cs.id
            ORDER BY t.date ASC, t.created_at ASC"
        )?;

        let mut csv = String::from(
            "id,date,type,category,amount,currency,exchange_rate,base_amount,status,case_title,notes\n"
        );

        let mut rows = stmt.query([])?;
        while let Some(row) = rows.next()? {
            let id: String = row.get(0)?;
            let date: String = row.get(1)?;
            let tx_type: String = row.get(2)?;
            let category: String = row.get(3)?;
            let amount: f64 = row.get(4)?;
            let currency: String = row.get(5)?;
            let exchange_rate: f64 = row.get(6)?;
            let base_amount: f64 = row.get(7)?;
            let status: String = row.get(8)?;
            let case_title: String = row.get(9)?;
            let notes: String = row.get(10)?;

            let line = format!(
                "{},{},{},{},{:.2},{},{:.4},{:.2},{},{},{}\n",
                Self::escape_csv_field(&id),
                Self::escape_csv_field(&date),
                Self::escape_csv_field(&tx_type),
                Self::escape_csv_field(&category),
                amount,
                Self::escape_csv_field(&currency),
                exchange_rate,
                base_amount,
                Self::escape_csv_field(&status),
                Self::escape_csv_field(&case_title),
                Self::escape_csv_field(&notes),
            );
            csv.push_str(&line);
        }

        Ok(csv)
    }

    /// CSV export for cases with exact column headers:
    /// id,code,title,client_name,client_contact,stage,quoted_amount,currency,start_date,target_completion_date,closed_date,created_at,updated_at
    fn export_cases_csv(conn: &Connection) -> Result<String, AppError> {
        let mut stmt = conn.prepare(
            "SELECT 
                id,
                code,
                title,
                client_name,
                COALESCE(client_contact, '') AS client_contact,
                stage,
                quoted_amount,
                currency,
                COALESCE(start_date, '') AS start_date,
                COALESCE(target_completion_date, '') AS target_completion_date,
                COALESCE(closed_date, '') AS closed_date,
                created_at,
                updated_at
            FROM cases
            ORDER BY created_at ASC"
        )?;

        let mut csv = String::from(
            "id,code,title,client_name,client_contact,stage,quoted_amount,currency,start_date,target_completion_date,closed_date,created_at,updated_at\n"
        );

        let mut rows = stmt.query([])?;
        while let Some(row) = rows.next()? {
            let id: String = row.get(0)?;
            let code: String = row.get(1)?;
            let title: String = row.get(2)?;
            let client_name: String = row.get(3)?;
            let client_contact: String = row.get(4)?;
            let stage: String = row.get(5)?;
            let quoted_amount: f64 = row.get(6)?;
            let currency: String = row.get(7)?;
            let start_date: String = row.get(8)?;
            let target_date: String = row.get(9)?;
            let closed_date: String = row.get(10)?;
            let created_at: String = row.get(11)?;
            let updated_at: String = row.get(12)?;

            let line = format!(
                "{},{},{},{},{},{},{:.2},{},{},{},{},{},{}\n",
                Self::escape_csv_field(&id),
                Self::escape_csv_field(&code),
                Self::escape_csv_field(&title),
                Self::escape_csv_field(&client_name),
                Self::escape_csv_field(&client_contact),
                Self::escape_csv_field(&stage),
                quoted_amount,
                Self::escape_csv_field(&currency),
                Self::escape_csv_field(&start_date),
                Self::escape_csv_field(&target_date),
                Self::escape_csv_field(&closed_date),
                Self::escape_csv_field(&created_at),
                Self::escape_csv_field(&updated_at),
            );
            csv.push_str(&line);
        }

        Ok(csv)
    }

    /// CSV export for journal entries with exact column headers:
    /// id,date,title,content,case_id,tags,is_starred,created_at,updated_at
    fn export_journal_csv(conn: &Connection) -> Result<String, AppError> {
        let mut stmt = conn.prepare(
            "SELECT 
                id,
                date,
                title,
                content,
                COALESCE(case_id, '') AS case_id,
                tags_json,
                is_starred,
                created_at,
                updated_at
            FROM journal_entries
            ORDER BY date ASC, created_at ASC"
        )?;

        let mut csv = String::from(
            "id,date,title,content,case_id,tags,is_starred,created_at,updated_at\n"
        );

        let mut rows = stmt.query([])?;
        while let Some(row) = rows.next()? {
            let id: String = row.get(0)?;
            let date: String = row.get(1)?;
            let title: String = row.get(2)?;
            let content: String = row.get(3)?;
            let case_id: String = row.get(4)?;
            let tags_json: String = row.get(5)?;
            let is_starred_int: i64 = row.get(6)?;
            let is_starred = is_starred_int != 0;
            let created_at: String = row.get(7)?;
            let updated_at: String = row.get(8)?;

            let tags_vec: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
            let tags_str = tags_vec.join(", ");

            let line = format!(
                "{},{},{},{},{},{},{},{},{}\n",
                Self::escape_csv_field(&id),
                Self::escape_csv_field(&date),
                Self::escape_csv_field(&title),
                Self::escape_csv_field(&content),
                Self::escape_csv_field(&case_id),
                Self::escape_csv_field(&tags_str),
                is_starred,
                Self::escape_csv_field(&created_at),
                Self::escape_csv_field(&updated_at),
            );
            csv.push_str(&line);
        }

        Ok(csv)
    }

    /// Escape string for XML Spreadsheet
    fn escape_xml(s: &str) -> String {
        s.replace('&', "&amp;")
            .replace('<', "&lt;")
            .replace('>', "&gt;")
            .replace('"', "&quot;")
            .replace('\'', "&apos;")
    }

    /// Export a complete multi-sheet Excel spreadsheet workbook to the target path
    pub fn export_excel(conn: &Connection, destination_path: &Path) -> Result<(), AppError> {
        // 1. Gather Financial & Operational Data
        let txs = TransactionRepo::list(conn, None)?;
        let cases = CaseRepo::list(conn)?;
        let base_currency = ExchangeRateRepo::get_base_currency(conn).unwrap_or_else(|_| "USD".to_string());
        let dashboard = calculate_dashboard_metrics(&txs, &cases, &base_currency);
        let ar_aging = calculate_ar_aging(&txs, None);

        let mut xml = String::new();
        xml.push_str("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xml.push_str("<?mso-application progid=\"Excel.Sheet\"?>\n");
        xml.push_str("<Workbook xmlns=\"urn:schemas-microsoft-com:office:spreadsheet\"\n");
        xml.push_str(" xmlns:o=\"urn:schemas-microsoft-com:office:office\"\n");
        xml.push_str(" xmlns:x=\"urn:schemas-microsoft-com:office:excel\"\n");
        xml.push_str(" xmlns:ss=\"urn:schemas-microsoft-com:office:spreadsheet\"\n");
        xml.push_str(" xmlns:html=\"http://www.w3.org/TR/REC-html40\">\n");

        // Document Properties
        xml.push_str(" <DocumentProperties xmlns=\"urn:schemas-microsoft-com:office:office\">\n");
        xml.push_str("  <Title>ApexJournal Financial &amp; Operating Report</Title>\n");
        xml.push_str("  <Author>ApexJournal</Author>\n");
        xml.push_str(&format!("  <Created>{}</Created>\n", chrono::Utc::now().to_rfc3339()));
        xml.push_str(" </DocumentProperties>\n");

        // Styles
        xml.push_str(" <Styles>\n");
        xml.push_str("  <Style ss:ID=\"Default\" ss:Name=\"Normal\">\n");
        xml.push_str("   <Alignment ss:Vertical=\"Center\"/>\n");
        xml.push_str("   <Font ss:FontName=\"Helvetica Neue\" ss:Size=\"10\" ss:Color=\"#FFFFFF\"/>\n");
        xml.push_str("   <Interior ss:Color=\"#121216\" ss:Pattern=\"Solid\"/>\n");
        xml.push_str("  </Style>\n");

        // Header Title Style
        xml.push_str("  <Style ss:ID=\"TitleStyle\">\n");
        xml.push_str("   <Font ss:FontName=\"Helvetica Neue\" ss:Size=\"14\" ss:Bold=\"1\" ss:Color=\"#8B5CF6\"/>\n");
        xml.push_str("   <Interior ss:Color=\"#09090B\" ss:Pattern=\"Solid\"/>\n");
        xml.push_str("  </Style>\n");

        // Table Header Style (Electric Purple Header)
        xml.push_str("  <Style ss:ID=\"TableHeader\">\n");
        xml.push_str("   <Font ss:FontName=\"Helvetica Neue\" ss:Size=\"10\" ss:Bold=\"1\" ss:Color=\"#FFFFFF\"/>\n");
        xml.push_str("   <Interior ss:Color=\"#4C1D95\" ss:Pattern=\"Solid\"/>\n");
        xml.push_str("   <Borders>\n");
        xml.push_str("    <Border ss:Position=\"Bottom\" ss:LineStyle=\"Continuous\" ss:Weight=\"1\" ss:Color=\"#8B5CF6\"/>\n");
        xml.push_str("   </Borders>\n");
        xml.push_str("  </Style>\n");

        // Metric Label Style
        xml.push_str("  <Style ss:ID=\"MetricLabel\">\n");
        xml.push_str("   <Font ss:FontName=\"Helvetica Neue\" ss:Size=\"10\" ss:Bold=\"1\" ss:Color=\"#9CA3AF\"/>\n");
        xml.push_str("   <Interior ss:Color=\"#18181F\" ss:Pattern=\"Solid\"/>\n");
        xml.push_str("  </Style>\n");

        // Currency Value Style
        xml.push_str("  <Style ss:ID=\"CurrencyCell\">\n");
        xml.push_str("   <NumberFormat ss:Format=\"$#,##0.00\"/>\n");
        xml.push_str("  </Style>\n");

        // Percentage Value Style
        xml.push_str("  <Style ss:ID=\"PercentCell\">\n");
        xml.push_str("   <NumberFormat ss:Format=\"0.00%\"/>\n");
        xml.push_str("  </Style>\n");

        // Date Style
        xml.push_str("  <Style ss:ID=\"DateCell\">\n");
        xml.push_str("   <Alignment ss:Horizontal=\"Center\"/>\n");
        xml.push_str("  </Style>\n");
        xml.push_str(" </Styles>\n");

        // ================= SHEET 1: Executive KPI Summary =================
        xml.push_str(" <Worksheet ss:Name=\"Executive Summary\">\n");
        xml.push_str("  <Table ss:DefaultColumnWidth=\"140\">\n");
        xml.push_str("   <Column ss:Width=\"220\"/>\n");
        xml.push_str("   <Column ss:Width=\"160\"/>\n");
        xml.push_str("   <Column ss:Width=\"160\"/>\n");

        // Title Row
        xml.push_str("   <Row ss:Height=\"28\">\n");
        xml.push_str("    <Cell ss:StyleID=\"TitleStyle\"><Data ss:Type=\"String\">APEXJOURNAL EXECUTIVE KPI SUMMARY</Data></Cell>\n");
        xml.push_str("   </Row>\n");
        xml.push_str("   <Row ss:Height=\"18\">\n");
        xml.push_str(&format!("    <Cell><Data ss:Type=\"String\">Report Generated: {} | Base Currency: {}</Data></Cell>\n", chrono::Utc::now().format("%Y-%m-%d %H:%M UTC"), dashboard.base_currency));
        xml.push_str("   </Row>\n");
        xml.push_str("   <Row ss:Height=\"10\"/>\n");

        // KPI Table Headers
        xml.push_str("   <Row ss:Height=\"22\">\n");
        xml.push_str("    <Cell ss:StyleID=\"TableHeader\"><Data ss:Type=\"String\">Executive Financial Metric</Data></Cell>\n");
        xml.push_str("    <Cell ss:StyleID=\"TableHeader\"><Data ss:Type=\"String\">Value</Data></Cell>\n");
        xml.push_str("    <Cell ss:StyleID=\"TableHeader\"><Data ss:Type=\"String\">Currency</Data></Cell>\n");
        xml.push_str("   </Row>\n");

        let kpi_rows = [
            ("Cumulative Net Margin (Realized PnL)", dashboard.cumulative_net_margin, "CurrencyCell", dashboard.base_currency.as_str()),
            ("Proposal Win Rate", dashboard.proposal_win_rate / 100.0, "PercentCell", "%"),
            ("Realized Income Volume", dashboard.realized_volume, "CurrencyCell", dashboard.base_currency.as_str()),
            ("Invoiced Pipeline Volume", dashboard.invoiced_volume, "CurrencyCell", dashboard.base_currency.as_str()),
            ("Average Ticket Size (Completed Cases)", dashboard.avg_ticket_size, "CurrencyCell", dashboard.base_currency.as_str()),
        ];

        for (label, val, style, curr) in kpi_rows {
            xml.push_str("   <Row ss:Height=\"20\">\n");
            xml.push_str(&format!("    <Cell ss:StyleID=\"MetricLabel\"><Data ss:Type=\"String\">{}</Data></Cell>\n", label));
            xml.push_str(&format!("    <Cell ss:StyleID=\"{}\"><Data ss:Type=\"Number\">{:.2}</Data></Cell>\n", style, val));
            xml.push_str(&format!("    <Cell><Data ss:Type=\"String\">{}</Data></Cell>\n", curr));
            xml.push_str("   </Row>\n");
        }

        xml.push_str("   <Row ss:Height=\"14\"/>\n");

        // AR Aging Table
        xml.push_str("   <Row ss:Height=\"22\">\n");
        xml.push_str("    <Cell ss:StyleID=\"TableHeader\"><Data ss:Type=\"String\">Accounts Receivable Aging Bucket</Data></Cell>\n");
        xml.push_str("    <Cell ss:StyleID=\"TableHeader\"><Data ss:Type=\"String\">Outstanding Amount</Data></Cell>\n");
        xml.push_str("    <Cell ss:StyleID=\"TableHeader\"><Data ss:Type=\"String\">Status Indicator</Data></Cell>\n");
        xml.push_str("   </Row>\n");

        let ar_rows = [
            ("Current (0 - 30 days)", ar_aging.current_0_30, "HEALTHY"),
            ("Pending (31 - 60 days)", ar_aging.pending_31_60, "ATTENTION"),
            ("Overdue (61 - 90 days)", ar_aging.overdue_61_90, "WARNING"),
            ("Critical (90+ days)", ar_aging.critical_90_plus, "ACTION REQUIRED"),
            ("Total Accounts Receivable", ar_aging.total_receivable, &format!("Traffic Light: {}", ar_aging.traffic_light)),
        ];

        for (label, val, status_text) in ar_rows {
            xml.push_str("   <Row ss:Height=\"20\">\n");
            xml.push_str(&format!("    <Cell ss:StyleID=\"MetricLabel\"><Data ss:Type=\"String\">{}</Data></Cell>\n", label));
            xml.push_str(&format!("    <Cell ss:StyleID=\"CurrencyCell\"><Data ss:Type=\"Number\">{:.2}</Data></Cell>\n", val));
            xml.push_str(&format!("    <Cell><Data ss:Type=\"String\">{}</Data></Cell>\n", status_text));
            xml.push_str("   </Row>\n");
        }

        xml.push_str("  </Table>\n");
        xml.push_str(" </Worksheet>\n");

        // ================= SHEET 2: Transactions Blotter =================
        xml.push_str(" <Worksheet ss:Name=\"Transactions\">\n");
        xml.push_str("  <Table ss:DefaultColumnWidth=\"110\">\n");
        xml.push_str("   <Column ss:Width=\"90\"/>\n");   // ID
        xml.push_str("   <Column ss:Width=\"85\"/>\n");   // Date
        xml.push_str("   <Column ss:Width=\"75\"/>\n");   // Type
        xml.push_str("   <Column ss:Width=\"140\"/>\n");  // Category
        xml.push_str("   <Column ss:Width=\"90\"/>\n");   // Amount
        xml.push_str("   <Column ss:Width=\"60\"/>\n");   // Currency
        xml.push_str("   <Column ss:Width=\"70\"/>\n");   // Ex Rate
        xml.push_str("   <Column ss:Width=\"95\"/>\n");   // Base Amount
        xml.push_str("   <Column ss:Width=\"80\"/>\n");   // Status
        xml.push_str("   <Column ss:Width=\"150\"/>\n");  // Case Title
        xml.push_str("   <Column ss:Width=\"180\"/>\n");  // Notes

        xml.push_str("   <Row ss:Height=\"24\">\n");
        for header in &["ID", "Date", "Type", "Category", "Amount", "Currency", "Exchange Rate", "Base Amount", "Status", "Case Title", "Notes"] {
            xml.push_str(&format!("    <Cell ss:StyleID=\"TableHeader\"><Data ss:Type=\"String\">{}</Data></Cell>\n", header));
        }
        xml.push_str("   </Row>\n");

        let mut tx_stmt = conn.prepare(
            "SELECT 
                t.id, t.date, t.type, COALESCE(c.name, '') AS category,
                t.amount, t.currency, t.exchange_rate, t.base_amount,
                t.status, COALESCE(cs.title, '') AS case_title, COALESCE(t.notes, '') AS notes
            FROM transactions t
            LEFT JOIN categories c ON t.category_id = c.id
            LEFT JOIN cases cs ON t.case_id = cs.id
            ORDER BY t.date DESC"
        )?;

        let mut tx_rows = tx_stmt.query([])?;
        while let Some(row) = tx_rows.next()? {
            let id: String = row.get(0)?;
            let date: String = row.get(1)?;
            let tx_type: String = row.get(2)?;
            let category: String = row.get(3)?;
            let amount: f64 = row.get(4)?;
            let currency: String = row.get(5)?;
            let exchange_rate: f64 = row.get(6)?;
            let base_amount: f64 = row.get(7)?;
            let status: String = row.get(8)?;
            let case_title: String = row.get(9)?;
            let notes: String = row.get(10)?;

            xml.push_str("   <Row ss:Height=\"18\">\n");
            xml.push_str(&format!("    <Cell><Data ss:Type=\"String\">{}</Data></Cell>\n", Self::escape_xml(&id)));
            xml.push_str(&format!("    <Cell ss:StyleID=\"DateCell\"><Data ss:Type=\"String\">{}</Data></Cell>\n", Self::escape_xml(&date)));
            xml.push_str(&format!("    <Cell><Data ss:Type=\"String\">{}</Data></Cell>\n", Self::escape_xml(&tx_type)));
            xml.push_str(&format!("    <Cell><Data ss:Type=\"String\">{}</Data></Cell>\n", Self::escape_xml(&category)));
            xml.push_str(&format!("    <Cell ss:StyleID=\"CurrencyCell\"><Data ss:Type=\"Number\">{:.2}</Data></Cell>\n", amount));
            xml.push_str(&format!("    <Cell><Data ss:Type=\"String\">{}</Data></Cell>\n", Self::escape_xml(&currency)));
            xml.push_str(&format!("    <Cell><Data ss:Type=\"Number\">{:.4}</Data></Cell>\n", exchange_rate));
            xml.push_str(&format!("    <Cell ss:StyleID=\"CurrencyCell\"><Data ss:Type=\"Number\">{:.2}</Data></Cell>\n", base_amount));
            xml.push_str(&format!("    <Cell><Data ss:Type=\"String\">{}</Data></Cell>\n", Self::escape_xml(&status)));
            xml.push_str(&format!("    <Cell><Data ss:Type=\"String\">{}</Data></Cell>\n", Self::escape_xml(&case_title)));
            xml.push_str(&format!("    <Cell><Data ss:Type=\"String\">{}</Data></Cell>\n", Self::escape_xml(&notes)));
            xml.push_str("   </Row>\n");
        }

        xml.push_str("  </Table>\n");
        xml.push_str(" </Worksheet>\n");

        // ================= SHEET 3: Case Pipeline =================
        xml.push_str(" <Worksheet ss:Name=\"Cases\">\n");
        xml.push_str("  <Table ss:DefaultColumnWidth=\"120\">\n");
        xml.push_str("   <Column ss:Width=\"80\"/>\n");   // Code
        xml.push_str("   <Column ss:Width=\"160\"/>\n");  // Title
        xml.push_str("   <Column ss:Width=\"130\"/>\n");  // Client Name
        xml.push_str("   <Column ss:Width=\"90\"/>\n");   // Stage
        xml.push_str("   <Column ss:Width=\"100\"/>\n");  // Quoted Amount
        xml.push_str("   <Column ss:Width=\"60\"/>\n");   // Currency
        xml.push_str("   <Column ss:Width=\"100\"/>\n");  // Realized Income
        xml.push_str("   <Column ss:Width=\"100\"/>\n");  // Realized Expense
        xml.push_str("   <Column ss:Width=\"100\"/>\n");  // Net Margin
        xml.push_str("   <Column ss:Width=\"80\"/>\n");   // Profit Margin %
        xml.push_str("   <Column ss:Width=\"85\"/>\n");   // Start Date
        xml.push_str("   <Column ss:Width=\"85\"/>\n");   // Target Date

        xml.push_str("   <Row ss:Height=\"24\">\n");
        for header in &["Code", "Title", "Client Name", "Stage", "Quoted Amount", "Currency", "Realized Income", "Realized Expense", "Net Margin", "Profit Margin", "Start Date", "Target Date"] {
            xml.push_str(&format!("    <Cell ss:StyleID=\"TableHeader\"><Data ss:Type=\"String\">{}</Data></Cell>\n", header));
        }
        xml.push_str("   </Row>\n");

        let mut case_stmt = conn.prepare(
            "SELECT 
                id, code, title, client_name, stage, quoted_amount, currency,
                COALESCE(start_date, '') AS start_date,
                COALESCE(target_completion_date, '') AS target_date
            FROM cases
            ORDER BY created_at DESC"
        )?;

        let mut case_rows = case_stmt.query([])?;
        while let Some(row) = case_rows.next()? {
            let case_id: String = row.get(0)?;
            let code: String = row.get(1)?;
            let title: String = row.get(2)?;
            let client_name: String = row.get(3)?;
            let stage: String = row.get(4)?;
            let quoted_amount: f64 = row.get(5)?;
            let currency: String = row.get(6)?;
            let start_date: String = row.get(7)?;
            let target_date: String = row.get(8)?;

            let pnl = calculate_case_pnl(&txs, Some(&case_id));

            xml.push_str("   <Row ss:Height=\"18\">\n");
            xml.push_str(&format!("    <Cell><Data ss:Type=\"String\">{}</Data></Cell>\n", Self::escape_xml(&code)));
            xml.push_str(&format!("    <Cell><Data ss:Type=\"String\">{}</Data></Cell>\n", Self::escape_xml(&title)));
            xml.push_str(&format!("    <Cell><Data ss:Type=\"String\">{}</Data></Cell>\n", Self::escape_xml(&client_name)));
            xml.push_str(&format!("    <Cell><Data ss:Type=\"String\">{}</Data></Cell>\n", Self::escape_xml(&stage)));
            xml.push_str(&format!("    <Cell ss:StyleID=\"CurrencyCell\"><Data ss:Type=\"Number\">{:.2}</Data></Cell>\n", quoted_amount));
            xml.push_str(&format!("    <Cell><Data ss:Type=\"String\">{}</Data></Cell>\n", Self::escape_xml(&currency)));
            xml.push_str(&format!("    <Cell ss:StyleID=\"CurrencyCell\"><Data ss:Type=\"Number\">{:.2}</Data></Cell>\n", pnl.realized_income));
            xml.push_str(&format!("    <Cell ss:StyleID=\"CurrencyCell\"><Data ss:Type=\"Number\">{:.2}</Data></Cell>\n", pnl.realized_expense));
            xml.push_str(&format!("    <Cell ss:StyleID=\"CurrencyCell\"><Data ss:Type=\"Number\">{:.2}</Data></Cell>\n", pnl.net_margin));
            xml.push_str(&format!("    <Cell ss:StyleID=\"PercentCell\"><Data ss:Type=\"Number\">{:.4}</Data></Cell>\n", pnl.profit_margin_pct / 100.0));
            xml.push_str(&format!("    <Cell ss:StyleID=\"DateCell\"><Data ss:Type=\"String\">{}</Data></Cell>\n", Self::escape_xml(&start_date)));
            xml.push_str(&format!("    <Cell ss:StyleID=\"DateCell\"><Data ss:Type=\"String\">{}</Data></Cell>\n", Self::escape_xml(&target_date)));
            xml.push_str("   </Row>\n");
        }

        xml.push_str("  </Table>\n");
        xml.push_str(" </Worksheet>\n");

        // ================= SHEET 4: Journal Entries =================
        xml.push_str(" <Worksheet ss:Name=\"Journal Entries\">\n");
        xml.push_str("  <Table ss:DefaultColumnWidth=\"140\">\n");
        xml.push_str("   <Column ss:Width=\"85\"/>\n");   // Date
        xml.push_str("   <Column ss:Width=\"180\"/>\n");  // Title
        xml.push_str("   <Column ss:Width=\"130\"/>\n");  // Case Code / Title
        xml.push_str("   <Column ss:Width=\"120\"/>\n");  // Tags
        xml.push_str("   <Column ss:Width=\"60\"/>\n");   // Starred
        xml.push_str("   <Column ss:Width=\"300\"/>\n");  // Content

        xml.push_str("   <Row ss:Height=\"24\">\n");
        for header in &["Date", "Title", "Case Association", "Tags", "Starred", "Markdown Content"] {
            xml.push_str(&format!("    <Cell ss:StyleID=\"TableHeader\"><Data ss:Type=\"String\">{}</Data></Cell>\n", header));
        }
        xml.push_str("   </Row>\n");

        let mut j_stmt = conn.prepare(
            "SELECT 
                j.date, j.title, COALESCE(cs.code || ' - ' || cs.title, '') AS case_info,
                j.tags_json, j.is_starred, j.content
            FROM journal_entries j
            LEFT JOIN cases cs ON j.case_id = cs.id
            ORDER BY j.date DESC"
        )?;

        let mut j_rows = j_stmt.query([])?;
        while let Some(row) = j_rows.next()? {
            let date: String = row.get(0)?;
            let title: String = row.get(1)?;
            let case_info: String = row.get(2)?;
            let tags_json: String = row.get(3)?;
            let is_starred_int: i64 = row.get(4)?;
            let is_starred = if is_starred_int != 0 { "★ Yes" } else { "No" };
            let content: String = row.get(5)?;

            let tags_vec: Vec<String> = serde_json::from_str(&tags_json).unwrap_or_default();
            let tags_str = tags_vec.join(", ");

            xml.push_str("   <Row ss:Height=\"20\">\n");
            xml.push_str(&format!("    <Cell ss:StyleID=\"DateCell\"><Data ss:Type=\"String\">{}</Data></Cell>\n", Self::escape_xml(&date)));
            xml.push_str(&format!("    <Cell><Data ss:Type=\"String\">{}</Data></Cell>\n", Self::escape_xml(&title)));
            xml.push_str(&format!("    <Cell><Data ss:Type=\"String\">{}</Data></Cell>\n", Self::escape_xml(&case_info)));
            xml.push_str(&format!("    <Cell><Data ss:Type=\"String\">{}</Data></Cell>\n", Self::escape_xml(&tags_str)));
            xml.push_str(&format!("    <Cell><Data ss:Type=\"String\">{}</Data></Cell>\n", is_starred));
            xml.push_str(&format!("    <Cell><Data ss:Type=\"String\">{}</Data></Cell>\n", Self::escape_xml(&content)));
            xml.push_str("   </Row>\n");
        }

        xml.push_str("  </Table>\n");
        xml.push_str(" </Worksheet>\n");

        xml.push_str("</Workbook>\n");

        // Write to destination
        if let Some(parent) = destination_path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        std::fs::write(destination_path, xml.as_bytes())?;

        log::info!("Successfully exported structured Excel spreadsheet to {:?}", destination_path);
        Ok(())
    }
}
