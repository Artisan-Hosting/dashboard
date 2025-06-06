use artisan_middleware::{
    dusa_collection_utils::{
        core::{
            errors::{ErrorArrayItem, Errors},
            logger::LogLevel,
        },
        log,
    },
    timestamp::current_timestamp,
};
use reqwest::Client;
use serde_json::json;

use crate::api::{cookie::{update_session_auth, SessionData}, helper::{get_base_url, peek_exp_from_jwt_unverified}};

pub async fn get_token(session: SessionData) -> Result<String, ErrorArrayItem> {
    log!(LogLevel::Debug, "get_token for session {}", session.session_id);
    let auth_token = session.auth_jwt;
    let refresh_token = session.refresh_jwt;

    // check auth token exp
    let auth_expire_time = peek_exp_from_jwt_unverified(&auth_token)
        .map_err(|err| ErrorArrayItem::new(Errors::AppState, err.to_string()))?;

    let current_time = current_timestamp();
    if auth_expire_time < current_time {
        log!(
            LogLevel::Info,
            "{} token expired, refreshing...",
            session.user_id
        );

        let request_body = json!({
            "expired_token": auth_token,
            "refresh_token": refresh_token
        });

        let response = Client::new()
            .post(&format!("{}auth/refresh", get_base_url()))
            .json(&request_body)
            .send()
            .await?;

        if response.status().is_success() {
            let json: serde_json::Value = response.json().await?;
            if let Some(new_token) = json.get("auth").and_then(|t| t.as_str()) {
                return match update_session_auth(new_token.to_owned(), session.session_id.clone()).await {
                    Ok(token) => {
                        log!(LogLevel::Info, "token refreshed for session {}", session.session_id);
                        Ok(token)
                    },
                    Err(err) => {
                        Err(ErrorArrayItem::new(Errors::AuthenticationError, err.to_string()))
                    },
                }
            } else {
                return Err(ErrorArrayItem::new(Errors::JsonReading, "Failed to de-serialize the servers response"))
            }
        } else {
            return Err(ErrorArrayItem::new(Errors::AuthenticationError, format!("Failed to refresh token for: {}", session.user_id)))
        }
        
    } else {
        log!(LogLevel::Debug, "token still valid for {}", session.session_id);
        return Ok(auth_token);
    }
}
