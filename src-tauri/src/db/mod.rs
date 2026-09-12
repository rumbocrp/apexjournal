pub mod connection;
pub mod migrations;
pub mod schema;
pub mod transactions;
pub mod categories;
pub mod cases;
pub mod milestones;
pub mod journal;
pub mod exchange_rates;

pub use connection::DatabaseManager;
pub use migrations::MigrationManager;
pub use schema::INITIAL_SCHEMA_SQL;
pub use transactions::TransactionRepo;
pub use categories::CategoryRepo;
pub use cases::CaseRepo;
pub use milestones::MilestoneRepo;
pub use journal::JournalRepo;
pub use exchange_rates::ExchangeRateRepo;

// Module aliases for naming compatibility
pub mod transactions_repo {
    pub use super::transactions::*;
}
pub mod cases_repo {
    pub use super::cases::*;
}
pub mod journal_repo {
    pub use super::journal::*;
}
pub mod exchange_repo {
    pub use super::exchange_rates::*;
}
