mod api;
mod auth;
mod database;

use api::routes::create_api_routes;
// use api::http::create_api_routes;
use artisan_middleware::dusa_collection_utils::{
    core::logger::{LogLevel, set_log_level},
    log,
};
use database::connection::{get_db_pool, init_db_pool};
mod state;
mod updater;
use api::cookie::load_active_sessions;
use api::common::PortalRejection;
use state::{get_state, init_state};
use std::{convert::Infallible, error::Error, net::SocketAddr, time::Duration};
use tokio::{self, signal, time::timeout};
use updater::spawn_session_refresh;
use warp::{Filter, Reply};

#[tokio::main(flavor = "multi_thread", worker_threads = 8)]
async fn main() -> Result<(), Box<dyn Error>> {
    dotenv::dotenv().ok();
    // —————————————————————
    // Logging / Tracing
    // —————————————————————
    set_log_level(LogLevel::Trace);

    // —————————————————————
    // Initialize Database
    // —————————————————————
    if let Err(e) = init_db_pool().await {
        log!(LogLevel::Error, "FATAL INIT ERROR: {}", e);
        std::process::exit(1);
    }

    if let Err(e) = init_state().await {
        log!(LogLevel::Error, "FATAL STATE INIT ERROR: {}", e);
        std::process::exit(1);
    }

    match load_active_sessions(get_db_pool()).await {
        Ok(sessions) => {
            let count = sessions.len();
            let cache = &get_state().session_cache;
            for s in sessions {
                cache.insert(s.session_id.clone(), s.clone()).await;
                spawn_session_refresh(s);
            }
            log!(LogLevel::Info, "prefilled {} session cache entries", count);
        }
        Err(e) => {
            log!(LogLevel::Warn, "failed to prefill session cache: {}", e);
        }
    }

    // —————————————————————
    // HTTP (Warp) Server
    // —————————————————————

    let out_dir = "/opt/dashboard/frontend/out";

    let static_fs = warp::fs::dir(out_dir);

    let api_routes = create_api_routes().await;

    // Any request under /api that didn't match a real route gets a JSON 404,
    // so API consumers never receive an HTML page back.
    let api_not_found = warp::path("api")
        .and(warp::any())
        .and_then(|| async move {
            Ok::<_, warp::Rejection>(warp::reply::with_status(
                warp::reply::with_header(
                    serde_json::json!({
                        "status": "error",
                        "errors": [{ "message": "not found" }],
                    })
                    .to_string(),
                    "content-type",
                    "application/json",
                ),
                warp::http::StatusCode::NOT_FOUND,
            ))
        });

    // Serve the Next.js `output: 'export'` HTML files. Handles:
    //   - exact page match:            /apps         -> out/apps.html
    //   - dynamic route match:         /apps/<id>    -> out/apps/[id].html
    //   - trailing-slash redirect:     /apps/        -> /apps  (so ./_next assets resolve)
    let try_html_fallback = warp::path::full().and_then(move |full_path: warp::path::FullPath| {
        let out_dir = out_dir.to_string();
        async move {
            let raw = full_path.as_str();
            let trimmed = raw.trim_matches('/');

            if trimmed.is_empty() {
                // root: let static_fs serve out/index.html
                return Err(warp::reject());
            }

            if raw.len() > 1 && raw.ends_with('/') {
                let canonical: warp::http::Uri = format!("/{}", trimmed)
                    .parse()
                    .map_err(|_| warp::reject())?;
                return Ok(warp::redirect::found(canonical).into_response());
            }

            if trimmed.contains('.') {
                // files with extensions are handled by static_fs
                return Err(warp::reject());
            }

            // 1) exact "<page>.html"
            let mut candidate = format!("{}/{}.html", out_dir, trimmed);
            if let Some(reply) = serve_html_from(&candidate).await {
                return Ok(reply);
            }

            // 2) dynamic "<segment>/<id>" -> "<segment>/[id].html"
            let segments: Vec<&str> = trimmed.split('/').collect();
            if segments.len() == 2 && !segments[1].is_empty() {
                candidate = format!("{}/{}/[id].html", out_dir, segments[0]);
                if let Some(reply) = serve_html_from(&candidate).await {
                    return Ok(reply);
                }
            }

            Err(warp::reject())
        }
    });

    let out_dir_for_recover = out_dir.to_string();
    let routes = api_routes
        .or(api_not_found)
        .or(try_html_fallback)
        .or(static_fs)
        .recover(move |rejection: warp::Rejection| {
            let out_dir = out_dir_for_recover.clone();
            async move { handle_rejection(rejection, out_dir).await }
        });

    let http_addr: SocketAddr = "0.0.0.0:3800".parse()?;
    let http_server = tokio::spawn(async move {
        log!(LogLevel::Info, "HTTP server listening on {}", http_addr);
        warp::serve(routes).run(http_addr).await;
        log!(LogLevel::Info, "HTTP server terminated");
    });

    // —————————————————————
    // Wait for shutdown signal
    // —————————————————————
    match signal::ctrl_c().await {
        Ok(_) => {
            log!(
                LogLevel::Info,
                "Shutdown signal received, waiting for servers to stop..."
            );

            match timeout(Duration::from_secs(5), async { tokio::join!(http_server) }).await {
                Ok(http_result) => {
                    if let (Err(e),) = http_result {
                        log!(LogLevel::Error, "HTTP server error: {:?}", e);
                    }
                }
                Err(_) => {
                    log!(
                        LogLevel::Warn,
                        "Timeout reached while waiting for servers to stop."
                    );
                }
            }

            log!(LogLevel::Info, "All servers shut down, exiting.");
            std::process::exit(0);
        }
        Err(err) => {
            log!(LogLevel::Warn, "Dirty Shutdown: {}", err.to_string());
            std::process::exit(0);
        }
    }
}

/// Read and serve `<path>` as text/html. Returns None if the file is missing.
async fn serve_html_from(path: &str) -> Option<warp::reply::Response> {
    let bytes = tokio::fs::read(path).await.ok()?;
    Some(warp::reply::with_header(bytes, "content-type", "text/html").into_response())
}

async fn handle_rejection(
    rejection: warp::Rejection,
    out_dir: String,
) -> Result<warp::reply::Response, Infallible> {
    // Domain-specific errors (auth / proxying) must stay JSON so API
    // consumers never try to parse HTML.
    if let Some(portal_err) = rejection.find::<PortalRejection>() {
        let (status, msg) = match portal_err {
            PortalRejection::Unauthorized(msg) => (401, msg.clone()),
            PortalRejection::Forbidden => (403, "forbidden".to_string()),
            other => (500, format!("{:?}", other)),
        };
        let body = serde_json::json!({
            "status": "error",
            "errors": [{ "message": msg }],
        });
        return Ok(warp::reply::with_status(
            warp::reply::json(&body),
            warp::http::StatusCode::from_u16(status)
                .unwrap_or(warp::http::StatusCode::INTERNAL_SERVER_ERROR),
        )
        .into_response());
    }

    if rejection.is_not_found() {
        if let Ok(bytes) = tokio::fs::read(format!("{}/404.html", out_dir)).await {
            return Ok(warp::reply::with_status(
                warp::reply::with_header(bytes, "content-type", "text/html"),
                warp::http::StatusCode::NOT_FOUND,
            )
            .into_response());
        }
    }

    let body = serde_json::json!({
        "status": "error",
        "errors": [{ "message": "not found" }],
    });
    Ok(warp::reply::with_status(
        warp::reply::json(&body),
        warp::http::StatusCode::NOT_FOUND,
    )
    .into_response())
}
