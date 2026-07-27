/**
 * The Rust (Axum) backend is spawned by the Tauri process on app startup and
 * listens on a fixed localhost port -- see src-tauri/src/server.rs. It is
 * never exposed outside the local machine's loopback interface.
 *
 * Kept as a single constant so the Tauri shell and the frontend agree on it.
 */
export const API_PORT = 47932
export const API_BASE_URL = `http://127.0.0.1:${API_PORT}/api`
