use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;
use crate::error::AppError;
use crate::models::{CreateJournalInput, JournalEntry, JournalFilter, UpdateJournalInput};

pub struct JournalRepo;

impl JournalRepo {
    pub fn create(conn: &Connection, input: CreateJournalInput) -> Result<JournalEntry, AppError> {
        if input.content.trim().is_empty() {
            return Err(AppError::ValidationError("Journal entry content cannot be empty.".into()));
        }

        let id = input.id.unwrap_or_else(|| format!("jrn-{}", Uuid::new_v4()));
        let now = chrono::Utc::now().to_rfc3339();
        let date = input.date.unwrap_or_else(|| now[..10].to_string());
        let title = input.title.unwrap_or_default();
        let tags = input.tags.unwrap_or_default();
        let tags_json = serde_json::to_string(&tags).unwrap_or_else(|_| "[]".into());
        let is_starred = if input.is_starred.unwrap_or(false) { 1 } else { 0 };

        conn.execute(
            "INSERT INTO journal_entries (id, date, title, content, case_id, tags_json, is_starred, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)",
            params![
                id,
                date,
                title,
                input.content,
                input.case_id,
                tags_json,
                is_starred,
                now,
                now,
            ],
        )?;

        Self::get_by_id(conn, &id)
    }

    pub fn update(conn: &Connection, id: &str, input: UpdateJournalInput) -> Result<JournalEntry, AppError> {
        let existing = Self::get_by_id(conn, id)?;
        let now = chrono::Utc::now().to_rfc3339();

        let new_date = input.date.unwrap_or(existing.date);
        let new_title = input.title.unwrap_or(existing.title);
        let new_content = input.content.unwrap_or(existing.content);
        let new_case_id = match input.case_id {
            Some(opt) => opt,
            None => existing.case_id,
        };
        let new_tags = input.tags.unwrap_or(existing.tags);
        let new_tags_json = serde_json::to_string(&new_tags).unwrap_or_else(|_| "[]".into());
        let new_starred = if input.is_starred.unwrap_or(existing.is_starred) { 1 } else { 0 };

        conn.execute(
            "UPDATE journal_entries SET
                date = ?2, title = ?3, content = ?4, case_id = ?5, tags_json = ?6, is_starred = ?7, updated_at = ?8
             WHERE id = ?1",
            params![
                id,
                new_date,
                new_title,
                new_content,
                new_case_id,
                new_tags_json,
                new_starred,
                now,
            ],
        )?;

        Self::get_by_id(conn, id)
    }

    pub fn get_by_id(conn: &Connection, id: &str) -> Result<JournalEntry, AppError> {
        conn.query_row(
            "SELECT id, date, title, content, case_id, tags_json, is_starred, created_at, updated_at
             FROM journal_entries WHERE id = ?1",
            params![id],
            |row| {
                let tags_str: String = row.get(5)?;
                let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
                let is_star: i64 = row.get(6)?;
                Ok(JournalEntry {
                    id: row.get(0)?,
                    date: row.get(1)?,
                    title: row.get(2)?,
                    content: row.get(3)?,
                    case_id: row.get(4)?,
                    tags,
                    is_starred: is_star != 0,
                    created_at: row.get(7)?,
                    updated_at: row.get(8)?,
                })
            },
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound(format!("Journal entry with ID {} not found.", id)))
    }

    pub fn list(conn: &Connection, filter: Option<&JournalFilter>) -> Result<Vec<JournalEntry>, AppError> {
        let f = filter.cloned().unwrap_or_default();
        let mut stmt = conn.prepare(
            "SELECT id, date, title, content, case_id, tags_json, is_starred, created_at, updated_at
             FROM journal_entries
             WHERE (?1 IS NULL OR case_id = ?1)
               AND (?2 IS NULL OR (
                   (title IS NOT NULL AND LOWER(title) LIKE '%' || LOWER(?2) || '%') OR
                   (content IS NOT NULL AND LOWER(content) LIKE '%' || LOWER(?2) || '%')
               ))
             ORDER BY date DESC, created_at DESC",
        )?;

        let rows = stmt.query_map(params![f.case_id, f.search], |row| {
            let tags_str: String = row.get(5)?;
            let tags: Vec<String> = serde_json::from_str(&tags_str).unwrap_or_default();
            let is_star: i64 = row.get(6)?;
            Ok(JournalEntry {
                id: row.get(0)?,
                date: row.get(1)?,
                title: row.get(2)?,
                content: row.get(3)?,
                case_id: row.get(4)?,
                tags,
                is_starred: is_star != 0,
                created_at: row.get(7)?,
                updated_at: row.get(8)?,
            })
        })?;

        let mut result = Vec::new();
        for r in rows {
            let entry = r?;
            if let Some(ref tag_filter) = f.tag {
                if !entry.tags.contains(tag_filter) {
                    continue;
                }
            }
            result.push(entry);
        }
        Ok(result)
    }

    pub fn list_by_case(conn: &Connection, case_id: &str) -> Result<Vec<JournalEntry>, AppError> {
        let filter = JournalFilter {
            case_id: Some(case_id.to_string()),
            ..Default::default()
        };
        Self::list(conn, Some(&filter))
    }
}
