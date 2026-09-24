use crate::{
    api::{common::PortalRejection::Whoops, helper::with_session},
    grpc::secret_service,
    state::get_state,
};
use artisan_middleware::dusa_collection_utils::{core::logger::LogLevel, log};
use serde::Deserialize;
use warp::Filter;

#[derive(Deserialize)]
pub struct SecretQuery {
    pub runner_id: String,
    pub environment_id: String,
    pub version: Option<i64>,
}

pub fn secret_routes() -> impl Filter<Extract = impl warp::Reply, Error = warp::Rejection> + Clone {
    let list = warp::get()
        .and(warp::path!("secrets" / "list"))
        .and(warp::query::<SecretQuery>())
        .and(with_session())
        .and_then(list_handler);

    let create = warp::post()
        .and(warp::path!("secrets" / "create"))
        .and(warp::body::json::<secret_service::CreateSecretRequest>())
        .and(with_session())
        .and_then(create_handler);

    let update = warp::put()
        .and(warp::path!("secrets" / "update"))
        .and(warp::body::json::<secret_service::UpdateSecretRequest>())
        .and(with_session())
        .and_then(update_handler);

    let delete = warp::delete()
        .and(warp::path!("secrets" / "delete"))
        .and(warp::body::json::<secret_service::DeleteSecretRequest>())
        .and(with_session())
        .and_then(delete_handler);

    list.or(create).or(update).or(delete)
}

async fn list_handler(
    query: SecretQuery,
    session: crate::api::cookie::SessionData,
) -> Result<impl warp::Reply, warp::Rejection> {
    log!(
        LogLevel::Debug,
        "list secrets session {}",
        session.session_id
    );
    let mut client = get_state().secret_client.clone();
    let req = secret_service::GetAllSecretsRequest {
        runner_id: query.runner_id,
        environment_id: query.environment_id,
        version: query.version.unwrap_or_default(),
    };
    match client.get_all_secrets(req).await {
        Ok(resp) => {
            log!(
                LogLevel::Info,
                "list secrets success session {}",
                session.session_id
            );
            Ok(warp::reply::json(&resp))
        }
        Err(e) => {
            log!(
                LogLevel::Error,
                "list secrets failed for {}: {}",
                session.session_id,
                e
            );
            Err(warp::reject::custom(Whoops(e.to_string())))
        }
    }
}

async fn create_handler(
    req: secret_service::CreateSecretRequest,
    session: crate::api::cookie::SessionData,
) -> Result<impl warp::Reply, warp::Rejection> {
    log!(
        LogLevel::Debug,
        "create secret {} session {}",
        req.secret_key,
        session.session_id
    );
    let mut client = get_state().secret_client.clone();
    match client.create_secret(req).await {
        Ok(resp) => {
            log!(
                LogLevel::Info,
                "create secret success session {}",
                session.session_id
            );
            Ok(warp::reply::json(&resp))
        }
        Err(e) => {
            log!(
                LogLevel::Error,
                "create secret failed for {}: {}",
                session.session_id,
                e
            );
            Err(warp::reject::custom(Whoops(e.to_string())))
        }
    }
}

async fn update_handler(
    req: secret_service::UpdateSecretRequest,
    session: crate::api::cookie::SessionData,
) -> Result<impl warp::Reply, warp::Rejection> {
    log!(
        LogLevel::Debug,
        "update secret {} session {}",
        req.secret_key,
        session.session_id
    );
    let mut client = get_state().secret_client.clone();
    match client.update_secret(req).await {
        Ok(resp) => {
            log!(
                LogLevel::Info,
                "update secret success session {}",
                session.session_id
            );
            Ok(warp::reply::json(&resp))
        }
        Err(e) => {
            log!(
                LogLevel::Error,
                "update secret failed for {}: {}",
                session.session_id,
                e
            );
            Err(warp::reject::custom(Whoops(e.to_string())))
        }
    }
}

async fn delete_handler(
    req: secret_service::DeleteSecretRequest,
    session: crate::api::cookie::SessionData,
) -> Result<impl warp::Reply, warp::Rejection> {
    log!(
        LogLevel::Debug,
        "delete secret {} session {}",
        req.secret_key,
        session.session_id
    );
    let mut client = get_state().secret_client.clone();
    match client.delete_secret(req).await {
        Ok(resp) => {
            log!(
                LogLevel::Info,
                "delete secret success session {}",
                session.session_id
            );
            Ok(warp::reply::json(&resp))
        }
        Err(e) => {
            log!(
                LogLevel::Error,
                "delete secret failed for {}: {}",
                session.session_id,
                e
            );
            Err(warp::reject::custom(Whoops(e.to_string())))
        }
    }
}
