use std::collections::HashMap;
use std::time::{Duration, Instant};

use artisan_middleware::dusa_collection_utils::core::types::rwarc::LockWithTimeout;

/// Builds the proxy cache key exactly as `generic_proxy_handler` does, so every
/// reader/writer of `proxy_cache` (including the background pre-warmer) agrees
/// on the same key for the same request.
pub fn proxy_cache_key(tail: &str, raw_query: &str) -> String {
    format!("{}?{}", tail, raw_query)
}

#[derive(Clone)]
pub struct CachedResponse {
    pub status: u16,
    pub content_type: String,
    pub body: Vec<u8>,
    pub inserted: Instant,
}

pub struct Cache {
    inner: LockWithTimeout<HashMap<String, CachedResponse>>,
}

impl Cache {
    pub fn new() -> Self {
        Self {
            inner: LockWithTimeout::new(HashMap::new()),
        }
    }

    pub async fn get(&self, key: &str, ttl: Duration) -> Option<CachedResponse> {
        let guard = self.inner.try_read().await.ok()?;
        guard
            .get(key)
            .filter(|c| c.inserted.elapsed() < ttl)
            .cloned()
    }

    pub async fn insert(&self, key: String, resp: CachedResponse) {
        if let Ok(mut guard) = self.inner.try_write().await {
            guard.insert(key, resp);
        }
    }
}

use crate::api::cookie::SessionData;

#[derive(Clone)]
pub struct CachedSession {
    pub data: SessionData,
    pub inserted: Instant,
}

pub struct SessionCache {
    inner: LockWithTimeout<HashMap<String, CachedSession>>,
}

impl SessionCache {
    pub fn new() -> Self {
        Self {
            inner: LockWithTimeout::new(HashMap::new()),
        }
    }

    pub async fn get(&self, key: &str, ttl: Duration) -> Option<SessionData> {
        let guard = self.inner.try_read().await.ok()?;
        guard
            .get(key)
            .filter(|c| c.inserted.elapsed() < ttl)
            .map(|c| c.data.clone())
    }

    pub async fn insert(&self, key: String, data: SessionData) {
        if let Ok(mut guard) = self.inner.try_write().await {
            guard.insert(
                key,
                CachedSession {
                    data,
                    inserted: Instant::now(),
                },
            );
        }
    }

    pub async fn remove(&self, key: &str) {
        if let Ok(mut guard) = self.inner.try_write().await {
            guard.remove(key);
        }
    }

    pub async fn remove_user(&self, user_id: &str) {
        if let Ok(mut guard) = self.inner.try_write().await {
            guard.retain(|_, v| v.data.user_id != user_id);
        }
    }
}
