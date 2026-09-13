use crate::api::cache::{proxy_cache_key, CachedResponse};
use crate::state::get_state;
use crate::updater::spawn_session_refresh;
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
use serde::Deserialize;
use serde_json::Value as JsonValue;
use std::time::{Duration, Instant};
use warp::hyper::Body;
use warp::{
    http::header::{HeaderValue, SET_COOKIE},
    reply::Response,
};

use super::cookie::{SessionData, accept_invite, login};

#[derive(Debug, Deserialize)]
pub struct ResetPasswordRequest {
    pub email: String,
}

#[derive(Debug, Deserialize)]
pub struct ResetPasswordResponse {
    pub password: String,
    pub password_token: String,
}

/// Copies an upstream `ais_auth` response (status, content-type, body)
/// straight through to the dashboard frontend, the same way
/// `generic_proxy_handler` does for the proxy route below. Used for the two
/// password-reset endpoints, which are unauthenticated (no session cookie
/// yet) so they don't go through that proxy.
async fn forward_response(resp: reqwest::Response) -> Result<Response, warp::Rejection> {
    let status = warp::http::StatusCode::from_u16(resp.status().as_u16())
        .unwrap_or(warp::http::StatusCode::INTERNAL_SERVER_ERROR);
    let content_type = resp
        .headers()
        .get("content-type")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("text/plain; charset=utf-8")
        .to_string();
    let body = resp
        .bytes()
        .await
        .map_err(|e| warp::reject::custom(Whoops(e.to_string())))?;

    let mut response = Response::new(Body::from(body));
    *response.status_mut() = status;
    response.headers_mut().insert(
        "content-type",
        HeaderValue::from_str(&content_type).unwrap(),
    );
    Ok(response)
}

/// Kicks off a password reset: forwards `{email}` to `ais_auth`, which emails
/// a reset link if the address has an account. Always returns whatever
/// generic acknowledgement `ais_auth` sends back (it deliberately looks the
/// same whether or not the address exists), so this handler doesn't need to
/// know or care -- it's a pure pass-through, unauthenticated like `login`.
pub async fn password_reset_request_handler(
    req: ResetPasswordRequest,
) -> Result<impl warp::Reply, warp::Rejection> {
    log!(
        LogLevel::Debug,
        "password_reset_request_handler for {}",
        req.email
    );
    let client = get_state().http_client.clone();

    let response = client
        .post(&format!("{}auth/password-reset/request", get_base_url()))
        .json(&serde_json::json!({ "email": req.email }))
        .send()
        .await
        .map_err(|e| warp::reject::custom(Whoops(e.to_string())))?;

    forward_response(response).await
}

/// Completes a password reset: forwards the reset token (from the emailed
/// link) and the new password to `ais_auth`, which validates the token and
/// updates the password. Also unauthenticated -- the token itself is the
/// credential here, same as `login`.
pub async fn password_reset_confirm_handler(
    req: ResetPasswordResponse,
) -> Result<impl warp::Reply, warp::Rejection> {
    log!(LogLevel::Debug, "password_reset_confirm_handler called");
    let client = get_state().http_client.clone();

    let response = client
        .post(&format!("{}auth/password-reset/confirm", get_base_url()))
        .json(&serde_json::json!({
            "password_token": req.password_token,
            "password": req.password,
        }))
        .send()
        .await
        .map_err(|e| warp::reject::custom(Whoops(e.to_string())))?;

    forward_response(response).await
}

pub async fn login_handler(
    login_data: SimpleLoginRequest,
) -> Result<impl warp::Reply, warp::Rejection> {
    log!(
        LogLevel::Debug,
        "login_handler called for {}",
        login_data.email
    );
    match login(login_data).await {
        Ok(session) => finish_session(session, "Logged in").await,
        Err(err) => Err(warp::reject::custom(Whoops(err))),
    }
}

#[derive(Debug, Deserialize)]
pub struct AcceptInviteRequest {
    pub token: String,
    pub display_name: String,
    pub password: String,
}

/// Accepting an invite creates the account *and* logs it in, in one step --
/// no separate login round trip needed afterward. Shares its session-setup
/// tail with `login_handler` via `finish_session`.
pub async fn accept_invite_handler(
    req: AcceptInviteRequest,
) -> Result<impl warp::Reply, warp::Rejection> {
    log!(LogLevel::Debug, "accept_invite_handler called");
    match accept_invite(req.token, req.display_name, req.password).await {
        Ok(session) => finish_session(session, "Account created").await,
        Err(err) => Err(warp::reject::custom(Whoops(err))),
    }
}

