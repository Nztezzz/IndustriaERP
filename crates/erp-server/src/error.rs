use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use erp_core::{error::StatusKind, AppError};
use serde::Serialize;

#[derive(Serialize)]
struct ErrorBody {
    message: String,
    code: &'static str,
}

/// Wrapper so we can impl axum's `IntoResponse` for `erp_core::AppError`
/// without violating Rust's orphan rule (neither type lives in this
/// crate). Handlers return `Result<T, ApiError>` and use `?` on any
/// `AppResult` via the `From<AppError>` impl below.
pub struct ApiError(pub AppError);

impl From<AppError> for ApiError {
    fn from(err: AppError) -> Self {
        Self(err)
    }
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = match self.0.status_kind() {
            StatusKind::BadRequest => StatusCode::BAD_REQUEST,
            StatusKind::Unauthorized => StatusCode::UNAUTHORIZED,
            StatusKind::Forbidden => StatusCode::FORBIDDEN,
            StatusKind::NotFound => StatusCode::NOT_FOUND,
            StatusKind::Conflict => StatusCode::CONFLICT,
            StatusKind::InternalServerError => StatusCode::INTERNAL_SERVER_ERROR,
        };

        if status == StatusCode::INTERNAL_SERVER_ERROR {
            tracing::error!(error = %self.0, "internal error handling request");
        }

        let body = ErrorBody {
            message: self.0.to_string(),
            code: self.0.code(),
        };

        (status, Json(body)).into_response()
    }
}

pub type ApiResult<T> = Result<T, ApiError>;
