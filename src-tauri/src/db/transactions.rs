use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;
use crate::analytics::calc_base_amount;
use crate::db::ExchangeRateRepo;
use crate::error::AppError;
use crate::models::{ARAgingSummary, CreateTransactionInput, Transaction, TransactionFilter, UpdateTransactionInput};
use crate::analytics::round2;

// NOTE: no v1/v2 write branches. Every production open runs migrations
// before any repo call (state + backup), so v2 columns always exist.
// A pre-v2 connection is a programming error and must fail loudly.

fn resolve_category_name(
    conn: &Connection,
    category_id: &str,
    explicit: Option<String>,
) -> Option<String> {
    if let Some(n) = explicit {
        if !n.trim().is_empty() {
            return Some(n);
        }
    }
    let name: Option<String> = conn
        .query_row(
            "SELECT name FROM categories WHERE id = ?1",
            params![category_id],
            |row| row.get(0),
        )
        .optional()
        .ok()
        .flatten();
    name
}

fn resolve_case_title(
    conn: &Connection,
    case_id: Option<&String>,
    explicit: Option<String>,
) -> Option<String> {
    if let Some(t) = explicit {
        if !t.trim().is_empty() {
            return Some(t);
        }
    }
    let cid = case_id?;
    let title: Option<String> = conn
        .query_row(
            "SELECT title FROM cases WHERE id = ?1",
            params![cid],
            |row| row.get(0),
        )
        .optional()
        .ok()
        .flatten();
    title
}

fn resolve_traffic_light(current_0_30: f64, pending_31_60: f64, overdue_61_90: f64, critical_90_plus: f64, total: f64) -> String {
    let _ = (current_0_30, pending_31_60, total);
    if critical_90_plus > 0.0 {
        "RED".to_string()
    } else if overdue_61_90 > 0.0 {
        "YELLOW".to_string()
    } else {
        "GREEN".to_string()
    }
}

pub struct TransactionRepo;

impl TransactionRepo {
    pub fn create(conn: &Connection, input: CreateTransactionInput) -> Result<Transaction, AppError> {
        if input.date.trim().is_empty() {
            return Err(AppError::ValidationError("Transaction date is required.".into()));
        }
        if input.r#type != "INCOME" && input.r#type != "EXPENSE" {
            return Err(AppError::ValidationError("Valid transaction type (INCOME or EXPENSE) is required.".into()));
        }
        if input.amount < 0.0 || input.amount.is_nan() || input.amount.is_infinite() {
            return Err(AppError::ValidationError("Valid transaction amount is required.".into()));
        }

        let currency = input.currency.unwrap_or_else(|| "USD".into());
        let exchange_rate = match input.exchange_rate {
            Some(rate) => {
                if rate <= 0.0 || rate.is_nan() || rate.is_infinite() {
                    return Err(AppError::ValidationError("Exchange rate must be strictly positive.".into()));
                }
                rate
            }
            None => ExchangeRateRepo::get_rate(conn, &currency)?,
        };

        let id = input.id.unwrap_or_else(|| format!("tx-{}", Uuid::new_v4()));
        // SPEC §2.2: Bankers rounding via Decimal, not binary float
        let base_amount = calc_base_amount(input.amount, exchange_rate);
        let status = input.status.unwrap_or_else(|| "CLEARED".into());
        let category_id = input.category_id.unwrap_or_else(|| {
            if input.r#type == "INCOME" { "cat-1".into() } else { "cat-4".into() }
        });
        let category_name_resolved =
            resolve_category_name(conn, &category_id, input.category_name.clone());
        let case_title_resolved =
            resolve_case_title(conn, input.case_id.as_ref(), input.case_title.clone());

        let now = chrono::Utc::now().to_rfc3339();

        conn.execute(
            "INSERT INTO transactions (id, date, type, category_id, category_name, amount, currency, exchange_rate, base_amount, status, case_id, case_title, notes, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)",
            params![
                id,
                input.date,
                input.r#type,
                category_id,
                category_name_resolved.unwrap_or_default(),
                input.amount,
                currency,
                exchange_rate,
                base_amount,
                status,
                input.case_id,
                case_title_resolved,
                input.notes,
                now,
                now,
            ],
        )?;

