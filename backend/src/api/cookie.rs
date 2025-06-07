use artisan_middleware::{
    api::token::SimpleLoginRequest,
    dusa_collection_utils::{core::logger::LogLevel, log},
};
use chrono::{DateTime, Utc};
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
    pub expires_at: DateTime<Utc>,
}

fn timestamp_to_u64<S>(dt: &DateTime<Utc>, s: S) -> Result<S::Ok, S::Error>
where
    S: serde::Serializer,
{
    s.serialize_u64(dt.timestamp() as u64)
}

fn timestamp_from_u64<'de, D>(d: D) -> Result<DateTime<Utc>, D::Error>
where
    D: serde::Deserializer<'de>,
{
    let ts = u64::deserialize(d)?;
    DateTime::from_timestamp(ts as i64, 0)
        .ok_or_else(|| serde::de::Error::custom("invalid timestamp"))
}

pub async fn login(request: SimpleLoginRequest) -> Result<SessionData, String> {
    // Log entry into login function (at Debug level).
    log!(
        LogLevel::Debug,
        "login(): received request for email={}",
        request.email
    );


    let client = Client::new();

    // Log that we are about to send the HTTP request.
    log!(
        LogLevel::Debug,
        "login(): sending POST to {}/auth/login",
        get_base_url()
    );

    let response = client
        .post(&format!("{}auth/login", get_base_url()))
        .json(&serde_json::json!({ "email": request.email, "password": "<REDACTED>" }))
        .send()
        .await
        .map_err(|err| {
            log!(
                LogLevel::Error,
                "login(): HTTP request failed: {}",
                err.to_string()
            );
            err.to_string()
        })?;

    // Log HTTP status code.
    log!(
        LogLevel::Debug,
        "login(): received HTTP status {}",
        response.status()
    );

    if response.status().is_success() {
        let json: serde_json::Value = response.json().await.map_err(|err| {
            log!(
                LogLevel::Error,
                "login(): failed to parse JSON: {}",
                err.to_string()
            );
            err.to_string()
        })?;

        // Log the full returned JSON at Debug level (you may want to redact tokens in production).
        log!(
            LogLevel::Debug,
            "login(): response JSON = {}",
            json.to_string()
        );

        let token = json.get("auth").and_then(|t| t.as_str());
        let refresh = json.get("refresh").and_then(|t| t.as_str());

        match (token, refresh) {
            (Some(token), Some(refresh)) => {
                log!(
                    LogLevel::Info,
                    "login(): successfully got auth and refresh tokens"
                );

                // Decode expiration from refresh JWT
                let expiration_raw: u64 =
                    peek_exp_from_jwt_unverified(&refresh).map_err(|err| {
                        log!(
                            LogLevel::Error,
                            "login(): peek_exp_from_jwt_unverified failed: {}",
                            err.to_string()
                        );
                        err.to_string()
                    })?;

                let session_id: String = Uuid::new_v4().to_string();
                let user_id: String = peek_sub_from_jwt_unverified(&token).map_err(|err| {
                    log!(
                        LogLevel::Error,
                        "login(): peek_sub_from_jwt_unverified failed: {}",
                        err.to_string()
                    );
                    err.to_string()
                })?;

                let auth_jwt: String = token.to_string();
                let refresh_jwt: String = refresh.to_string();

                #[allow(deprecated)]
                let expires_at: DateTime<Utc> = DateTime::from_timestamp(expiration_raw as i64, 0)
                    .unwrap_or(DateTime::default());

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
        let user_id: String = r.try_get("user_id").map_err(|e| {
            log!(
                LogLevel::Error,
                "lookup_session column user_id error: {}",
                e
            );
            ()
        })?;
        let auth_jwt: String = r.try_get("auth_jwt").map_err(|e| {
            log!(
                LogLevel::Error,
                "lookup_session column auth_jwt error: {}",
                e
            );
            ()
        })?;
        let refresh_jwt: String = r.try_get("refresh_jwt").map_err(|e| {
            log!(
                LogLevel::Error,
                "lookup_session column refresh_jwt error: {}",
                e
            );
            ()
        })?;
        let expires_at: DateTime<Utc> = r.try_get("expires_at").map_err(|e| {
            log!(LogLevel::Error, "lookup_session column expires_at error: {}", e);
            ()
        })?;

        log!(LogLevel::Trace, "lookup_session fetched user {}", user_id);

        // Compare `expires_at` (TIMESTAMP) to now
        let now = Utc::now();
        log!(
            LogLevel::Debug,
            "lookup_session(): now={}, expires_at={}",
            now,
            expires_at
        );

        if expires_at > now {
            log!(
                LogLevel::Info,
                "lookup_session(): session is still valid (not expired)"
            );
            Ok(SessionData {
                session_id: session_id.clone(),
                user_id,
                auth_jwt,
                refresh_jwt,
                expires_at,
            })
        } else {
            // Session expired
            log!(
                LogLevel::Warn,
                "lookup_session(): session_id={} has expired at {}",
                session_id,
                expires_at
            );
            Err(())
        }
    } else {
        // No such session
        log!(
            LogLevel::Warn,
            "lookup_session(): no session found for session_id={}",
            session_id
        );
        Err(())
    }
}

pub async fn update_session_auth(auth: String, session_id: String) -> Result<String, String> {
    log!(
        LogLevel::Debug,
        "update_session_auth(): about to update auth_jwt for session_id={}",
        session_id
    );

    let query_str = r#"
        UPDATE sessions
        SET auth_jwt = ?
        WHERE session_id = ?
    "#;

    match sqlx::query(query_str)
        .bind(&auth)
        .bind(&session_id)
        .execute(get_db_pool())
        .await
    {
        Ok(res) => {
            log!(
                LogLevel::Info,
                "update_session_auth(): updated {} rows for session_id={}",
                res.rows_affected(),
                session_id
            );
            Ok(auth)
        }
        Err(err) => {
            log!(
                LogLevel::Error,
                "update_session_auth(): failed to execute UPDATE: {}",
                err.to_string()
            );
            Err(err.to_string())
        }
    }
}

pub async fn load_active_sessions(
    pool: &sqlx::Pool<sqlx::MySql>,
) -> Result<Vec<SessionData>, sqlx::Error> {
    let rows = sqlx::query(
        r#"SELECT session_id, user_id, auth_jwt, refresh_jwt, expires_at
        FROM sessions
        WHERE expires_at > NOW()"#,
    )
    .fetch_all(pool)
    .await?;

    let mut sessions = Vec::new();
    for row in rows {
        sessions.push(SessionData {
            session_id: row.try_get("session_id")?,
            user_id: row.try_get("user_id")?,
            auth_jwt: row.try_get("auth_jwt")?,
            refresh_jwt: row.try_get("refresh_jwt")?,
            expires_at: row.try_get("expires_at")?,
        });
    }
    Ok(sessions)
}
