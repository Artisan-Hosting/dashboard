use once_cell::sync::OnceCell;
use reqwest::Client;
use std::time::Duration;

use crate::{
    api::cache::{Cache, SessionCache},
    grpc, // for SecretClient
};
use artisan_middleware::dusa_collection_utils::{core::logger::LogLevel, log};

pub struct AppState {
    pub proxy_cache: Cache,
    pub session_cache: SessionCache,
    pub http_client: Client,
    pub secret_client: grpc::SecretClient,
}

static APP_STATE: OnceCell<AppState> = OnceCell::new();

pub async fn init_state() -> Result<(), Box<dyn std::error::Error>> {
    let secret_addr = std::env::var("SECRET_GRPC_ADDR").expect("SECRET_GRPC_ADDR must be set");
    log!(LogLevel::Info, "connecting to secret gRPC {}", &secret_addr);
    let secret_client = grpc::SecretClient::connect(secret_addr).await?;

    let http_client = Client::builder()
        .timeout(Duration::from_secs(15))
        .build()
        .expect("failed to build http client");

    let state = AppState {
        proxy_cache: Cache::new(),
        session_cache: SessionCache::new(),
        http_client,
        secret_client,
    };

    APP_STATE.set(state).map_err(|_| {
        std::io::Error::new(std::io::ErrorKind::Other, "AppState already initialized")
    })?;

    log!(LogLevel::Info, "app state initialized");
    Ok(())
}

pub fn get_state() -> &'static AppState {
    APP_STATE.get().expect("AppState not initialized")
}