        Self::get_by_id(conn, &id)
    }

    pub fn update(conn: &Connection, id: &str, input: UpdateTransactionInput) -> Result<Transaction, AppError> {
        let existing = Self::get_by_id(conn, id)?;

        let new_amount = input.amount.unwrap_or(existing.amount);
        if new_amount < 0.0 || new_amount.is_nan() || new_amount.is_infinite() {
            return Err(AppError::ValidationError("Invalid transaction amount.".into()));
        }

        let new_currency = input.currency.unwrap_or_else(|| existing.currency.clone());
        let new_rate = match input.exchange_rate {
            Some(rate) => {
                if rate <= 0.0 || rate.is_nan() || rate.is_infinite() {
                    return Err(AppError::ValidationError("Exchange rate must be positive.".into()));
                }
                rate
            }
            None => {
                if new_currency != existing.currency {
                    ExchangeRateRepo::get_rate(conn, &new_currency)?
                } else {
                    existing.exchange_rate
                }
            }
        };

        let new_base_amount = calc_base_amount(new_amount, new_rate);
        let new_date = input.date.unwrap_or(existing.date);
        let new_type = input.r#type.unwrap_or(existing.r#type);
        let new_category_id = input.category_id.unwrap_or(existing.category_id);
        let new_status = input.status.unwrap_or(existing.status);
        let new_case_id = match input.case_id {
            Some(opt) => opt,
            None => existing.case_id,
        };
        let new_notes = match input.notes {
            Some(opt) => opt,
            None => existing.notes,
        };
        let now = chrono::Utc::now().to_rfc3339();

        let new_category_name = match input.category_name {
            Some(n) => Some(n),
            None => resolve_category_name(conn, &new_category_id, existing.category_name.clone()),
        }
        .unwrap_or_default();
        let new_case_title = match input.case_title {
            Some(t) => Some(t),
            None => resolve_case_title(conn, new_case_id.as_ref(), existing.case_title.clone()),
        };
        conn.execute(
            "UPDATE transactions SET
                date = ?2, type = ?3, category_id = ?4, category_name = ?5, amount = ?6, currency = ?7,
                exchange_rate = ?8, base_amount = ?9, status = ?10, case_id = ?11, case_title = ?12,
                notes = ?13, updated_at = ?14
             WHERE id = ?1",
            params![
                id,
                new_date,
                new_type,
                new_category_id,
                new_category_name,
                new_amount,
                new_currency,
                new_rate,
                new_base_amount,
                new_status,
                new_case_id,
                new_case_title,
                new_notes,
                now,
            ],
        )?;

        Self::get_by_id(conn, id)
    }

    pub fn delete(conn: &Connection, id: &str) -> Result<(), AppError> {
        let rows = conn.execute("DELETE FROM transactions WHERE id = ?1", params![id])?;
        if rows == 0 {
            return Err(AppError::NotFound(format!("Transaction with ID {} not found.", id)));
        }
        Ok(())
    }

    pub fn get_by_id(conn: &Connection, id: &str) -> Result<Transaction, AppError> {
        conn.query_row(
            "SELECT t.id, t.date, t.type, t.category_id, c.name, t.amount, t.currency,
                    t.exchange_rate, t.base_amount, t.status, t.case_id, cs.title, t.notes
             FROM transactions t
             LEFT JOIN categories c ON t.category_id = c.id
             LEFT JOIN cases cs ON t.case_id = cs.id
             WHERE t.id = ?1",
            params![id],
            |row| {
                Ok(Transaction {
                    id: row.get(0)?,
                    date: row.get(1)?,
                    r#type: row.get(2)?,
                    category_id: row.get(3)?,
                    category_name: row.get(4)?,
                    amount: row.get(5)?,
                    currency: row.get(6)?,
                    exchange_rate: row.get(7)?,
                    base_amount: row.get(8)?,
                    status: row.get(9)?,
                    case_id: row.get(10)?,
                    case_title: row.get(11)?,
                    notes: row.get(12)?,
                })
            },
        )
        .optional()?
        .ok_or_else(|| AppError::NotFound(format!("Transaction with ID {} not found.", id)))
    }

    pub fn list(conn: &Connection, filter: Option<&TransactionFilter>) -> Result<Vec<Transaction>, AppError> {
        let f = filter.cloned().unwrap_or_default();
        let mut stmt = conn.prepare(
            "SELECT t.id, t.date, t.type, t.category_id, c.name, t.amount, t.currency,
                    t.exchange_rate, t.base_amount, t.status, t.case_id, cs.title, t.notes
             FROM transactions t
             LEFT JOIN categories c ON t.category_id = c.id
             LEFT JOIN cases cs ON t.case_id = cs.id
             WHERE (?1 IS NULL OR t.type = ?1)
               AND (?2 IS NULL OR t.status = ?2)
               AND (?3 IS NULL OR t.case_id = ?3)
               AND (?4 IS NULL OR t.category_id = ?4)
               AND (?5 IS NULL OR t.currency = ?5)
               AND (?6 IS NULL OR t.date >= ?6)
               AND (?7 IS NULL OR t.date <= ?7)
               AND (?8 IS NULL OR (
                   (t.notes IS NOT NULL AND LOWER(t.notes) LIKE '%' || LOWER(?8) || '%') OR
                   (cs.title IS NOT NULL AND LOWER(cs.title) LIKE '%' || LOWER(?8) || '%') OR
                   (c.name IS NOT NULL AND LOWER(c.name) LIKE '%' || LOWER(?8) || '%')
               ))
             ORDER BY t.date ASC, t.created_at ASC",
        )?;

        let rows = stmt.query_map(
            params![
                f.r#type,
                f.status,
                f.case_id,
                f.category_id,
                f.currency,
                f.start_date,
                f.end_date,
                f.search,
            ],
            |row| {
                Ok(Transaction {
                    id: row.get(0)?,
                    date: row.get(1)?,
                    r#type: row.get(2)?,
                    category_id: row.get(3)?,
                    category_name: row.get(4)?,
                    amount: row.get(5)?,
                    currency: row.get(6)?,
                    exchange_rate: row.get(7)?,
                    base_amount: row.get(8)?,
                    status: row.get(9)?,
                    case_id: row.get(10)?,
                    case_title: row.get(11)?,
                    notes: row.get(12)?,
                })
            },
        )?;

        let mut result = Vec::new();
        for r in rows {
            result.push(r?);
        }
        Ok(result)
    }

    /// SPEC §3.2: Single-pass atomic AR aging aggregation in SQL.
    /// Sums pre-rounded base_amount (Decimal Bankers at write time) to avoid
    /// float accumulation error. Resolves traffic light per SPEC §2.3 in Rust.
    ///
    /// Performance (v3): cutoffs are computed in Rust and compared as ISO
    /// date strings instead of `julianday()` per row. Lexicographic compare
    /// on `YYYY-MM-DD` is chronological, sargable on the partial index, and
    /// orders of magnitude cheaper than per-row date parsing + float math.
    /// Bucket boundaries are identical to the day-difference definition:
    /// age N means `substr(date,1,10) = ref - N days`. Future dates land in
    /// 0-30, mirroring the in-memory `max(0, diff)` clamp. Write validation
    /// rejects empty dates, so malformed strings are out of contract.
    pub fn calculate_ar_aging_sql(conn: &Connection) -> Result<ARAgingSummary, AppError> {
        let ref_day = chrono::Utc::now().date_naive();
        Self::calculate_ar_aging_on(conn, ref_day)
    }

    /// Same aggregation against an explicit reference day. Separated for
    /// deterministic tests; production always passes "today".
    ///
    /// Reads the v3 `ar_daily_outstanding` pre-aggregation (one row per
    /// transaction day, trigger-maintained), so cost scales with distinct
    /// days, not transactions. See `calculate_ar_aging_scan` for the
    /// full-scan verification path over `transactions`.
    pub fn calculate_ar_aging_on(
        conn: &Connection,
        ref_day: chrono::NaiveDate,
    ) -> Result<ARAgingSummary, AppError> {
        let d30 = (ref_day - chrono::Duration::days(30)).to_string();
        let d60 = (ref_day - chrono::Duration::days(60)).to_string();
        let d90 = (ref_day - chrono::Duration::days(90)).to_string();
        let row = conn.query_row(
            "SELECT
                COALESCE(SUM(CASE WHEN tx_date >= ?1 THEN total ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN tx_date >= ?2 AND tx_date < ?1 THEN total ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN tx_date >= ?3 AND tx_date < ?2 THEN total ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN tx_date < ?3 THEN total ELSE 0 END), 0),
                COALESCE(SUM(total), 0)
             FROM ar_daily_outstanding",
            rusqlite::params![d30, d60, d90],
            |r| {
                Ok((
                    r.get::<_, f64>(0)?,
                    r.get::<_, f64>(1)?,
                    r.get::<_, f64>(2)?,
                    r.get::<_, f64>(3)?,
                    r.get::<_, f64>(4)?,
                ))
            },
        )?;

        let (c0, p1, o2, c3, total) = row;
        let current_0_30 = round2(c0);
        let pending_31_60 = round2(p1);
        let overdue_61_90 = round2(o2);
        let critical_90_plus = round2(c3);
        let total_receivable = round2(total);
        let traffic_light =
            resolve_traffic_light(current_0_30, pending_31_60, overdue_61_90, critical_90_plus, total_receivable);

        Ok(ARAgingSummary {
            current_0_30,
            pending_31_60,
            overdue_61_90,
            critical_90_plus,
            total_receivable,
            traffic_light,
        })
    }

    /// Full-scan verification path: identical buckets computed straight from
    /// `transactions`. Production reads the pre-aggregation; tests assert
    /// triple parity (pre-aggregated == scan == in-memory) so trigger drift
    /// can never hide.
    pub fn calculate_ar_aging_scan(
        conn: &Connection,
        ref_day: chrono::NaiveDate,
    ) -> Result<ARAgingSummary, AppError> {
        let d30 = (ref_day - chrono::Duration::days(30)).to_string();
        let d60 = (ref_day - chrono::Duration::days(60)).to_string();
        let d90 = (ref_day - chrono::Duration::days(90)).to_string();
        let row = conn.query_row(
            "SELECT
                COALESCE(SUM(CASE WHEN substr(date, 1, 10) >= ?1 THEN base_amount ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN substr(date, 1, 10) >= ?2 AND substr(date, 1, 10) < ?1 THEN base_amount ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN substr(date, 1, 10) >= ?3 AND substr(date, 1, 10) < ?2 THEN base_amount ELSE 0 END), 0),
                COALESCE(SUM(CASE WHEN substr(date, 1, 10) < ?3 THEN base_amount ELSE 0 END), 0),
                COALESCE(SUM(base_amount), 0)
             FROM transactions
             WHERE type = 'INCOME' AND status IN ('INVOICED', 'PENDING')",
            rusqlite::params![d30, d60, d90],
            |r| {
                Ok((
                    r.get::<_, f64>(0)?,
                    r.get::<_, f64>(1)?,
                    r.get::<_, f64>(2)?,
                    r.get::<_, f64>(3)?,
                    r.get::<_, f64>(4)?,
                ))
            },
        )?;

        let (c0, p1, o2, c3, total) = row;
        let current_0_30 = round2(c0);
        let pending_31_60 = round2(p1);
        let overdue_61_90 = round2(o2);
        let critical_90_plus = round2(c3);
        let total_receivable = round2(total);
        let traffic_light =
            resolve_traffic_light(current_0_30, pending_31_60, overdue_61_90, critical_90_plus, total_receivable);

        Ok(ARAgingSummary {
            current_0_30,
            pending_31_60,
            overdue_61_90,
            critical_90_plus,
            total_receivable,
            traffic_light,
        })
    }
}
