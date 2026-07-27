/// Coarse HTTP-status-shaped classification for an `AppError`, without
/// depending on axum/http from this crate. `erp-server` maps each variant
/// to the real `http::StatusCode`; this keeps `erp-core` usable from a
/// plain Tauri command (no HTTP involved) just as easily as from Axum.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StatusKind {
    BadRequest,
    Unauthorized,
    Forbidden,
    NotFound,
    Conflict,
    InternalServerError,
}

/// Shared error type for every service in `erp-core`. `erp-server` converts
/// this into an HTTP response (see `erp_server::error`'s `IntoResponse`
/// impl); Tauri commands that call into services directly can match on the
/// variants without needing any HTTP knowledge.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    NotFound(String),

    #[error("{0}")]
    Validation(String),

    #[error("{0}")]
    Conflict(String),

    #[error("invalid username or password")]
    InvalidCredentials,

    #[error("authentication required")]
    Unauthorized,

    #[error("you do not have permission to perform this action")]
    Forbidden,

    #[error("database error: {0}")]
    Database(#[from] sea_orm::DbErr),

    #[error("internal error: {0}")]
    Internal(#[from] anyhow::Error),
}

impl AppError {
    /// Machine-readable code the frontend can branch on (e.g. to show a
    /// specific inline error) without parsing the human-readable message.
    pub fn code(&self) -> &'static str {
        match self {
            AppError::NotFound(_) => "NOT_FOUND",
            AppError::Validation(_) => "VALIDATION_ERROR",
            AppError::Conflict(_) => "CONFLICT",
            AppError::InvalidCredentials => "INVALID_CREDENTIALS",
            AppError::Unauthorized => "UNAUTHORIZED",
            AppError::Forbidden => "FORBIDDEN",
            AppError::Database(_) => "DATABASE_ERROR",
            AppError::Internal(_) => "INTERNAL_ERROR",
        }
    }

    pub fn status_kind(&self) -> StatusKind {
        match self {
            AppError::NotFound(_) => StatusKind::NotFound,
            AppError::Validation(_) => StatusKind::BadRequest,
            AppError::Conflict(_) => StatusKind::Conflict,
            AppError::InvalidCredentials => StatusKind::Unauthorized,
            AppError::Unauthorized => StatusKind::Unauthorized,
            AppError::Forbidden => StatusKind::Forbidden,
            AppError::Database(_) | AppError::Internal(_) => StatusKind::InternalServerError,
        }
    }
}

pub type AppResult<T> = Result<T, AppError>;
