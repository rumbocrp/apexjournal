use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;
use crate::error::AppError;
use crate::models::{Category, CreateCategoryInput};

pub struct CategoryRepo;

impl CategoryRepo {
    pub fn list(conn: &Connection) -> Result<Vec<Category>, AppError> {
        let mut stmt = conn.prepare(
            "SELECT id, name, type, color_hex, is_system, created_at FROM categories ORDER BY name ASC",
        )?;
        let rows = stmt.query_map([], |row| {
            let is_sys: i64 = row.get(4)?;
            Ok(Category {
                id: row.get(0)?,
                name: row.get(1)?,
                r#type: row.get(2)?,
                color_hex: row.get(3)?,
                is_system: is_sys != 0,
                created_at: row.get(5)?,
            })
        })?;

        let mut result = Vec::new();
        for r in rows {
            result.push(r?);
        }
        Ok(result)
    }

    pub fn get_by_id(conn: &Connection, id: &str) -> Result<Category, AppError> {
        conn.query_row(
            "SELECT id, name, type, color_hex, is_system, created_at FROM categories WHERE id = ?1",
            params![id],
            |row| {
                let is_sys: i64 = row.get(4)?;
                Ok(Category {
                    id: row.get(0)?,
                    name: row.get(1)?,
                    r#type: row.get(2)?,
                    color_hex: row.get(3)?,
                    is_system: is_sys != 0,
                    created_at: row.get(5)?,
                })
            },
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound(format!("Category with ID {} not found", id)))
    }

    pub fn create(conn: &Connection, input: CreateCategoryInput) -> Result<Category, AppError> {
        if input.name.trim().is_empty() {
            return Err(AppError::ValidationError("Category name is required.".into()));
        }
        if input.r#type != "INCOME" && input.r#type != "EXPENSE" {
            return Err(AppError::ValidationError("Category type must be INCOME or EXPENSE.".into()));
        }

        let id = input.id.unwrap_or_else(|| format!("cat-{}", Uuid::new_v4()));
        let color_hex = input.color_hex.unwrap_or_else(|| "#8B5CF6".into());
        let is_system = if input.is_system.unwrap_or(false) { 1 } else { 0 };
        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO categories (id, name, type, color_hex, is_system, created_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
            params![id, input.name, input.r#type, color_hex, is_system, now],
        )?;

        Self::get_by_id(conn, &id)
    }
}
