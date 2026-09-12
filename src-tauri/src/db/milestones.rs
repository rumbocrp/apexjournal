use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;
use crate::error::AppError;
use crate::models::{CreateMilestoneInput, Milestone};

pub struct MilestoneRepo;

impl MilestoneRepo {
    pub fn create(conn: &Connection, input: CreateMilestoneInput) -> Result<Milestone, AppError> {
        if input.title.trim().is_empty() {
            return Err(AppError::ValidationError("Milestone title is required.".into()));
        }

        let id = input.id.unwrap_or_else(|| format!("ms-{}", Uuid::new_v4()));
        let description = input.description.unwrap_or_default();
        let due_date = input.due_date.unwrap_or_default();
        let is_completed = if input.completed.unwrap_or(false) { 1 } else { 0 };
        let amount_base = input.amount.unwrap_or(0.0);
        let completed_date = if is_completed != 0 {
            Some(chrono::Utc::now().to_rfc3339())
        } else {
            None
        };
        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO milestones (id, case_id, title, description, due_date, is_completed, amount_base, completed_date, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                id,
                input.case_id,
                input.title,
                description,
                due_date,
                is_completed,
                amount_base,
                completed_date,
                now,
            ],
        )?;

        Self::get_by_id(conn, &id)
    }

    pub fn toggle(conn: &Connection, id: &str, completed: bool) -> Result<Milestone, AppError> {
        let is_completed = if completed { 1 } else { 0 };
        let completed_date = if completed {
            Some(chrono::Utc::now().to_rfc3339())
        } else {
            None
        };

        let rows = conn.execute(
            "UPDATE milestones SET is_completed = ?2, completed_date = ?3 WHERE id = ?1",
            params![id, is_completed, completed_date],
        )?;

        if rows == 0 {
            return Err(AppError::NotFound(format!("Milestone with ID {} not found.", id)));
        }

        Self::get_by_id(conn, id)
    }

    pub fn get_by_id(conn: &Connection, id: &str) -> Result<Milestone, AppError> {
        conn.query_row(
            "SELECT id, case_id, title, description, due_date, is_completed, amount_base, completed_date, created_at
             FROM milestones WHERE id = ?1",
            params![id],
            |row| {
                let is_comp: i64 = row.get(5)?;
                Ok(Milestone {
                    id: row.get(0)?,
                    case_id: row.get(1)?,
                    title: row.get(2)?,
                    description: row.get(3)?,
                    due_date: row.get(4)?,
                    completed: is_comp != 0,
                    amount: row.get(6)?,
                    completed_date: row.get(7)?,
                    created_at: row.get(8)?,
                })
            },
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound(format!("Milestone with ID {} not found.", id)))
    }

    pub fn list_by_case(conn: &Connection, case_id: &str) -> Result<Vec<Milestone>, AppError> {
        let mut stmt = conn.prepare(
            "SELECT id, case_id, title, description, due_date, is_completed, amount_base, completed_date, created_at
             FROM milestones WHERE case_id = ?1 ORDER BY created_at ASC",
        )?;

        let rows = stmt.query_map(params![case_id], |row| {
            let is_comp: i64 = row.get(5)?;
            Ok(Milestone {
                id: row.get(0)?,
                case_id: row.get(1)?,
                title: row.get(2)?,
                description: row.get(3)?,
                due_date: row.get(4)?,
                completed: is_comp != 0,
                amount: row.get(6)?,
                completed_date: row.get(7)?,
                created_at: row.get(8)?,
            })
        })?;

        let mut result = Vec::new();
        for r in rows {
            result.push(r?);
        }
        Ok(result)
    }
}
