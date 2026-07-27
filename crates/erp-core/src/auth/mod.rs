pub mod jwt;
pub mod password;

pub use jwt::{AuthenticatedUser, Claims, JwtService};
pub use password::{hash_password, verify_password};

use crate::domain::Role;
use crate::error::{AppError, AppResult};

/// Central RBAC gate: every handler that requires more than "logged in"
/// should call this once at the top rather than re-implementing the role
/// comparison inline, so the "who can do what" logic stays in one place.
pub fn require_role(user: &AuthenticatedUser, min_role: Role) -> AppResult<()> {
    if user.role.has_min_role(min_role) {
        Ok(())
    } else {
        Err(AppError::Forbidden)
    }
}
