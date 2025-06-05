use artisan_middleware::api::token::SimpleLoginRequest;
use warp::{Filter, http::header, reject::Rejection, reply::Reply};

use crate::api::handler::{generic_proxy_handler, me_handler, runners_handler};
use crate::api::secret::secret_routes;

use super::{
    handler::{login_handler, logout_handler, whoami_handler},
    helper::with_session,
};

pub async fn create_api_routes() -> impl Filter<Extract = impl Reply, Error = Rejection> + Clone {
    let testing_origin = "http://localhost:3800";
    let deveing_origin = "http://localhost:3000";

    let cors = warp::cors()
        .allow_origin(testing_origin)
        .allow_origin(deveing_origin)
        .allow_methods(vec!["GET", "POST", "PUT", "DELETE", "OPTIONS"])
        .allow_headers(vec![
            header::CONTENT_TYPE,
            header::COOKIE,
            header::AUTHORIZATION,
        ])
        .allow_credentials(true);

    // let v1_preflight = warp::options()
    //     .and(warp::path("api"))
    //     .and(warp::path::tail()) // match the rest of the path
    //     .map(|_| warp::reply());

    // login
    let login = warp::post()
        .and(warp::path!("auth" / "login"))
        .and(warp::body::json::<SimpleLoginRequest>())
        .and_then(login_handler);

    // login
    let logout = warp::post()
        .and(warp::path!("auth" / "logout"))
        .and(with_session())
        .and_then(logout_handler);

    let whoami = warp::get()
        .and(warp::path!("auth" / "whoami"))
        .and(with_session())
        .and_then(whoami_handler);

    let me = warp::get()
        .and(warp::path!("auth" / "me"))
        .and(with_session())
        .and_then(me_handler);

    let runners = warp::get()
        .and(warp::path!("runners"))
        .and(with_session())
        .and_then(runners_handler);

    let proxy_route = warp::path("proxy")
        // .and(warp::path("proxy"))
        .and(warp::path::tail())
        .and(warp::method())
        .and(warp::query::raw().or_else(|_| async { Ok::<_, warp::Rejection>((String::new(),)) }))
        .and(warp::body::bytes().or_else(|_| async { Ok::<_, warp::Rejection>((bytes::Bytes::new(),)) }))
        .and(with_session())
        .and_then(generic_proxy_handler);
    // // refresh tokens
    // // An expired token needs to be provided
    // let refresh = warp::post()
    //     .and(warp::path!("auth" / "refresh"))
    //     .and(warp::body::json::<RefreshRequest>())
    //     .and_then(refresh_handler);

    // // me
    // let me = warp::get()
    //     .and(warp::path!("account" / "me"))
    //     .and(with_auth().await)
    //     .and_then(me_handler);

    // // update pretty name
    // let set_pretty = warp::put()
    //     .and(warp::path!("account" / "pretty_name" / "set"))
    //     .and(with_auth().await)
    //     .and(warp::body::json::<UpdatePrettyName>())
    //     .and_then(set_pretty_name_handler);

    // // get pretty name
    // let get_pretty = warp::put()
    //     .and(warp::path!("account" / "pretty_name" / "get" / String))
    //     .and(with_auth().await)
    //     .and_then(get_pretty_name_handler);

    // // update email
    // let update_email = warp::put()
    //     .and(warp::path!("account" / "email"))
    //     .and(with_auth().await)
    //     .and(warp::body::json::<UpdateEmail>())
    //     .and_then(update_email_handler);

    // // change password
    // let change_password = warp::put()
    //     .and(warp::path!("account" / "password"))
    //     .and(with_auth().await)
    //     .and(warp::body::json::<UpdatePassword>())
    //     .and_then(change_password_handler);

    // // password reset request
    // let pw_reset_req = warp::post()
    //     .and(warp::path!("auth" / "password-reset" / "request"))
    //     .and(warp::body::json::<ResetPasswordRequest>())
    //     .and_then(password_reset_request_handler);

    // // password reset confirm
    // let pw_reset_conf = warp::post()
    //     .and(warp::path!("auth" / "password-reset" / "confirm"))
    //     .and(warp::body::json::<ResetPasswordResponse>())
    //     .and_then(password_reset_confirm_handler);

    warp::path("api")
        .and(
            login
                .or(logout)
                .or(whoami)
                .or(runners)
                .or(proxy_route)
                .or(me)
                .or(secret_routes()), // .or(get_pretty)
                         // .or(set_pretty)
                         // .or(update_email)
                         // .or(change_password)
                         // .or(pw_reset_req)
                         // .or(pw_reset_conf),
        )
        // .or(v1_preflight)
        .with(cors)
    // .or(email_conf_req)
    // .or(email_conf_cmp)
    // .or(admin_create)
    // .or(admin_list)
    // .or(admin_get)
    // .or(admin_update)
    // .or(admin_delete)
    // .recover(handle_rejection)
}
