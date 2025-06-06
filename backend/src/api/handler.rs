use crate::{
    api::{common::PortalRejection::Whoops, helper::get_base_url},
    auth::token::get_token,
    database::connection::get_db_pool,
};
use artisan_middleware::{
    api::token::SimpleLoginRequest,
    dusa_collection_utils::{core::logger::LogLevel, log},
    portal::{ApiResponse, RunnerSummary},
};
use bytes::Bytes;
use cookie::CookieBuilder;
use reqwest::Client;
use warp::hyper::Body;
use warp::{http::header::{HeaderValue, SET_COOKIE}, reply::Response};
use serde_json::Value as JsonValue;

use super::cookie::{SessionData, login};

pub async fn login_handler(
    login_data: SimpleLoginRequest,
) -> Result<impl warp::Reply, warp::Rejection> {
    log!(LogLevel::Debug, "login_handler called for {}", login_data.email);
    return match login(login_data).await {
        Ok(session) => {

            log!(
                LogLevel::Info,
                "storing session {} for user {}",
                session.session_id,
                session.user_id
            );
            sqlx::query(
                r#"INSERT INTO sessions (session_id, user_id, auth_jwt, refresh_jwt, expires_at)
                   VALUES (?, ?, ?, ?, ?)"#,
            )
            .bind(&session.session_id)
            .bind(&session.user_id)
            .bind(&session.auth_jwt)
            .bind(&session.refresh_jwt)
            .bind(session.expires_at)
            .execute(get_db_pool())
            .await
            .map_err(|e| {
                log!(LogLevel::Error, "DB insert error for {}: {}", session.session_id, e);
                warp::reject::custom(Whoops(e.to_string()))
            })?;

            let cookie = CookieBuilder::new("session_id", session.session_id.clone())
                // .http_only(true)
                .path("/");
                // .secure(true)
                // .finish();

            let set_cookie_header = cookie.to_string();

            let header_value = HeaderValue::from_str(&set_cookie_header)
                .expect("cookie.to_string() returned invalid header‐value");

            log!(LogLevel::Debug, "session {} inserted in DB", session.session_id);

            let body = format!("Logged in as {}.", session.user_id);
            let reply = warp::reply::with_header(body, SET_COOKIE, header_value);

            Ok(reply)
        }
        Err(err) => Err(warp::reject::custom(Whoops(err))),
    };
}

pub async fn logout_handler(session: SessionData) -> Result<impl warp::Reply, warp::Rejection> {
    log!(LogLevel::Info, "logout for session {}", session.session_id);
    // Delete the row (if it exists):
    if let Err(e) = sqlx::query(
        "DELETE FROM sessions WHERE session_id = ?",
    )
    .bind(&session.session_id)
    .execute(get_db_pool())
    .await
    {
        log!(LogLevel::Error, "Error deleting session from DB: {}", e);
        // We’ll ignore the error at logout time—user can still send a "clear-cookie" header.
    }

    // Build a “clear cookie”:
    let clear = cookie::Cookie::build("session_id")
        .max_age(cookie::time::Duration::seconds(0))
        .path("/");
        // .finish();

    let set_clear_header = clear.to_string();

    let header_value = HeaderValue::from_str(&set_clear_header)
        .expect("clear.to_string() returned invalid header‐value");

    let reply = warp::reply::with_header("", SET_COOKIE, header_value);
    log!(LogLevel::Debug, "session {} logged out", session.session_id);
    Ok(reply)
}

