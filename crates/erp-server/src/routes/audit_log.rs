use crate::error::{ApiError, ApiResult};
use crate::extractors::AdminUser;
use crate::state::AppState;
use axum::{extract::State, routing::get, Json, Router};
use erp_core::entities::user;
use erp_core::services::audit_service;
use erp_core::AppError;
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use uuid::Uuid;

pub fn router() -> Router<AppState> {
    Router::new().route("/audit-log", get(list))
}

#[derive(Serialize)]
struct AuditLogDto {
    id: Uuid,
    #[serde(rename = "entityType")]
    entity_type: String,
    #[serde(rename = "entityId")]
    entity_id: String,
    action: String,
    #[serde(rename = "performedBy")]
    performed_by: Uuid,
    /// Resolved display name for `performed_by`. The FK is
    /// `ON DELETE RESTRICT` (see the audit_logs migration) so a user row
    /// can never be removed while it still has audit entries -- this
    /// should always resolve to a real username, the UUID-string fallback
    /// only exists as a defensive belt-and-suspenders in case of a lookup
    /// race, never expected to actually trigger.
    #[serde(rename = "performedByUsername")]
    performed_by_username: String,
    #[serde(rename = "changesSummary")]
    changes_summary: Option<String>,
    #[serde(rename = "createdAt")]
    created_at: String,
}

fn to_dto(m: erp_core::entities::audit_log::Model, usernames: &HashMap<Uuid, String>) -> AuditLogDto {
    let performed_by_username = usernames
        .get(&m.performed_by)
        .cloned()
        .unwrap_or_else(|| m.performed_by.to_string());
    AuditLogDto {
        id: m.id,
        entity_type: m.entity_type,
        entity_id: m.entity_id,
        action: m.action,
        performed_by: m.performed_by,
        performed_by_username,
        changes_summary: m.changes_summary,
        created_at: m.created_at.to_string(),
    }
}

#[derive(Deserialize)]
struct ListQuery {
    #[serde(rename = "entityType")]
    entity_type: Option<String>,
    #[serde(rename = "performedBy")]
    performed_by: Option<Uuid>,
    #[serde(default = "default_limit")]
    limit: u64,
}

fn default_limit() -> u64 {
    100
}

/// Full audit trail viewer, Admin-only per the security requirements --
/// this is exactly the record of "who adjusted stock, who changed a user's
/// role", so only admins should be able to browse it.
async fn list(
    State(state): State<AppState>,
    AdminUser(_): AdminUser,
    axum::extract::Query(query): axum::extract::Query<ListQuery>,
) -> ApiResult<Json<Vec<AuditLogDto>>> {
    let rows = audit_service::list_recent(
        &*state.db,
        audit_service::AuditLogFilter {
            entity_type: query.entity_type,
            performed_by: query.performed_by,
        },
        query.limit,
    )
    .await
    .map_err(ApiError)?;

    // Resolve every distinct `performed_by` in one query rather than one
    // lookup per row (this list can be up to `limit` rows, default 100).
    let distinct_ids: Vec<Uuid> = {
        let mut ids: Vec<Uuid> = rows.iter().map(|r| r.performed_by).collect();
        ids.sort_unstable();
        ids.dedup();
        ids
    };
    let usernames: HashMap<Uuid, String> = if distinct_ids.is_empty() {
        HashMap::new()
    } else {
        user::Entity::find()
            .filter(user::Column::Id.is_in(distinct_ids))
            .all(&*state.db)
            .await
            .map_err(AppError::from)
            .map_err(ApiError)?
            .into_iter()
            .map(|u| (u.id, u.username))
            .collect()
    };

    Ok(Json(rows.into_iter().map(|r| to_dto(r, &usernames)).collect()))
}
