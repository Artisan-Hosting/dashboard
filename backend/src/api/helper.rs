use crate::{api::common::PortalRejection::Unauthorized, database::connection::get_db_pool};
use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use artisan_middleware::dusa_collection_utils::{
    core::logger::LogLevel,
    log,
};
use serde_json::Value;
use std::error::Error;
use warp::{
    Filter,
    reject::{self, Rejection},
};

use std::time::Duration;

use super::cache::SESSION_CACHE;
use super::cookie::{lookup_session, SessionData};

pub fn get_base_url() -> &'static str {
    "https://api.artisanhosting.net/v1/"
}

pub fn with_session() -> impl Filter<Extract = (SessionData,), Error = Rejection> + Clone {
    // First, try to grab the "session_id" cookie.
    // If missing, warp will generate a BadRequest rejection.
    warp::cookie("session_id").and_then(move |session_id: String| {
        async move {
            const TTL: Duration = Duration::from_secs(30 * 60);
            if let Some(sess) = SESSION_CACHE.get(&session_id, TTL).await {
                log!(LogLevel::Debug, "session cache hit {}", session_id);
                return Ok(sess);
            }
            match lookup_session(get_db_pool(), session_id.clone()).await {
                Ok(user) => {
                    log!(
                        LogLevel::Debug,
                        "validated session {} for user {}",
                        user.session_id,
                        user.user_id
                    );
                    SESSION_CACHE.insert(session_id.clone(), user.clone()).await;
                    Ok(user)
                }
                Err(_) => {
                    log!(LogLevel::Warn, "invalid session {}", session_id);
                    Err(reject::custom(Unauthorized(
                        "Invalid session data".to_owned(),
                    )))
                }
            }
        }
    })
}

pub fn peek_exp_from_jwt_unverified(jwt: &str) -> Result<u64, Box<dyn Error>> {
    let parts: Vec<&str> = jwt.split('.').collect();
    if parts.len() != 3 {
        return Err("JWT must have exactly 3 parts".into());
    }
    let payload_b64 = parts[1];

    // Decode the payload (no padding, URL‐safe alphabet)
    let payload_bytes = URL_SAFE_NO_PAD.decode(payload_b64)?;
    let payload_str = std::str::from_utf8(&payload_bytes)?;

    // Parse as JSON and pick out "exp"
    let v: Value = serde_json::from_str(payload_str)?;
    match v.get("exp").and_then(|e| e.as_u64()) {
        Some(exp) => Ok(exp),
        None => Err("No exp field in JWT payload".into()),
    }
}

pub fn peek_sub_from_jwt_unverified(jwt: &str) -> Result<String, Box<dyn Error>> {
    let parts: Vec<&str> = jwt.split('.').collect();
    if parts.len() != 3 {
        return Err("JWT must have exactly 3 parts".into());
    }
    let payload_b64 = parts[1];

    // Decode the payload (no padding, URL‐safe alphabet)
    let payload_bytes = URL_SAFE_NO_PAD.decode(payload_b64)?;
    let payload_str = std::str::from_utf8(&payload_bytes)?;

    // Parse as JSON and pick out "exp"
    let v: Value = serde_json::from_str(payload_str)?;
    match v.get("sub").and_then(|e| e.as_str()) {
        Some(sub) => Ok(sub.to_owned()),
        None => Err("No sub field in JWT payload".into()),
    }
}
