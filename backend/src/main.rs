mod api;
mod auth;
mod database;
mod grpc;

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
use state::{get_state, init_state};
use std::{error::Error, net::SocketAddr, time::Duration};
use tokio::{self, signal, time::timeout};
use updater::spawn_session_refresh;
use warp::Filter;

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

    let out_dir = "/opt/dashboard/static";

    let static_fs = warp::fs::dir(out_dir);

    let api_routes = create_api_routes().await;

    let try_html_fallback = warp::path::full().and_then(move |full_path: warp::path::FullPath| {
        let out_dir = out_dir.to_string();
        async move {
            let request_path = full_path.as_str().trim_start_matches('/');
            // If the request was exactly “/”, we’ve already got index.html in out_dir, so let static_fs handle it.
            if request_path.is_empty() {
                Err(warp::reject()) // fall through to static_fs → serves out/index.html
            } else {
                // If the request has no “.” in it, try “<request_path>.html”
                if !request_path.contains('.') {
                    let candidate = format!("{}/{}.html", out_dir, request_path);
                    if tokio::fs::metadata(&candidate).await.is_ok() {
                        // Found a “.html” file—serve it explicitly:
                        Ok(warp::reply::with_header(
                            tokio::fs::read(&candidate).await.unwrap(),
                            "content-type",
                            "text/html",
                        ))
                    } else {
                        Err(warp::reject())
                    }
                } else {
                    // If request already has an extension (e.g. “/foo/bar.js”), we don’t rewrite.
                    Err(warp::reject())
                }
            }
        }
    });

    let routes = api_routes.or(try_html_fallback).or(static_fs);

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
