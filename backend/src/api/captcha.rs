//! Bot protection for public signup: Cap (https://trycap.dev), the self-hosted
//! proof-of-work captcha the fleet's websites already use.
//!
//! It lives **here**, in the dashboard backend, on purpose: the backend is the
//! only caller allowed to reach `ais_auth`'s signup paths from outside (the
//! reverse proxy on the API host allow-lists them to the dashboard -- see
//! docs/operations/SIGNUP_GATING.md), so checking once here covers every way in,
//! and the Cap secret stays off the auth host.
//!
//! Contract (the same one `artisan_webserver` uses): the browser widget hands
//! back a single-use token; we POST JSON `{secret, response: token}` to
//! `<endpoint>/siteverify` and read `{success: bool}`. `CAPTCHA_API_ENDPOINT` is
//! the instance's site path (`https://cap.example.com/<site-key>/`) and
//! `CAPTCHA_SECRET_KEY` its secret. Either unset turns captcha off.
//!
//! A captcha that cannot be reached must not become a captcha that is off, so
//! that case fails closed ([`CaptchaFailure::Unavailable`]).

use serde::Deserialize;
use std::time::Duration;
use warp::http::StatusCode;

#[derive(Clone, Debug)]
pub struct Captcha {
    endpoint: String,
    secret: String,
}

#[derive(Debug, PartialEq, Eq)]
pub enum CaptchaFailure {
    /// A captcha is required and no token came with the request.
    Missing,
    /// Cap looked at the token and said no.
    Rejected,
    /// Cap could not be asked.
    Unavailable,
}

impl CaptchaFailure {
    pub fn status(&self) -> StatusCode {
        match self {
            CaptchaFailure::Missing | CaptchaFailure::Rejected => StatusCode::BAD_REQUEST,
            CaptchaFailure::Unavailable => StatusCode::SERVICE_UNAVAILABLE,
        }
    }

    /// Written for the person filling in the form.
    pub fn message(&self) -> &'static str {
        match self {
            CaptchaFailure::Missing => "Complete the check below first.",
            CaptchaFailure::Rejected => "The check did not pass. Try it again.",
            CaptchaFailure::Unavailable => "The check is unavailable right now. Please try again in a moment.",
        }
    }
}

impl Captcha {
    pub fn new(endpoint: &str, secret: &str) -> Option<Self> {
        let (endpoint, secret) = (endpoint.trim(), secret.trim());
        (!endpoint.is_empty() && !secret.is_empty())
            .then(|| Self { endpoint: endpoint.trim_end_matches('/').to_owned(), secret: secret.to_owned() })
    }

    pub fn from_env() -> Option<Self> {
        Self::new(
            &std::env::var("CAPTCHA_API_ENDPOINT").unwrap_or_default(),
            &std::env::var("CAPTCHA_SECRET_KEY").unwrap_or_default(),
        )
    }

    /// What the signup page needs: whether to show the widget and where it
    /// should talk. Only the public endpoint -- never the secret.
    pub fn public_config(captcha: Option<&Captcha>) -> (bool, String) {
        match captcha {
            Some(c) => (true, format!("{}/", c.endpoint)),
            None => (false, String::new()),
        }
    }

    async fn verify(&self, client: &reqwest::Client, token: &str) -> Result<bool, String> {
        #[derive(Deserialize)]
        struct Answer {
            success: bool,
        }
        // The answer to a rejected token is a 4xx with `{"success": false}`, so
        // the status is deliberately not checked -- only whether the body reads.
        let answer: Answer = client
            .post(format!("{}/siteverify", self.endpoint))
            .timeout(Duration::from_secs(5))
            .json(&serde_json::json!({ "secret": self.secret, "response": token }))
            .send()
            .await
            .map_err(|e| e.to_string())?
            .json()
            .await
            .map_err(|e| e.to_string())?;
        Ok(answer.success)
    }
}

