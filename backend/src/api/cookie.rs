use artisan_middleware::{
    api::token::SimpleLoginRequest,
    dusa_collection_utils::{core::logger::LogLevel, log},
};
use chrono::{NaiveDateTime, Utc};
use reqwest::Client;
use sqlx::Row;
use uuid::Uuid;

use crate::database::connection::get_db_pool;

use super::helper::{get_base_url, peek_exp_from_jwt_unverified, peek_sub_from_jwt_unverified};

use serde::{Deserialize, Serialize};

#[derive(Clone, Serialize, Deserialize)]
pub struct SessionData {
    pub session_id: String,
    pub user_id: String, // sub data
    pub auth_jwt: String,
    pub refresh_jwt: String,
    #[serde(
        serialize_with = "timestamp_to_u64",
        deserialize_with = "timestamp_from_u64"
    )]
    pub expires_at: NaiveDateTime,
}

fn timestamp_to_u64<S>(dt: &NaiveDateTime, s: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    s.serialize_u64(dt.timestamp() as u64)
}

fn timestamp_from_u64<'de, D>(d: D) -> Result<NaiveDateTime, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let ts = u64::deserialize(d)?;
    NaiveDateTime::from_timestamp_opt(ts as i64, 0)
        .ok_or_else(|| serde::de::Error::custom("invalid timestamp"))
}

pub async fn login(request: SimpleLoginRequest) -> Result<SessionData, String> {
    log!(LogLevel::Info, "login attempt for {}", request.email);
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
                    session_id: session_id.clone(),
                    user_id: user_id.clone(),
                    auth_jwt,
                    refresh_jwt,
                    expires_at,
                };

                log!(
                    LogLevel::Info,
                    "login success user {} session {}",
                    user_id,
                    session_id
                );
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
        log!(
            LogLevel::Warn,
            "login failed with status {}",
            response.status()
        );
        return Err("Login failed".into());
    }
}

pub async fn lookup_session(
    pool: &sqlx::Pool<sqlx::MySql>,
    session_id: String,
) -> Result<SessionData, ()> {
    // Look up the session in the database
    let row = sqlx::query(
        r#"SELECT user_id, auth_jwt, refresh_jwt, expires_at
        FROM sessions
        WHERE session_id = ?"#,
    )
    .bind(&session_id)
    .fetch_optional(pool)
    .await
    .map_err(|e| {
        log!(LogLevel::Error, "lookup_session query error: {}", e);
        ()
    })?;

    log!(
        LogLevel::Trace,
        "lookup_session row exists: {}",
        row.is_some()
    );

    if let Some(r) = row {
        let user_id: String = r.try_get("user_id").map_err(|err| {
            log!(
                LogLevel::Error,
                "Failed to parse db value: {}",
                err.to_string()
            );
            ()
        })?;
        let auth_jwt: String = r.try_get("auth_jwt").map_err(|err| {
            log!(
                LogLevel::Error,
                "Failed to parse db value: {}",
                err.to_string()
            );
            ()
        })?;
        let refresh_jwt: String = r.try_get("refresh_jwt").map_err(|err| {
            log!(
                LogLevel::Error,
                "Failed to parse db value: {}",
                err.to_string()
            );
            ()
        })?;

        let expires_at_dt: chrono::DateTime<Utc> = r.try_get("expires_at").map_err(|err| {
            log!(
                LogLevel::Error,
                "lookup_session(): failed to get expires_at (as DateTime<Utc>): {}",
                err.to_string()
            );
            ()
        })?;
        // If you still need a NaiveDateTime, you can call `.naive_utc()`
        let expires_at: NaiveDateTime = expires_at_dt.naive_utc();

        // Compare `expires_at` (TIMESTAMP) to now
        let now = Utc::now().naive_utc();

        if expires_at > now {
            Ok(SessionData {
                user_id,
                auth_jwt,
                refresh_jwt,
                expires_at,
                session_id,
            })
        } else {
            log!(LogLevel::Warn, "lookup_session expired");
            Err(())
        }
    } else {
        log!(LogLevel::Warn, "lookup_session not found");
        Err(())
    }
}

pub async fn update_session_auth(auth: String, session_id: String) -> Result<String, String> {
    log!(
        LogLevel::Debug,
        "refreshing auth for session {}",
        session_id
    );
    match sqlx::query(
        r#"UPDATE sessions
        SET auth_jwt = ?
        WHERE session_id = ?"#,
    )
    .bind(&auth)
    .bind(&session_id)
    .execute(get_db_pool())
    .await
    {
        Ok(result) => {
            log!(
                LogLevel::Trace,
                "update_session_auth affected {} rows for {}",
                result.rows_affected(),
                session_id
            );
            Ok(auth)
        }
        Err(err) => {
            log!(
                LogLevel::Error,
                "update_session_auth failed for {}: {}",
                session_id,
                err
            );
            Err(err.to_string())
        }
    }
}
