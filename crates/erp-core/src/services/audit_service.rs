use crate::entities::audit_log;
use crate::error::AppResult;
use chrono::Utc;
use sea_orm::{ActiveModelTrait, ConnectionTrait, Set};
use serde_json::Value;
use uuid::Uuid;

/// Appends one row to the generic audit trail. Callers pass `db` as
/// whatever connection they're already working with -- a plain
/// `&DatabaseConnection` for a standalone action, or a `&DatabaseTransaction`
/// when the audit entry must commit atomically alongside the mutation it's
/// describing (e.g. a stock adjustment: the movement and its audit record
/// either both land or neither does).
///
/// `entity_type` should be a stable lowercase identifier (`"product"`,
/// `"stock_movement"`, `"reel"`, ...), not necessarily the literal table
/// name, since it's also used for entities that don't map 1:1 to a table
/// (e.g. "stock_adjustment" for the adjustment-specific audit entries).
#[allow(clippy::too_many_arguments)]
pub async fn log_action<C: ConnectionTrait>(
    db: &C,
    entity_type: &str,
    entity_id: &str,
    action: &str,
    performed_by: Uuid,
    before_state: Option<Value>,
    after_state: Option<Value>,
    changes_summary: Option<String>,
) -> AppResult<()> {
    let entry = audit_log::ActiveModel {
        id: Set(Uuid::new_v4()),
        entity_type: Set(entity_type.to_string()),
        entity_id: Set(entity_id.to_string()),
        action: Set(action.to_string()),
        performed_by: Set(performed_by),
        before_state: Set(before_state),
        after_state: Set(after_state),
        changes_summary: Set(changes_summary),
        created_at: Set(Utc::now().naive_utc()),
    };
    entry.insert(db).await?;
    Ok(())
}

#[derive(Debug)]
pub struct AuditLogFilter {
    pub entity_type: Option<String>,
    pub performed_by: Option<Uuid>,
}

pub async fn list_recent<C: ConnectionTrait>(
    db: &C,
    filter: AuditLogFilter,
    limit: u64,
) -> AppResult<Vec<audit_log::Model>> {
    use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, QueryOrder, QuerySelect};

    let mut query = audit_log::Entity::find();

    if let Some(entity_type) = filter.entity_type {
        query = query.filter(audit_log::Column::EntityType.eq(entity_type));
    }
    if let Some(performed_by) = filter.performed_by {
        query = query.filter(audit_log::Column::PerformedBy.eq(performed_by));
    }

    let rows = query
        .order_by_desc(audit_log::Column::CreatedAt)
        .limit(limit)
        .all(db)
        .await?;

    Ok(rows)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db;

    #[tokio::test]
    async fn log_action_inserts_and_lists() {
        let dir = std::env::temp_dir().join(format!("erp-audit-test-{}", Uuid::new_v4()));
        let conn = db::init(&dir.join("test.db")).await.unwrap();
        let (_, user_id) = crate::services::auth_service::test_support::seed_test_user(&conn).await;

        log_action(
            &conn,
            "product",
            "some-product-id",
            "create",
            user_id,
            None,
            Some(serde_json::json!({"name": "Test Product"})),
            Some("created product".to_string()),
        )
        .await
        .unwrap();

        let rows = list_recent(
            &conn,
            AuditLogFilter {
                entity_type: Some("product".to_string()),
                performed_by: None,
            },
            10,
        )
        .await
        .unwrap();

        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].action, "create");

        let _ = std::fs::remove_dir_all(&dir);
    }
}
