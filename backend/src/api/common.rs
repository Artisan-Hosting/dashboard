#[derive(Debug)]
#[allow(dead_code)]
pub enum PortalRejection {
    ClipasError(String),
    Unauthorized(String),
    Whoops(String),
    Timeout(String),
    Login,
    Forbidden,
}

impl warp::reject::Reject for PortalRejection {}
