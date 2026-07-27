use crate::error::{ApiError, ApiResult};
use crate::extractors::CurrentUser;
use crate::state::AppState;
use axum::{extract::State, routing::post, Json, Router};
use erp_core::entities::user;
use erp_core::services::auth_service;
use erp_core::AppError;
use sea_orm::EntityTrait;
use serde::{Deserialize, Serialize};

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/auth/login", post(login))
        .route("/auth/me", axum::routing::get(me))
}

#[derive(Deserialize)]
struct LoginRequest {
    username: String,
    password: String,
}

#[derive(Serialize)]
struct UserResponse {
    id: String,
    username: String,
    #[serde(rename = "fullName")]
    full_name: String,
    role: String,
}

#[derive(Serialize)]
struct LoginResponse {
    token: String,
    user: UserResponse,
}

async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> ApiResult<Json<LoginResponse>> {
    let session = auth_service::login(&state.db, &state.jwt, &payload.username, &payload.password)
        .await
        .map_err(ApiError)?;

    Ok(Json(LoginResponse {
        token: session.token,
        user: UserResponse {
            id: session.user_id.to_string(),
            username: session.username,
            full_name: session.full_name,
            role: session.role.as_str().to_string(),
        },
    }))
}

/// Re-validates the current token and returns the user's current profile.
/// Used on app startup to confirm a persisted session is still valid
/// (matching role/active status) before trusting cached frontend state.
async fn me(
    State(state): State<AppState>,
    CurrentUser(user): CurrentUser,
) -> ApiResult<Json<UserResponse>> {
    let record = user::Entity::find_by_id(user.user_id)
        .one(&*state.db)
        .await
        .map_err(AppError::from)
        .map_err(ApiError)?
        .ok_or(AppError::Unauthorized)
        .map_err(ApiError)?;

    Ok(Json(UserResponse {
        id: record.id.to_string(),
        username: record.username,
        full_name: record.full_name,
        role: record.role_name,
    }))
}
