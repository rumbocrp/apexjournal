use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;
use crate::analytics::calculate_case_pnl;
use crate::error::AppError;
use crate::models::{Case, CaseDetail, CreateCaseInput, TransactionFilter, UpdateCaseInput};
use crate::db::transactions::TransactionRepo;
use crate::db::milestones::MilestoneRepo;
use crate::db::journal::JournalRepo;

pub struct CaseRepo;

impl CaseRepo {
    pub fn create(conn: &Connection, input: CreateCaseInput) -> Result<Case, AppError> {
        if input.title.trim().is_empty() {
            return Err(AppError::ValidationError("Case title is required.".into()));
        }
        if input.client_name.trim().is_empty() {
            return Err(AppError::ValidationError("Client name is required.".into()));
        }

        let id = input.id.unwrap_or_else(|| format!("case-{}", Uuid::new_v4()));
        let code = input.code.unwrap_or_else(|| {
            let short = if id.len() >= 8 { &id[id.len() - 6..] } else { &id };
            format!("CASE-{}", short.to_uppercase())
        });
        let stage = input.stage.unwrap_or_else(|| "LEAD".into());
        let quoted_amount = input.quoted_amount.unwrap_or(0.0);
        let currency = input.currency.unwrap_or_else(|| "USD".into());
        let now = chrono::Utc::now().to_rfc3339();
        let created_at = input.created_at.unwrap_or_else(|| now.clone());
        let updated_at = input.updated_at.unwrap_or_else(|| now.clone());

        conn.execute(
            "INSERT INTO cases (id, code, title, client_name, client_contact, stage, quoted_amount, currency, proposal_value_base, start_date, target_completion_date, closed_date, notes, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![
                id,
                code,
                input.title,
                input.client_name,
                input.client_contact,
                stage,
                quoted_amount,
                currency,
                quoted_amount,
                input.start_date,
                input.target_completion_date,
                input.closed_date,
                input.notes,
                created_at,
                updated_at,
            ],
        )?;

        Self::get_by_id(conn, &id)
    }

    pub fn update(conn: &Connection, id: &str, input: UpdateCaseInput) -> Result<Case, AppError> {
        let existing = Self::get_by_id(conn, id)?;
        let now = chrono::Utc::now().to_rfc3339();

        let new_title = input.title.unwrap_or(existing.title);
        let new_client = input.client_name.unwrap_or(existing.client_name);
        let new_contact = input.client_contact.or(existing.client_contact);
        let new_stage = input.stage.unwrap_or(existing.stage);
        let new_quoted = input.quoted_amount.unwrap_or(existing.quoted_amount);
        let new_currency = input.currency.unwrap_or(existing.currency);
        let new_code = input.code.unwrap_or(existing.code);
        let new_start = input.start_date.or(existing.start_date);
        let new_target = input.target_completion_date.or(existing.target_completion_date);
        let new_closed = input.closed_date.or(existing.closed_date);
        let new_notes = input.notes.or(existing.notes);

        conn.execute(
            "UPDATE cases SET
                code = ?2, title = ?3, client_name = ?4, client_contact = ?5, stage = ?6,
                quoted_amount = ?7, currency = ?8, proposal_value_base = ?9, start_date = ?10,
                target_completion_date = ?11, closed_date = ?12, notes = ?13, updated_at = ?14
             WHERE id = ?1",
            params![
                id,
                new_code,
                new_title,
                new_client,
                new_contact,
                new_stage,
                new_quoted,
                new_currency,
                new_quoted,
                new_start,
                new_target,
                new_closed,
                new_notes,
                now,
            ],
        )?;

        Self::get_by_id(conn, id)
    }

    pub fn get_by_id(conn: &Connection, id: &str) -> Result<Case, AppError> {
        conn.query_row(
            "SELECT id, code, title, client_name, client_contact, stage, quoted_amount, currency,
                    proposal_value_base, start_date, target_completion_date, closed_date, notes, created_at, updated_at
             FROM cases WHERE id = ?1",
            params![id],
            |row| {
                Ok(Case {
                    id: row.get(0)?,
                    code: row.get(1)?,
                    title: row.get(2)?,
                    client_name: row.get(3)?,
                    client_contact: row.get(4)?,
                    stage: row.get(5)?,
                    quoted_amount: row.get(6)?,
                    currency: row.get(7)?,
                    proposal_value_base: row.get(8)?,
                    start_date: row.get(9)?,
                    target_completion_date: row.get(10)?,
                    closed_date: row.get(11)?,
                    notes: row.get(12)?,
                    created_at: row.get(13)?,
                    updated_at: row.get(14)?,
                })
            },
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound(format!("Case with ID {} not found.", id)))
    }

    pub fn list(conn: &Connection) -> Result<Vec<Case>, AppError> {
        let mut stmt = conn.prepare(
            "SELECT id, code, title, client_name, client_contact, stage, quoted_amount, currency,
                    proposal_value_base, start_date, target_completion_date, closed_date, notes, created_at, updated_at
             FROM cases ORDER BY created_at DESC",
        )?;

        let rows = stmt.query_map([], |row| {
            Ok(Case {
                id: row.get(0)?,
                code: row.get(1)?,
                title: row.get(2)?,
                client_name: row.get(3)?,
                client_contact: row.get(4)?,
                stage: row.get(5)?,
                quoted_amount: row.get(6)?,
                currency: row.get(7)?,
                proposal_value_base: row.get(8)?,
                start_date: row.get(9)?,
                target_completion_date: row.get(10)?,
                closed_date: row.get(11)?,
                notes: row.get(12)?,
                created_at: row.get(13)?,
                updated_at: row.get(14)?,
            })
        })?;

        let mut result = Vec::new();
        for r in rows {
            result.push(r?);
        }
        Ok(result)
    }

    pub fn get_detail(conn: &Connection, id: &str) -> Result<CaseDetail, AppError> {
        let cs = Self::get_by_id(conn, id)?;

        // Fetch transactions for this case
        let filter = TransactionFilter {
            case_id: Some(id.to_string()),
            ..Default::default()
        };
        let txs = TransactionRepo::list(conn, Some(&filter))?;
        let pnl = calculate_case_pnl(&txs, Some(id));

        // Fetch milestones for this case
        let milestones = MilestoneRepo::list_by_case(conn, id)?;

        // Fetch diary entries for this case
        let diary_entries = JournalRepo::list_by_case(conn, id)?;

        Ok(CaseDetail {
            id: cs.id,
            code: cs.code,
            title: cs.title,
            client_name: cs.client_name,
            client_contact: cs.client_contact,
            stage: cs.stage,
            quoted_amount: cs.quoted_amount,
            currency: cs.currency,
            created_at: cs.created_at,
            updated_at: cs.updated_at,
            realized_income: pnl.realized_income,
            realized_expense: pnl.realized_expense,
            net_margin: pnl.net_margin,
            profit_margin_pct: pnl.profit_margin_pct,
            milestones,
            diary_entries,
        })
    }
}
