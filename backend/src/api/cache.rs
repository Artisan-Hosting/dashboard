use std::collections::HashMap;
use std::time::{Duration, Instant};

use artisan_middleware::dusa_collection_utils::core::types::rwarc::LockWithTimeout;
use once_cell::sync::Lazy;

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

pub static PROXY_CACHE: Lazy<Cache> = Lazy::new(|| Cache::new());