/// Shared tail of `login_handler`/`accept_invite_handler`: persist the
/// session, warm the in-memory cache, schedule its background refresh, and
/// set the `session_id` cookie. `verb` only changes the human-readable body
/// text ("Logged in as..." vs "Account created for...").
async fn finish_session(
    session: SessionData,
    verb: &str,
) -> Result<impl warp::Reply, warp::Rejection> {
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
        log!(
            LogLevel::Error,
            "DB insert error for {}: {}",
            session.session_id,
            e
        );
        warp::reject::custom(Whoops(e.to_string()))
    })?;

    get_state()
        .session_cache
        .insert(session.session_id.clone(), session.clone())
        .await;
    spawn_session_refresh(session.clone());

    #[allow(deprecated)]
    let cookie = CookieBuilder::new("session_id", session.session_id.clone())
        .http_only(true)
        .path("/")
        .secure(true)
        .finish();

    let set_cookie_header = cookie.to_string();

    let header_value = HeaderValue::from_str(&set_cookie_header)
        .expect("cookie.to_string() returned invalid header‐value");

    log!(
        LogLevel::Debug,
        "session {} inserted in DB",
        session.session_id
    );

    let body = format!("{} as {}.", verb, session.user_id);
    let reply = warp::reply::with_header(body, SET_COOKIE, header_value);

    Ok(reply)
}

pub async fn logout_handler(session: SessionData) -> Result<impl warp::Reply, warp::Rejection> {
    log!(LogLevel::Info, "logout for session {}", session.session_id);
    // Delete the row (if it exists):
    if let Err(e) = sqlx::query("DELETE FROM sessions WHERE session_id = ?")
        .bind(&session.session_id)
        .execute(get_db_pool())
        .await
    {
        log!(LogLevel::Error, "Error deleting session from DB: {}", e);
        // don't send an error so the frontend still clears the cookie
    }

    get_state().session_cache.remove(&session.session_id).await;

    // Build a “clear cookie”:
    #[allow(deprecated)]
    let clear = cookie::Cookie::build("session_id")
        .max_age(cookie::time::Duration::seconds(0))
        .path("/")
        .http_only(true)
        .secure(true)
        .finish();

    let set_clear_header = clear.to_string();

    let header_value = HeaderValue::from_str(&set_clear_header)
        .expect("clear.to_string() returned invalid header‐value");

    let reply = warp::reply::with_header("", SET_COOKIE, header_value);
    log!(LogLevel::Debug, "session {} logged out", session.session_id);
    Ok(reply)
}

pub async fn logout_all_handler(session: SessionData) -> Result<impl warp::Reply, warp::Rejection> {
    log!(LogLevel::Info, "logout all for user {}", session.user_id);
    if let Err(e) = sqlx::query("DELETE FROM sessions WHERE user_id = ?")
        .bind(&session.user_id)
        .execute(get_db_pool())
        .await
    {
        log!(LogLevel::Error, "Error deleting sessions from DB: {}", e);
    }

    get_state()
        .session_cache
        .remove_user(&session.user_id)
        .await;

    let clear = cookie::Cookie::build("session_id")
        .max_age(cookie::time::Duration::seconds(0))
        .path("/")
        .http_only(true)
        .secure(true);

    let header_value = HeaderValue::from_str(&clear.to_string())
        .expect("clear.to_string() returned invalid header‐value");

    let reply = warp::reply::with_header("", SET_COOKIE, header_value);
    log!(
        LogLevel::Debug,
        "all sessions logged out for {}",
        session.user_id
    );
    Ok(reply)
}

pub async fn whoami_handler(session: SessionData) -> Result<impl warp::Reply, warp::Rejection> {
    log!(LogLevel::Debug, "whoami for session {}", session.session_id);
    match get_token(session.clone()).await {
        Ok(token) => {
            let client = get_state().http_client.clone();

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
                    log!(
                        LogLevel::Warn,
                        "Failed to get user ID for session {}",
                        session.session_id
                    );
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
                    let expires = data.get("expires").and_then(|v| v.as_u64()).unwrap_or(30);
                    let reply = warp::reply::json(
                        &serde_json::json!({ "user_id": username, "expires": expires}),
                    );
                    log!(
                        LogLevel::Info,
                        "whoami success session {}",
                        session.session_id
                    );
                    Ok(reply)
                } else {
                    log!(
                        LogLevel::Warn,
                        "whoami missing data for session {}",
                        session.session_id
                    );
                    Err(warp::reject::custom(Whoops(
                        "Failed to get the username".to_string(),
                    )))
                }
            } else {
                log!(
                    LogLevel::Warn,
                    "whoami bad status for session {}",
                    session.session_id
                );
                Err(warp::reject::custom(Whoops(
                    "Failed to de-serialize the servers response".to_string(),
                )))
            }
        }
        Err(err) => Err(warp::reject::custom(Whoops(err.err_mesg.to_string()))),
    }
}

