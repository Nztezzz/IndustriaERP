use crate::domain::Role;
use crate::error::{AppError, AppResult};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::str::FromStr;
use uuid::Uuid;

/// How long an issued token stays valid before the user has to log in
/// again. Generous on purpose: this is a single-machine offline desktop
/// app, not a multi-tenant web service, so there's no meaningful blast
/// radius from a long-lived local session token the way there would be
/// for a token that could leak over a network.
const TOKEN_LIFETIME_HOURS: i64 = 12;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    /// User id (UUID as string).
    pub sub: String,
    pub username: String,
    pub role: String,
    /// Issued-at, seconds since epoch.
    pub iat: i64,
    /// Expiry, seconds since epoch.
    pub exp: i64,
}

/// Decoded, typed view of a validated token -- what request handlers and
/// the RBAC extractor actually work with, instead of poking at raw claims.
#[derive(Debug, Clone)]
pub struct AuthenticatedUser {
    pub user_id: Uuid,
    pub username: String,
    pub role: Role,
}

/// Wraps the signing/verification key so callers don't have to think about
/// `EncodingKey` vs `DecodingKey` -- both are derived from the same secret
/// since we only ever use HMAC (HS256), never asymmetric keys.
#[derive(Clone)]
pub struct JwtService {
    secret: Vec<u8>,
}

impl JwtService {
    pub fn new(secret: Vec<u8>) -> Self {
        Self { secret }
    }

    /// Loads the signing secret from `<dir>/jwt_secret.key`, generating and
    /// persisting a new random 256-bit secret on first run if the file
    /// doesn't exist yet.
    ///
    /// Stored as a plain file next to the SQLite database rather than
    /// requiring a `JWT_SECRET` environment variable: there is no
    /// deployment pipeline for a desktop app to inject env vars into, and
    /// the threat model here is "another process on this same machine
    /// reading the file", which a `.env` file wouldn't meaningfully
    /// improve on either. Losing this file just invalidates existing
    /// sessions -- it holds no other data.
    pub fn load_or_create(dir: &Path) -> AppResult<Self> {
        use rand_core::{OsRng, RngCore};

        let path = dir.join("jwt_secret.key");

        if let Ok(existing) = std::fs::read(&path) {
            if !existing.is_empty() {
                return Ok(Self::new(existing));
            }
        }

        std::fs::create_dir_all(dir)
            .map_err(|e| AppError::Internal(anyhow::anyhow!("failed to create app data dir: {e}")))?;

        let mut secret = vec![0u8; 32];
        OsRng.fill_bytes(&mut secret);

        std::fs::write(&path, &secret)
            .map_err(|e| AppError::Internal(anyhow::anyhow!("failed to persist jwt secret: {e}")))?;

        Ok(Self::new(secret))
    }

    pub fn issue_token(&self, user_id: Uuid, username: &str, role: Role) -> AppResult<String> {
        let now = chrono::Utc::now();
        let claims = Claims {
            sub: user_id.to_string(),
            username: username.to_string(),
            role: role.as_str().to_string(),
            iat: now.timestamp(),
            exp: (now + chrono::Duration::hours(TOKEN_LIFETIME_HOURS)).timestamp(),
        };

        encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(&self.secret),
        )
        .map_err(|e| AppError::Internal(anyhow::anyhow!("failed to issue token: {e}")))
    }

    pub fn verify_token(&self, token: &str) -> AppResult<AuthenticatedUser> {
        let data = decode::<Claims>(
            token,
            &DecodingKey::from_secret(&self.secret),
            &Validation::default(),
        )
        .map_err(|_| AppError::Unauthorized)?;

        let user_id = Uuid::from_str(&data.claims.sub).map_err(|_| AppError::Unauthorized)?;
        let role = Role::from_str(&data.claims.role).map_err(|_| AppError::Unauthorized)?;

        Ok(AuthenticatedUser {
            user_id,
            username: data.claims.username,
            role,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn issue_and_verify_round_trip() {
        let jwt = JwtService::new(b"test-secret-not-for-production".to_vec());
        let user_id = Uuid::new_v4();

        let token = jwt.issue_token(user_id, "alice", Role::Operator).unwrap();
        let verified = jwt.verify_token(&token).unwrap();

        assert_eq!(verified.user_id, user_id);
        assert_eq!(verified.username, "alice");
        assert_eq!(verified.role, Role::Operator);
    }

    #[test]
    fn rejects_token_signed_with_different_secret() {
        let jwt_a = JwtService::new(b"secret-a".to_vec());
        let jwt_b = JwtService::new(b"secret-b".to_vec());

        let token = jwt_a
            .issue_token(Uuid::new_v4(), "alice", Role::Viewer)
            .unwrap();

        assert!(jwt_b.verify_token(&token).is_err());
    }

    #[test]
    fn load_or_create_persists_secret_across_calls() {
        let dir = std::env::temp_dir().join(format!("erp-jwt-test-{}", Uuid::new_v4()));

        let first = JwtService::load_or_create(&dir).unwrap();
        let second = JwtService::load_or_create(&dir).unwrap();

        // Same secret was reloaded, so a token from one verifies on the other.
        let token = first
            .issue_token(Uuid::new_v4(), "alice", Role::Admin)
            .unwrap();
        assert!(second.verify_token(&token).is_ok());

        let _ = std::fs::remove_dir_all(&dir);
    }
}
