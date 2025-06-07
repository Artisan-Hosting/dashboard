use crate::api::{cache::CachedResponse, cookie::SessionData, helper::get_base_url};
use crate::auth::token::get_token;
use crate::state::get_state;
use artisan_middleware::dusa_collection_utils::{core::logger::LogLevel, log};
use chrono::Utc;
use std::time::{Duration, Instant};
use tokio::time::sleep;

async fn refresh_endpoint(path: &str, token: &str) {
    let url = format!("{}{}", get_base_url(), path);
    let client = get_state().http_client.clone();
    match client.get(&url).bearer_auth(token).send().await {
        Ok(mut resp) => {
            let status = resp.status();
            let headers = resp.headers().clone();
            match resp.bytes().await {
                Ok(body) => {
                    let content_type = headers
                        .get("content-type")
                        .and_then(|h| h.to_str().ok())
                        .unwrap_or("application/json")
                        .to_string();
                    get_state()
                        .proxy_cache
                        .insert(
                            path.to_string(),
                            CachedResponse {
                                status: status.as_u16(),
                                content_type,
                                body: body.to_vec(),
                                inserted: Instant::now(),
                            },
                        )
                        .await;
                }
                Err(e) => log!(LogLevel::Warn, "failed to read {} body: {}", path, e),
            }
        }
        Err(e) => log!(LogLevel::Warn, "refresh {} failed: {}", path, e),
    }
}

pub fn spawn_session_refresh(session: SessionData) {
    tokio::spawn(async move {
        loop {
            if session.expires_at <= Utc::now() {
                log!(
                    LogLevel::Info,
                    "session {} expired, stopping refresh",
                    session.session_id
                );
                get_state().session_cache.remove(&session.session_id).await;
                break;
            }

            if let Ok(token) = get_token(session.clone()).await {
                refresh_endpoint("vms", &token).await;
                refresh_endpoint("apps", &token).await;
            } else {
                log!(LogLevel::Warn, "failed to get token for {}", session.session_id);
            }

            sleep(Duration::from_secs(30)).await;
        }
    });
}