pub async fn me_handler(session: SessionData) -> Result<impl warp::Reply, warp::Rejection> {
    log!(
        LogLevel::Debug,
        "me_handler for session {}",
        session.session_id
    );
    match get_token(session.clone()).await {
        Ok(token) => {
            let client = get_state().http_client.clone();

            // `account/me` and `whoami` are independent given the token, so
            // run them concurrently instead of paying two sequential upstream
            // round trips.
            let me_fut = client
                .get(&format!("{}account/me", get_base_url()))
                .bearer_auth(token.clone())
                .send();
            let role_fut = client
                .post(&format!("{}whoami", get_base_url()))
                .bearer_auth(token)
                .send();
            let (me_result, role_result) = tokio::join!(me_fut, role_fut);

            let response_me = me_result.map_err(|e| warp::reject::custom(Whoops(e.to_string())))?;

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

            // Role/org_id are best-effort: a hiccup here shouldn't fail the
            // whole `/auth/me` call, since username/email are still useful
            // without them.
            let (role, org_id) = match role_result {
                Ok(resp) if resp.status().is_success() => {
                    let json: serde_json::Value = resp.json().await.unwrap_or_default();
                    let you = json.get("you");
                    let role = you
                        .and_then(|v| v.get("roles"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("none")
                        .to_string();
                    let org_id = you
                        .and_then(|v| v.get("org_id"))
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string();
                    (role, org_id)
                }
                _ => ("none".to_string(), String::new()),
            };

            let reply = warp::reply::json(&serde_json::json!({
                "user_id": username,
                "email": email,
                "role": role,
                "org_id": org_id,
            }));
            log!(LogLevel::Info, "me success session {}", session.session_id);
            Ok(reply)
        }
        Err(err) => Err(warp::reject::custom(Whoops(err.err_mesg.to_string()))),
    }
}

pub async fn runners_handler(session: SessionData) -> Result<impl warp::Reply, warp::Rejection> {
    log!(
        LogLevel::Debug,
        "runners_handler for session {}",
        session.session_id
    );
    match get_token(session.clone()).await {
        Ok(token) => {
            let client = get_state().http_client.clone();

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

                log!(
                    LogLevel::Info,
                    "runners success session {}",
                    session.session_id
                );
                Ok(warp::reply::json(&api_response))
            } else {
                log!(
                    LogLevel::Warn,
                    "runners failed status for {}",
                    session.session_id
                );
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

    const TTL_SHORT: Duration = Duration::from_secs(5);
    const TTL_LONG: Duration = Duration::from_secs(30);
    let cache_key = proxy_cache_key(tail.as_str(), &raw_query);
    let is_vm = tail.as_str().starts_with("vms") && !tail.as_str().contains("status");
    // "runner" (not just "runners") also matches the singular `runner/{name}`
    // detail route, which is just as expensive on the portal side as the list.
    let is_runner = tail.as_str().starts_with("runner");
    let is_usage = tail.as_str().starts_with("usage");
    let is_logs = tail.as_str().starts_with("logs");

    if method == warp::http::Method::GET && (is_runner || is_usage || is_logs) {
        let ttl = if is_usage || is_logs || is_runner {
            TTL_LONG
        } else {
            TTL_SHORT
        };
        if let Some(cached) = get_state().proxy_cache.get(&cache_key, ttl).await {
            log!(LogLevel::Debug, "proxy cache hit {}", cache_key);
            let mut resp = Response::new(Body::from(cached.body));
            *resp.status_mut() = warp::http::StatusCode::from_u16(cached.status)
                .unwrap_or(warp::http::StatusCode::OK);
            resp.headers_mut().insert(
                "content-type",
                HeaderValue::from_str(&cached.content_type).unwrap(),
            );
            return Ok(resp);
        } else {
            log!(LogLevel::Warn, "Cache Miss");
        }
    }

    // ─── Step 3: Convert Warp→Reqwest Method ───────────────────────────────────
    let reqwest_method = reqwest::Method::from_bytes(method.as_str().as_bytes())
        .map_err(|e| warp::reject::custom(Whoops(e.to_string())))?;

    // ─── Step 4: Start building the Reqwest request ───────────────────────────
    let client = get_state().http_client.clone();
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
    log!(LogLevel::Debug, "proxy dispatch {}", backend_url);
    let upstream_start = Instant::now();
    let backend_resp = req_builder.send().await.map_err(|e| {
        log!(
            LogLevel::Warn,
            "proxy upstream error after {:?} for {}: {}",
            upstream_start.elapsed(),
            backend_url,
            e
        );
        warp::reject::custom(Whoops(e.to_string()))
    })?;
    log!(
        LogLevel::Info,
        "proxy upstream responded in {:?} for {}",
        upstream_start.elapsed(),
        backend_url
    );

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
    let resp_body_vec = resp_body.clone().to_vec();

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

    if !status.is_success() {
        log!(
            LogLevel::Warn,
            "proxy {} returned status {}",
            backend_url,
            status
        );
    } else {
        log!(LogLevel::Debug, "proxy responded {}", status);
        if method == warp::http::Method::GET && (is_vm || is_runner || is_usage || is_logs) {
            get_state()
                .proxy_cache
                .insert(
                    cache_key,
                    CachedResponse {
                        status: status.as_u16(),
                        content_type: content_type.clone(),
                        body: resp_body_vec,
                        inserted: Instant::now(),
                    },
                )
                .await;
        }
    }

    Ok(response)
}