/// `Ok(())` when no captcha is configured or the token passes.
pub async fn check(captcha: Option<&Captcha>, client: &reqwest::Client, token: &str) -> Result<(), CaptchaFailure> {
    let Some(captcha) = captcha else { return Ok(()) };
    let token = token.trim();
    if token.is_empty() {
        return Err(CaptchaFailure::Missing);
    }
    match captcha.verify(client, token).await {
        Ok(true) => Ok(()),
        Ok(false) => Err(CaptchaFailure::Rejected),
        Err(_) => Err(CaptchaFailure::Unavailable),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::io::{AsyncReadExt, AsyncWriteExt};
    use tokio::net::TcpListener;

    /// A stand-in Cap instance answering every request with `status` and `body`.
    async fn fake_cap(status: u16, body: &'static str) -> (String, tokio::sync::mpsc::UnboundedReceiver<String>) {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let base = format!("http://{}/site-key/", listener.local_addr().unwrap());
        let (tx, rx) = tokio::sync::mpsc::unbounded_channel();
        tokio::spawn(async move {
            loop {
                let (mut socket, _) = listener.accept().await.unwrap();
                let mut buf = vec![0u8; 8192];
                let n = socket.read(&mut buf).await.unwrap_or(0);
                let _ = tx.send(String::from_utf8_lossy(&buf[..n]).into_owned());
                let reply = format!(
                    "HTTP/1.1 {status} status\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{body}",
                    body.len()
                );
                let _ = socket.write_all(reply.as_bytes()).await;
                let _ = socket.shutdown().await;
            }
        });
        (base, rx)
    }

    fn client() -> reqwest::Client {
        reqwest::Client::new()
    }

    #[tokio::test]
    async fn no_captcha_configured_means_no_check() {
        assert_eq!(check(None, &client(), "").await, Ok(()));
    }

    #[tokio::test]
    async fn a_configured_captcha_requires_a_token() {
        let cap = Captcha::new("http://127.0.0.1:1/site/", "secret").unwrap();
        assert_eq!(check(Some(&cap), &client(), "  ").await, Err(CaptchaFailure::Missing));
    }

    #[tokio::test]
    async fn a_good_token_passes_and_cap_is_asked_with_the_secret_and_token() {
        let (base, mut seen) = fake_cap(200, r#"{"success":true}"#).await;
        let cap = Captcha::new(&base, "s3cret").unwrap();
        assert_eq!(check(Some(&cap), &client(), "tok-1").await, Ok(()));
        let request = seen.recv().await.unwrap();
        assert!(request.starts_with("POST /site-key/siteverify"), "{request}");
        let body = request.split("\r\n\r\n").nth(1).unwrap_or_default();
        let json: serde_json::Value = serde_json::from_str(body).unwrap();
        assert_eq!((json["secret"].as_str(), json["response"].as_str()), (Some("s3cret"), Some("tok-1")));
    }

    #[tokio::test]
    async fn a_rejected_token_is_rejected_even_when_cap_answers_with_a_4xx() {
        // What the real instance does with a bad token.
        let (base, _seen) = fake_cap(400, r#"{"success":false,"error":"Missing required parameters"}"#).await;
        let cap = Captcha::new(&base, "s").unwrap();
        assert_eq!(check(Some(&cap), &client(), "bad").await, Err(CaptchaFailure::Rejected));
    }

    #[tokio::test]
    async fn an_unreachable_cap_fails_closed_not_open() {
        let cap = Captcha::new("http://127.0.0.1:1/site/", "s").unwrap();
        assert_eq!(check(Some(&cap), &client(), "tok").await, Err(CaptchaFailure::Unavailable));
    }

    #[tokio::test]
    async fn an_unreadable_answer_also_fails_closed() {
        let (base, _seen) = fake_cap(200, "not json").await;
        let cap = Captcha::new(&base, "s").unwrap();
        assert_eq!(check(Some(&cap), &client(), "tok").await, Err(CaptchaFailure::Unavailable));
    }

    #[test]
    fn captcha_is_off_unless_both_settings_are_present() {
        assert!(Captcha::new("", "s").is_none());
        assert!(Captcha::new("https://cap.example/site/", "").is_none());
        assert!(Captcha::new("https://cap.example/site/", " s ").is_some());
    }

    #[test]
    fn the_public_config_never_includes_the_secret_and_keeps_the_trailing_slash() {
        let cap = Captcha::new("https://cap.example/key", "TOP-SECRET");
        let (enabled, endpoint) = Captcha::public_config(cap.as_ref());
        assert!(enabled);
        assert_eq!(endpoint, "https://cap.example/key/");
        assert!(!endpoint.contains("TOP-SECRET"));
        assert_eq!(Captcha::public_config(None), (false, String::new()));
    }

    #[test]
    fn failures_map_to_the_right_status() {
        assert_eq!(CaptchaFailure::Missing.status(), StatusCode::BAD_REQUEST);
        assert_eq!(CaptchaFailure::Rejected.status(), StatusCode::BAD_REQUEST);
        assert_eq!(CaptchaFailure::Unavailable.status(), StatusCode::SERVICE_UNAVAILABLE);
    }
}
