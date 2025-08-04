// Base URL for the Rust backend proxy
// Frontend should only call this service; the Rust backend in turn
// contacts the upstream https://api.artisanhosting.net/v1 API.
// Includes the `/api` prefix expected by the Rust server.
export const BACKEND_URL = "http://localhost:3800/api";
