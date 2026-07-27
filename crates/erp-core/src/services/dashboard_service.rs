use crate::entities::{customer, dispatch, product, reel, stock_movement};
use crate::error::AppResult;
use chrono::{Duration, NaiveDateTime, Utc};
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, PaginatorTrait, QueryFilter, QueryOrder};
use serde::Serialize;

fn today_range() -> (NaiveDateTime, NaiveDateTime) {
    let now = Utc::now().naive_utc();
    let start_of_day = now.date().and_hms_opt(0, 0, 0).unwrap();
    let start_of_tomorrow = start_of_day + Duration::days(1);
    (start_of_day, start_of_tomorrow)
}

#[derive(Serialize)]
pub struct DashboardSummary {
    pub total_products: u64,
    pub low_stock_product_count: u64,
    pub today_inward_count: u64,
    pub today_outward_count: u64,
    pub today_dispatch_count: u64,
    pub pending_reel_count: u64,
}

/// The Dashboard's headline numbers: live stock health plus today's
/// activity counts, computed fresh on every call rather than cached --
/// at desktop data volumes these are cheap counts, and staleness would be
/// a worse tradeoff than the query cost.
pub async fn summary(db: &DatabaseConnection) -> AppResult<DashboardSummary> {
    let (start, end) = today_range();

    let total_products = product::Entity::find()
        .filter(product::Column::IsActive.eq(true))
        .count(db)
        .await?;

    let low_stock_product_count = super::stock_service::list_balances(db)
        .await?
        .into_iter()
        .filter(|b| b.is_low_stock)
        .count() as u64;

    let today_inward_count = stock_movement::Entity::find()
        .filter(stock_movement::Column::MovementType.eq("inward"))
        .filter(stock_movement::Column::CreatedAt.gte(start))
        .filter(stock_movement::Column::CreatedAt.lt(end))
        .count(db)
        .await?;

    let today_outward_count = stock_movement::Entity::find()
        .filter(stock_movement::Column::MovementType.eq("outward"))
        .filter(stock_movement::Column::CreatedAt.gte(start))
        .filter(stock_movement::Column::CreatedAt.lt(end))
        .count(db)
        .await?;

    let today_dispatch_count = dispatch::Entity::find()
        .filter(dispatch::Column::DispatchDate.gte(start))
        .filter(dispatch::Column::DispatchDate.lt(end))
        .count(db)
        .await?;

    let pending_reel_count = reel::Entity::find()
        .filter(reel::Column::Status.eq("dispatched"))
        .count(db)
        .await?;

    Ok(DashboardSummary {
        total_products,
        low_stock_product_count,
        today_inward_count,
        today_outward_count,
        today_dispatch_count,
        pending_reel_count,
    })
}

#[derive(Serialize)]
pub struct ActivityEntry {
    pub kind: String,
    pub description: String,
    pub timestamp: NaiveDateTime,
}

/// Recent-activity feed: the last `limit` stock movements and dispatches,
/// merged and sorted newest-first. Intentionally lightweight (two simple
/// queries + an in-memory sort) rather than a dedicated activity-log table,
/// since stock_movements and dispatches already ARE the activity.
pub async fn recent_activity(db: &DatabaseConnection, limit: u64) -> AppResult<Vec<ActivityEntry>> {
    let movements = stock_movement::Entity::find()
        .order_by_desc(stock_movement::Column::CreatedAt)
        .paginate(db, limit)
        .fetch_page(0)
        .await?;

    let dispatches = dispatch::Entity::find()
        .order_by_desc(dispatch::Column::CreatedAt)
        .paginate(db, limit)
        .fetch_page(0)
        .await?;

    let mut entries = Vec::with_capacity(movements.len() + dispatches.len());

    for m in movements {
        let product_name = product::Entity::find_by_id(m.product_id)
            .one(db)
            .await?
            .map(|p| p.name)
            .unwrap_or_else(|| "Unknown product".to_string());

        entries.push(ActivityEntry {
            kind: m.movement_type.clone(),
            description: format!("{} {} of {}", m.movement_type, m.quantity, product_name),
            timestamp: m.created_at,
        });
    }

    for d in dispatches {
        let customer_name = customer::Entity::find_by_id(d.customer_id)
            .one(db)
            .await?
            .map(|c| c.name)
            .unwrap_or_else(|| "Unknown customer".to_string());

        entries.push(ActivityEntry {
            kind: "dispatch".to_string(),
            description: format!("Dispatch {} to {}", d.invoice_number, customer_name),
            timestamp: d.created_at,
        });
    }

    entries.sort_by_key(|e| std::cmp::Reverse(e.timestamp));
    entries.truncate(limit as usize);

    Ok(entries)
}
