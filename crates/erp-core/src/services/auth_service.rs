use crate::auth::{hash_password, verify_password, JwtService};
use crate::domain::Role;
use crate::entities::user;
use crate::error::{AppError, AppResult};
use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set};
use std::str::FromStr;
use uuid::Uuid;

pub struct AuthenticatedSession {
    pub token: String,
    pub user_id: Uuid,
    pub username: String,
    pub full_name: String,
    pub role: Role,
}

/// Verifies credentials against `users` and, on success, issues a JWT and
/// bumps `last_login_at`. Deliberately returns the same
/// `AppError::InvalidCredentials` whether the username doesn't exist or the
/// password is wrong -- distinguishing the two to a caller would let an
/// attacker enumerate valid usernames.
pub async fn login(
    db: &DatabaseConnection,
    jwt: &JwtService,
    username: &str,
    password: &str,
) -> AppResult<AuthenticatedSession> {
    let user_model = user::Entity::find()
        .filter(user::Column::Username.eq(username))
        .one(db)
        .await?
        .ok_or(AppError::InvalidCredentials)?;

    if !user_model.is_active {
        return Err(AppError::InvalidCredentials);
    }

    if !verify_password(password, &user_model.password_hash)? {
        return Err(AppError::InvalidCredentials);
    }

    let role = Role::from_str(&user_model.role_name)
        .map_err(|e| AppError::Internal(anyhow::anyhow!(e)))?;

    let token = jwt.issue_token(user_model.id, &user_model.username, role)?;

    let mut active: user::ActiveModel = user_model.clone().into();
    active.last_login_at = Set(Some(Utc::now().naive_utc()));
    active.update(db).await?;

    Ok(AuthenticatedSession {
        token,
        user_id: user_model.id,
        username: user_model.username,
        full_name: user_model.full_name,
        role,
    })
}

/// Creates the very first admin account on a fresh install. No-op if any
/// user already exists. Called once from the Tauri shell's startup
/// sequence, right after migrations run.
///
/// The generated password is returned (never persisted in plaintext
/// anywhere) so the caller can surface it to the operator exactly once --
/// there is no "forgot password" flow for a fully offline single-machine
/// app, so this first-run credential is the recovery path if it's lost
/// before being changed.
pub async fn ensure_default_admin(db: &DatabaseConnection) -> AppResult<Option<(String, String)>> {
    let any_user_exists = user::Entity::find().one(db).await?.is_some();
    if any_user_exists {
        return Ok(None);
    }

    let username = "admin".to_string();
    let password = generate_temp_password();
    let password_hash = hash_password(&password)?;

    let now = Utc::now().naive_utc();
    let new_user = user::ActiveModel {
        id: Set(Uuid::new_v4()),
        username: Set(username.clone()),
        password_hash: Set(password_hash),
        full_name: Set("Administrator".to_string()),
        role_name: Set(Role::Admin.as_str().to_string()),
        is_active: Set(true),
        last_login_at: Set(None),
        created_at: Set(now),
        updated_at: Set(now),
    };
    new_user.insert(db).await?;

    Ok(Some((username, password)))
}

/// A short, unambiguous (no `0`/`O`/`1`/`l`) random password for the
/// generated admin account -- meant to be read off a screen/printed
/// receipt once and changed immediately, not memorized.
fn generate_temp_password() -> String {
    use rand_core::{OsRng, RngCore};

    const CHARSET: &[u8] = b"ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let mut bytes = [0u8; 12];
    OsRng.fill_bytes(&mut bytes);

    bytes
        .iter()
        .map(|b| CHARSET[(*b as usize) % CHARSET.len()] as char)
        .collect()
}

/// Test-only helpers shared across every other service's test module.
/// Every FK in the schema that points at `users.id` means "some action was
/// performed_by/created_by a real user row" -- a bare `Uuid::new_v4()`
/// fails the foreign key constraint (correctly), so tests need an actual
/// seeded user instead.
#[cfg(test)]
pub mod test_support {
    use super::*;

    /// Seeds one active user with a known password and returns
    /// `(username, user_id)` for use as a `performed_by`/`created_by`
    /// value in other services' tests.
    pub async fn seed_test_user(db: &DatabaseConnection) -> (String, Uuid) {
        let (username, _password) = ensure_default_admin(db)
            .await
            .expect("ensure_default_admin should succeed")
            .expect("first call on a fresh db should create the admin user");

        let user_model = user::Entity::find()
            .filter(user::Column::Username.eq(&username))
            .one(db)
            .await
            .expect("query should succeed")
            .expect("just-created user should exist");

        (username, user_model.id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    async fn test_db() -> (DatabaseConnection, std::path::PathBuf) {
        let dir = std::env::temp_dir().join(format!("erp-auth-service-test-{}", Uuid::new_v4()));
        let db_path = dir.join("test.db");
        let conn = db::init(&db_path).await.unwrap();
        (conn, dir)
    }

    #[tokio::test]
    async fn ensure_default_admin_creates_once_then_noops() {
        let (conn, dir) = test_db().await;

        let first = ensure_default_admin(&conn).await.unwrap();
        assert!(first.is_some());
        let (username, _password) = first.unwrap();
        assert_eq!(username, "admin");

        let second = ensure_default_admin(&conn).await.unwrap();
        assert!(second.is_none(), "should be a no-op once a user exists");

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[tokio::test]
    async fn login_succeeds_with_correct_password_and_fails_otherwise() {
        let (conn, dir) = test_db().await;
        let jwt = JwtService::new(b"test-secret".to_vec());

        let (username, password) = ensure_default_admin(&conn).await.unwrap().unwrap();

        let session = login(&conn, &jwt, &username, &password).await.unwrap();
        assert_eq!(session.username, username);
        assert_eq!(session.role, Role::Admin);

        let bad_password = login(&conn, &jwt, &username, "wrong").await;
        assert!(matches!(bad_password, Err(AppError::InvalidCredentials)));

        let bad_username = login(&conn, &jwt, "nobody", &password).await;
        assert!(matches!(bad_username, Err(AppError::InvalidCredentials)));

        let _ = std::fs::remove_dir_all(&dir);
    }
}
