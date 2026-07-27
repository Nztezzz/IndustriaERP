use crate::error::ApiError;
use crate::state::AppState;
use axum::{
    extract::{FromRef, FromRequestParts},
    http::request::Parts,
};
use erp_core::auth::AuthenticatedUser;
use erp_core::AppError;

/// Extracts and verifies the caller's JWT from the `Authorization: Bearer
/// <token>` header. Add this as a handler argument to require a valid
/// session; handlers that don't need auth (login, health) simply omit it.
///
/// This only proves "who is making the request" -- it does not check
/// whether that user's role is sufficient for the action. For that, wrap
/// the resulting `AuthenticatedUser` with `require_role` from
/// `erp_core::auth`, or use the `RequireRole<MIN>` extractor below when the
/// whole handler has a single fixed minimum role.
pub struct CurrentUser(pub AuthenticatedUser);

impl<S> FromRequestParts<S> for CurrentUser
where
    AppState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let app_state = AppState::from_ref(state);

        let header = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .ok_or(AppError::Unauthorized)?;

        let token = header
            .strip_prefix("Bearer ")
            .ok_or(AppError::Unauthorized)?;

        let user = app_state.jwt.verify_token(token)?;
        Ok(CurrentUser(user))
    }
}

/// Convenience extractor for handlers that require Operator role or
/// higher (i.e. Operator or Admin, not Viewer). Prefer this over pulling
/// `CurrentUser` and calling `require_role` manually when the entire
/// handler has one fixed minimum -- it keeps the requirement visible in
/// the function signature instead of buried in the body.
pub struct OperatorUser(pub AuthenticatedUser);

impl<S> FromRequestParts<S> for OperatorUser
where
    AppState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let CurrentUser(user) = CurrentUser::from_request_parts(parts, state).await?;
        erp_core::auth::require_role(&user, erp_core::domain::Role::Operator)?;
        Ok(OperatorUser(user))
    }
}

/// Convenience extractor for handlers restricted to Admin only (user
/// management, backup/restore, audit log).
pub struct AdminUser(pub AuthenticatedUser);

impl<S> FromRequestParts<S> for AdminUser
where
    AppState: FromRef<S>,
    S: Send + Sync,
{
    type Rejection = ApiError;

    async fn from_request_parts(parts: &mut Parts, state: &S) -> Result<Self, Self::Rejection> {
        let CurrentUser(user) = CurrentUser::from_request_parts(parts, state).await?;
        erp_core::auth::require_role(&user, erp_core::domain::Role::Admin)?;
        Ok(AdminUser(user))
    }
}
