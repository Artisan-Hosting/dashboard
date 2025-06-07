use artisan_middleware::dusa_collection_utils::{core::logger::LogLevel, log};
use once_cell::sync::OnceCell;
use sqlx::{MySqlPool, mysql::MySqlPoolOptions};
use std::env;

static DB_POOL: OnceCell<MySqlPool> = OnceCell::new();

/// Initialize the global pool.
/// FOR THE LOVE OF GOD call this *exactly once* at application startup!
pub async fn init_db_pool() -> Result<(), sqlx::Error> {
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "mysql://artisan:Danny9518!@database-0.arhst.net/ArtisanRbac".into());

    log!(LogLevel::Info, "connecting DB...");

    let pool = MySqlPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await?;

    DB_POOL
        .set(pool)
        .map_err(|_| sqlx::Error::Configuration("Pool already initialized".into()))?;

    log!(LogLevel::Info, "database connection established");
    Ok(())
}

/// Get a reference to the global pool.
/// Panics if called before `init_db_pool()`!
pub fn get_db_pool() -> &'static MySqlPool {
    DB_POOL.get().expect("DB pool not initialized")
}