pub async fn whoami_handler(session: SessionData) -> Result<impl warp::Reply, warp::Rejection> {
    log!(LogLevel::Debug, "whoami for session {}", session.session_id);
    match get_token(session.clone()).await {
        Ok(token) => {
            let client = Client::new();

            // First: get user_id
            let response_me = client
                .get(&format!("{}account/me", get_base_url()))
                .bearer_auth(token.clone())
                .send()
                .await
                .map_err(|e| warp::reject::custom(Whoops(e.to_string())))?;

            let username = {
                if response_me.status().is_success() {
                    let json: serde_json::Value = response_me
                        .json()
                        .await
                        .map_err(|e| warp::reject::custom(Whoops(e.to_string())))?;

                    json.get("user_id")
                        .and_then(|id| id.as_str())
                        .unwrap_or("Unknown")
                        .to_string()
                } else {
                    log!(LogLevel::Warn, "Failed to get user ID for session {}", session.session_id);
                    return Err(warp::reject::custom(Whoops(
                        "Failed to get the username".to_string(),
                    )));
                }
            };

            // Then: get role and expiration
            let response = client
                .post(&format!("{}whoami", get_base_url()))
                .bearer_auth(token)
                .send()
                .await
                .map_err(|e| warp::reject::custom(Whoops(e.to_string())))?;

            if response.status().is_success() {
                let json: serde_json::Value = response
                    .json()
                    .await
                    .map_err(|e| warp::reject::custom(Whoops(e.to_string())))?;

                if let Some(data) = json.get("you") {
                    let expires = data.get("expires").and_then(|v| v.as_u64()).unwrap_or(0);
                    let reply = warp::reply::json(
                        &serde_json::json!({ "user_id": username, "expires": expires}),
                    );
                    log!(LogLevel::Info, "whoami success session {}", session.session_id);
                    Ok(reply)
                } else {
                    log!(LogLevel::Warn, "whoami missing data for session {}", session.session_id);
                    Err(warp::reject::custom(Whoops(
                        "Failed to get the username".to_string(),
                    )))
                }
            } else {
                log!(LogLevel::Warn, "whoami bad status for session {}", session.session_id);
                Err(warp::reject::custom(Whoops(
                    "Failed to de-serialize the servers response".to_string(),
                )))
            }
        }
        Err(err) => Err(warp::reject::custom(Whoops(err.err_mesg.to_string()))),
    }
}

pub async fn me_handler(session: SessionData) -> Result<impl warp::Reply, warp::Rejection> {
    log!(LogLevel::Debug, "me_handler for session {}", session.session_id);
    match get_token(session.clone()).await {
        Ok(token) => {
            let client = Client::new();

            // First: get user_id
            let response_me = client
                .get(&format!("{}account/me", get_base_url()))
                .bearer_auth(token.clone())
                .send()
                .await
                .map_err(|e| warp::reject::custom(Whoops(e.to_string())))?;

            let json: serde_json::Value = response_me
                .json()
                .await
                .map_err(|e| warp::reject::custom(Whoops(e.to_string())))?;

            let username = {
                json.get("user_id")
                    .and_then(|id| id.as_str())
                    .unwrap_or("Unknown")
                    .to_string()
            };

            let email = {
                json.get("email")
                    .and_then(|id| id.as_str())
                    .unwrap_or("Unknown")
                    .to_string()
            };

            let reply = warp::reply::json(
                &serde_json::json!({ "user_id": username, "email": email}),
            );
            log!(LogLevel::Info, "me success session {}", session.session_id);
            Ok(reply)
        }
        Err(err) => Err(warp::reject::custom(Whoops(err.err_mesg.to_string()))),
    }
}

pub async fn runners_handler(session: SessionData) -> Result<impl warp::Reply, warp::Rejection> {
    log!(LogLevel::Debug, "runners_handler for session {}", session.session_id);
    match get_token(session.clone()).await {
        Ok(token) => {
            let client = Client::new();

            let response = client
                .get(&format!("{}runners", get_base_url()))
                .bearer_auth(token)
                .send()
                .await
                .map_err(|e| warp::reject::custom(Whoops(e.to_string())))?;

            if response.status().is_success() {
                let api_response: ApiResponse<Vec<RunnerSummary>> = response
                    .json()
                    .await
                    .map_err(|e| warp::reject::custom(Whoops(e.to_string())))?;

                log!(LogLevel::Info, "runners success session {}", session.session_id);
                Ok(warp::reply::json(&api_response))
            } else {
                log!(LogLevel::Warn, "runners failed status for {}", session.session_id);
                Err(warp::reject::custom(Whoops(
                    "The server left us on delivered".to_string(),
                )))
            }
        }
        Err(err) => Err(warp::reject::custom(Whoops(err.err_mesg.to_string()))),
    }
}

