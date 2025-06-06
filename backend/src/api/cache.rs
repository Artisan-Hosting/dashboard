use std::collections::HashMap;
use std::time::{Duration, Instant};

use artisan_middleware::dusa_collection_utils::core::types::rwarc::LockWithTimeout;
use once_cell::sync::Lazy;

use super::cookie::SessionData;

#[derive(Clone)]
pub struct CachedResponse {
    pub status: u16,
    pub content_type: String,
    pub body: Vec<u8>,
}

#[derive(Clone)]
pub struct CachedEntry<T> {
    pub value: T,
    pub inserted: Instant,
}

pub struct Cache<T> {
    inner: LockWithTimeout<HashMap<String, CachedEntry<T>>>,
}

impl<T: Clone> Cache<T> {
    pub fn new() -> Self {
        Self {
            inner: LockWithTimeout::new(HashMap::new()),
        }
    }

    pub async fn get(&self, key: &str, ttl: Duration) -> Option<T> {
        let guard = self.inner.try_read().await.ok()?;
        guard
            .get(key)
            .filter(|c| c.inserted.elapsed() < ttl)
            .map(|c| c.value.clone())
    }

    pub async fn insert(&self, key: String, val: T) {
        if let Ok(mut guard) = self.inner.try_write().await {
            guard.insert(
                key,
                CachedEntry {
                    value: val,
                    inserted: Instant::now(),
                },
            );
        }
    }
}

pub static PROXY_CACHE: Lazy<Cache<CachedResponse>> = Lazy::new(|| Cache::new());
pub static SESSION_CACHE: Lazy<Cache<SessionData>> = Lazy::new(|| Cache::new());
