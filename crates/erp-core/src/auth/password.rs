use crate::error::{AppError, AppResult};
use argon2::{
    password_hash::{PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use rand_core::OsRng;

/// Hashes a plaintext password into a PHC string (`$argon2id$v=19$...`)
/// suitable for storing in `users.password_hash`. A fresh random salt is
/// generated per call, so hashing the same password twice yields different
/// output -- this is expected and is what defeats rainbow-table attacks.
///
/// Runs on whatever thread calls it. Argon2's default params take roughly
/// tens of milliseconds, which is fine on Axum's async threadpool for a
/// single-user desktop app's login/user-creation rate; if this ever needs
/// to run under sustained concurrent load, wrap the call in
/// `tokio::task::spawn_blocking`.
pub fn hash_password(password: &str) -> AppResult<String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(|e| AppError::Internal(anyhow::anyhow!("failed to hash password: {e}")))
}

/// Verifies a plaintext password against a stored PHC hash. Returns `Ok(true)`
/// only on an exact match; returns `Ok(false)` (not an error) for a simple
/// wrong-password case so callers can distinguish "bad credentials" from
/// "the stored hash is corrupt/unreadable", which is a genuine bug worth
/// surfacing differently.
pub fn verify_password(password: &str, hash: &str) -> AppResult<bool> {
    let parsed_hash = PasswordHash::new(hash)
        .map_err(|e| AppError::Internal(anyhow::anyhow!("stored password hash is invalid: {e}")))?;

    match Argon2::default().verify_password(password.as_bytes(), &parsed_hash) {
        Ok(()) => Ok(true),
        Err(argon2::password_hash::Error::Password) => Ok(false),
        Err(e) => Err(AppError::Internal(anyhow::anyhow!(
            "password verification failed: {e}"
        ))),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn hash_and_verify_round_trip() {
        let hash = hash_password("correct-horse-battery-staple").unwrap();
        assert!(verify_password("correct-horse-battery-staple", &hash).unwrap());
        assert!(!verify_password("wrong-password", &hash).unwrap());
    }

    #[test]
    fn same_password_hashes_differently_each_time() {
        let a = hash_password("same-password").unwrap();
        let b = hash_password("same-password").unwrap();
        assert_ne!(a, b, "salts should differ between calls");
    }
}