/// This is the “generic” proxy.  It receives:
///   - tail: everything after `/api/proxy/` (e.g. `"runners"`, `"account/me"`).
///   - method: GET / POST / PUT / DELETE / etc.
///   - raw_query: the string after `?`, e.g. `"limit=10&page=2"`.
///   - body_bytes: the raw request body (possibly empty).
///   - session: your SessionData extractor
///
pub async fn generic_proxy_handler(
    tail: warp::path::Tail,
    method: warp::http::Method,
    raw_query: String,
    body_bytes: Bytes,
    session: SessionData,
) -> Result<impl warp::Reply, warp::Rejection> {
    // ─── Step 1: Turn `SessionData` → Bearer token, or reject ───────────────────
    log!(
        LogLevel::Debug,
        "proxy {} {} for session {}",
        method,
        tail.as_str(),
        session.session_id
    );

    let token = get_token(session.clone())
        .await
        .map_err(|err| warp::reject::custom(Whoops(err.err_mesg.to_string())))?;

    // ─── Step 2: Build the full backend URL ────────────────────────────────────
    //    e.g. if `tail.as_str()` is "nodes/42" and raw_query is "limit=5",
    //    we want "https://…/v1/nodes/42?limit=5"
    let mut backend_url = format!("{}{}", get_base_url(), tail.as_str());
    if !raw_query.is_empty() {
        backend_url.push('?');
        backend_url.push_str(&raw_query);
    }

    // ─── Step 3: Convert Warp→Reqwest Method ───────────────────────────────────
    let reqwest_method =
        reqwest::Method::from_bytes(method.as_str().as_bytes())
            .map_err(|e| warp::reject::custom(Whoops(e.to_string())))?;

    // ─── Step 4: Start building the Reqwest request ───────────────────────────
    let client = Client::new();
    let mut req_builder = client
        .request(reqwest_method, &backend_url)
        .bearer_auth(token);

    // ─── Step 5: Forward the request body (if any) ─────────────────────────────
    if !body_bytes.is_empty() {
        // Try JSON first; if that fails, send raw bytes.
        match serde_json::from_slice::<JsonValue>(&body_bytes) {
            Ok(parsed_json) => {
                req_builder = req_builder.json(&parsed_json);
            }
            Err(_) => {
                req_builder = req_builder
                    .body(body_bytes.clone())
                    .header("Content-Type", "application/octet-stream");
            }
        }
    }

    // ─── Step 6: Send to the real backend ──────────────────────────────────────
    let backend_resp = req_builder
        .send()
        .await
        .map_err(|e| warp::reject::custom(Whoops(e.to_string())))?;

    // ─── Step 7: Grab status + content‐type + body bytes ────────────────────────
    //
    // (a) `backend_resp.status()` is a `reqwest::StatusCode`. We need `warp::http::StatusCode`.
    let status_reqwest = backend_resp.status();
    let status_u16 = status_reqwest.as_u16();
    // Convert u16 → warp::http::StatusCode, or fall back to 500 if invalid:
    let status: warp::http::StatusCode = warp::http::StatusCode::from_u16(status_u16)
        .unwrap_or(warp::http::StatusCode::INTERNAL_SERVER_ERROR);

    // (b) Copy the content‐type header so the client sees the same MIME:
    let content_type = backend_resp
        .headers()
        .get("content-type")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("application/octet-stream")
        .to_string();

    // (c) Read the response body as raw bytes:
    let resp_body = backend_resp
        .bytes()
        .await
        .map_err(|e| warp::reject::custom(Whoops(e.to_string())))?;

    // ─── Step 8: Build a full `Response<Body>` and return ───────────────────────
    //
    // Warp will accept a `warp::reply::Response` (alias for `hyper::Response<hyper::Body>`).
    // So we put the bytes into a `hyper::Body`, set the status, and copy the header.
    let mut response = Response::new(Body::from(resp_body));
    *response.status_mut() = status;
    response.headers_mut().insert(
        "content-type",
        HeaderValue::from_str(&content_type).unwrap(),
    );

    log!(LogLevel::Debug, "proxy responded {}", status);

    Ok(response)
}