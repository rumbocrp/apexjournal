use rusqlite::{params, Connection, OptionalExtension};
use crate::error::AppError;
use crate::models::ExchangeRate;

pub struct ExchangeRateRepo;

impl ExchangeRateRepo {
    pub fn get_rate(conn: &Connection, currency_code: &str) -> Result<f64, AppError> {
        let base_currency = Self::get_base_currency(conn)?;
        if currency_code.eq_ignore_ascii_case(&base_currency) {
            return Ok(1.0);
        }

        let rate: Option<f64> = conn
            .query_row(
                "SELECT rate_to_base FROM exchange_rates WHERE currency_code = ?1 COLLATE NOCASE",
                params![currency_code],
                |row| row.get(0),
            )
            .optional()?;

        Ok(rate.unwrap_or(1.0))
    }

    pub fn set_rate(conn: &Connection, currency_code: &str, rate: f64) -> Result<(), AppError> {
        if rate <= 0.0 || rate.is_nan() || rate.is_infinite() {
            return Err(AppError::ValidationError("Exchange rate must be strictly positive.".into()));
        }
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO exchange_rates (currency_code, rate_to_base, updated_at)
             VALUES (?1, ?2, ?3)
             ON CONFLICT(currency_code) DO UPDATE SET rate_to_base = ?2, updated_at = ?3",
            params![currency_code.to_uppercase(), rate, now],
        )?;
        Ok(())
    }

    pub fn list(conn: &Connection) -> Result<Vec<ExchangeRate>, AppError> {
        let mut stmt = conn.prepare("SELECT currency_code, rate_to_base, updated_at FROM exchange_rates ORDER BY currency_code ASC")?;
        let rows = stmt.query_map([], |row| {
            Ok(ExchangeRate {
                currency_code: row.get(0)?,
                rate_to_base: row.get(1)?,
                updated_at: row.get(2)?,
            })
        })?;

        let mut result = Vec::new();
        for r in rows {
            result.push(r?);
        }
        Ok(result)
    }

    pub fn get_base_currency(conn: &Connection) -> Result<String, AppError> {
        let base: Option<String> = conn
            .query_row(
                "SELECT value FROM app_settings WHERE key = 'base_currency'",
                [],
                |row| row.get(0),
            )
            .optional()?;
        Ok(base.unwrap_or_else(|| "USD".into()))
    }

    pub fn set_base_currency(conn: &Connection, base_currency: &str) -> Result<(), AppError> {
        let now = chrono::Utc::now().to_rfc3339();
        conn.execute(
            "INSERT INTO app_settings (key, value, updated_at) VALUES ('base_currency', ?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = ?1, updated_at = ?2",
            params![base_currency.to_uppercase(), now],
        )?;
        Ok(())
    }
}
