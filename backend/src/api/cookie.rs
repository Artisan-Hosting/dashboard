use artisan_middleware::{
    api::token::SimpleLoginRequest,
    dusa_collection_utils::{core::logger::LogLevel, log},
};
use chrono::{NaiveDateTime, Utc};
use reqwest::Client;
use uuid::Uuid;

use crate::database::connection::get_db_pool;

use super::helper::{get_base_url, peek_exp_from_jwt_unverified, peek_sub_from_jwt_unverified};

#[derive(Clone)]
pub struct SessionData {
    pub session_id: String,
    pub user_id: String, // sub data
    pub auth_jwt: String,
    pub refresh_jwt: String,
    pub expires_at: NaiveDateTime,
}

pub async fn login(request: SimpleLoginRequest) -> Result<SessionData, String> {
    let client = Client::new();
    let response = client
        .post(&format!("{}auth/login", get_base_url()))
        .json(&serde_json::json!({ "email": request.email, "password": request.password }))
        .send()
        .await
        .map_err(|err| err.to_string())?;

    if response.status().is_success() {
        let json: serde_json::Value = response.json().await.map_err(|err| err.to_string())?;
        let token = json.get("auth").and_then(|t| t.as_str());
        let refresh = json.get("refresh").and_then(|t| t.as_str());

        match (token, refresh) {
            (Some(token), Some(refresh)) => {
                // Decoding and creating a session
                let expiration_raw: u64 =
                    peek_exp_from_jwt_unverified(&refresh).map_err(|err| err.to_string())?;

                let session_id: String = Uuid::new_v4().to_string();
                let user_id: String =
                    peek_sub_from_jwt_unverified(&token).map_err(|err| err.to_string())?;
                let auth_jwt: String = token.to_string();
                let refresh_jwt: String = refresh.to_string();

                #[allow(deprecated)]
                let expires_at: NaiveDateTime =
                    NaiveDateTime::from_timestamp(expiration_raw as i64, 0);

                let session = SessionData {
                    session_id,
                    user_id,
                    auth_jwt,
                    refresh_jwt,
                    expires_at,
                };

                return Ok(session);
            }
            _ => {
                log!(
                    LogLevel::Error,
                    "Failed to parse both refresh and auth token"
                );
                return Err("Login failed".into());
            }
        };
    } else {
        return Err("Login failed".into());
    }
}

pub async fn lookup_session(
    pool: &sqlx::Pool<sqlx::MySql>,
    session_id: String,
) -> Result<SessionData, ()> {
    let row = sqlx::query!(
        r#"
        SELECT user_id, auth_jwt, refresh_jwt, expires_at
        FROM sessions
        WHERE session_id = ?
        "#,
        session_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|_| ())?;

    if let Some(r) = row {
        // Compare `expires_at` (TIMESTAMP) to now
        let now = Utc::now();
        let expires_at = r.expires_at;

        if r.expires_at > now {
            Ok(SessionData {
                user_id: r.user_id,
                auth_jwt: r.auth_jwt,
                refresh_jwt: r.refresh_jwt,
                expires_at: expires_at.naive_utc(),
                session_id,
            })
        } else {
            // Session expired
            Err(())
        }
    } else {
        // No such session
        Err(())
    }
}

pub async fn update_session_auth(auth: String, session_id: String) -> Result<String, String> {
    match sqlx::query!(
        r#"
        UPDATE sessions
        SET auth_jwt = ?
        WHERE session_id = ?
        "#,
        auth,
        session_id
    )
    .execute(get_db_pool())
    .await {
        Ok(_) => Ok(auth),
        Err(err) => Err(err.to_string()),
    }
}
