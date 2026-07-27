use crate::entities::{customer, dispatch, product, reel, stock_movement};
use crate::error::AppResult;
use chrono::NaiveDateTime;
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, PaginatorTrait, QueryFilter, QueryOrder};
use serde::Serialize;
use uuid::Uuid;

/// Shared date-range filter used by every report in this module. Both
/// bounds are inclusive; a `None` bound means unbounded on that side.
pub struct DateRange {
    pub from: Option<NaiveDateTime>,
    pub to: Option<NaiveDateTime>,
}

#[derive(Serialize)]
pub struct ProductMovementSummary {
    pub product_id: Uuid,
    pub product_name: String,
    pub product_sku: String,
    pub total_inward: f64,
    pub total_outward: f64,
    pub total_adjustment_delta: f64,
}

/// Product-wise report: sums of inward/outward/adjustment quantity per
/// product within a date range. Computed in Rust over the already-indexed
/// `stock_movements` rows rather than a raw SQL `GROUP BY` -- at desktop
/// data volumes this is simple to read and fast enough, and it keeps the
/// aggregation logic testable without depending on SQLite-specific SQL.
pub async fn product_wise_summary(
    db: &DatabaseConnection,
    range: DateRange,
) -> AppResult<Vec<ProductMovementSummary>> {
    let mut query = stock_movement::Entity::find();
    if let Some(from) = range.from {
        query = query.filter(stock_movement::Column::CreatedAt.gte(from));
    }
    if let Some(to) = range.to {
        query = query.filter(stock_movement::Column::CreatedAt.lte(to));
    }
    let movements = query.all(db).await?;

    let products = product::Entity::find().all(db).await?;
    let mut summaries: std::collections::HashMap<Uuid, ProductMovementSummary> = products
        .into_iter()
        .map(|p| {
            (
                p.id,
                ProductMovementSummary {
                    product_id: p.id,
                    product_name: p.name,
                    product_sku: p.sku,
                    total_inward: 0.0,
                    total_outward: 0.0,
                    total_adjustment_delta: 0.0,
                },
            )
        })
        .collect();

    for movement in movements {
        let Some(summary) = summaries.get_mut(&movement.product_id) else {
            continue;
        };
        match movement.movement_type.as_str() {
            "inward" => summary.total_inward += movement.quantity,
            "outward" => summary.total_outward += movement.quantity,
            "adjustment" => {
                summary.total_adjustment_delta += movement.adjustment_delta.unwrap_or(0.0)
            }
            _ => {}
        }
    }

    let mut result: Vec<_> = summaries.into_values().collect();
    result.sort_by(|a, b| a.product_name.cmp(&b.product_name));
    Ok(result)
}

#[derive(Serialize)]
pub struct CustomerDispatchSummary {
    pub customer_id: Uuid,
    pub customer_name: String,
    pub dispatch_count: u64,
    pub total_weight_kg: f64,
}

/// Customer-wise report: dispatch count and total weight per customer
/// within a date range.
pub async fn customer_wise_summary(
    db: &DatabaseConnection,
    range: DateRange,
) -> AppResult<Vec<CustomerDispatchSummary>> {
    let mut query = dispatch::Entity::find();
    if let Some(from) = range.from {
        query = query.filter(dispatch::Column::DispatchDate.gte(from));
    }
    if let Some(to) = range.to {
        query = query.filter(dispatch::Column::DispatchDate.lte(to));
    }
    let dispatches = query.all(db).await?;

    let customers = customer::Entity::find().all(db).await?;
    let mut summaries: std::collections::HashMap<Uuid, CustomerDispatchSummary> = customers
        .into_iter()
        .map(|c| {
            (
                c.id,
                CustomerDispatchSummary {
                    customer_id: c.id,
                    customer_name: c.name,
                    dispatch_count: 0,
                    total_weight_kg: 0.0,
                },
            )
        })
        .collect();

    for d in dispatches {
        if let Some(summary) = summaries.get_mut(&d.customer_id) {
            summary.dispatch_count += 1;
            summary.total_weight_kg += d.total_weight_kg.unwrap_or(0.0);
        }
    }

    let mut result: Vec<_> = summaries
        .into_values()
        .filter(|s| s.dispatch_count > 0)
        .collect();
    result.sort_by_key(|s| std::cmp::Reverse(s.dispatch_count));
    Ok(result)
}

#[derive(Serialize)]
pub struct DailyActivitySummary {
    pub date: String,
    pub inward_count: u64,
    pub outward_count: u64,
    pub dispatch_count: u64,
}

/// Daily/monthly report: movement and dispatch counts bucketed by
/// calendar day within the range. The frontend rolls daily buckets up into
/// a monthly view by summing, so one query shape serves both "Daily
/// reports" and "Monthly reports".
pub async fn daily_activity(
    db: &DatabaseConnection,
    range: DateRange,
) -> AppResult<Vec<DailyActivitySummary>> {
    let mut movement_query = stock_movement::Entity::find();
    if let Some(from) = range.from {
        movement_query = movement_query.filter(stock_movement::Column::CreatedAt.gte(from));
    }
    if let Some(to) = range.to {
        movement_query = movement_query.filter(stock_movement::Column::CreatedAt.lte(to));
    }
    let movements = movement_query.all(db).await?;

    let mut dispatch_query = dispatch::Entity::find();
    if let Some(from) = range.from {
        dispatch_query = dispatch_query.filter(dispatch::Column::DispatchDate.gte(from));
    }
    if let Some(to) = range.to {
        dispatch_query = dispatch_query.filter(dispatch::Column::DispatchDate.lte(to));
    }
    let dispatches = dispatch_query.all(db).await?;

    let mut buckets: std::collections::BTreeMap<String, DailyActivitySummary> =
        std::collections::BTreeMap::new();

    for m in movements {
        let date = m.created_at.format("%Y-%m-%d").to_string();
        let entry = buckets.entry(date.clone()).or_insert(DailyActivitySummary {
            date,
            inward_count: 0,
            outward_count: 0,
            dispatch_count: 0,
        });
        match m.movement_type.as_str() {
            "inward" => entry.inward_count += 1,
            "outward" => entry.outward_count += 1,
            _ => {}
        }
    }

    for d in dispatches {
        let date = d.dispatch_date.format("%Y-%m-%d").to_string();
        let entry = buckets.entry(date.clone()).or_insert(DailyActivitySummary {
            date,
            inward_count: 0,
            outward_count: 0,
            dispatch_count: 0,
        });
        entry.dispatch_count += 1;
    }

    Ok(buckets.into_values().collect())
}

#[derive(Serialize)]
pub struct PendingReelReportRow {
    pub reel_number: String,
    pub product_name: String,
    pub customer_name: Option<String>,
    pub status: String,
    pub since: NaiveDateTime,
}

/// Pending reel report: every reel currently `dispatched` (i.e. out with a
/// customer and not yet returned), oldest-outstanding first so the
/// longest-overdue reels surface at the top.
pub async fn pending_reels(db: &DatabaseConnection) -> AppResult<Vec<PendingReelReportRow>> {
    let reels = reel::Entity::find()
        .filter(reel::Column::Status.eq("dispatched"))
        .order_by_asc(reel::Column::UpdatedAt)
        .all(db)
        .await?;

    let mut rows = Vec::with_capacity(reels.len());
    for r in reels {
        let product_name = product::Entity::find_by_id(r.product_id)
            .one(db)
            .await?
            .map(|p| p.name)
            .unwrap_or_else(|| "Unknown product".to_string());

        let customer_name = match r.current_customer_id {
            Some(cid) => customer::Entity::find_by_id(cid)
                .one(db)
                .await?
                .map(|c| c.name),
            None => None,
        };

        rows.push(PendingReelReportRow {
            reel_number: r.reel_number,
            product_name,
            customer_name,
            status: r.status,
            since: r.updated_at,
        });
    }

    Ok(rows)
}

#[derive(Serialize)]
pub struct DispatchReportRow {
    pub invoice_number: String,
    pub customer_name: String,
    pub dispatch_date: NaiveDateTime,
    pub status: String,
    pub total_weight_kg: Option<f64>,
}

/// Dispatch report: every dispatch within a date range with its customer
/// name resolved, for export/printing.
pub async fn dispatch_report(
    db: &DatabaseConnection,
    range: DateRange,
) -> AppResult<Vec<DispatchReportRow>> {
    let mut query = dispatch::Entity::find();
    if let Some(from) = range.from {
        query = query.filter(dispatch::Column::DispatchDate.gte(from));
    }
    if let Some(to) = range.to {
        query = query.filter(dispatch::Column::DispatchDate.lte(to));
    }
    let dispatches = query
        .order_by_desc(dispatch::Column::DispatchDate)
        .all(db)
        .await?;

    let mut rows = Vec::with_capacity(dispatches.len());
    for d in dispatches {
        let customer_name = customer::Entity::find_by_id(d.customer_id)
            .one(db)
            .await?
            .map(|c| c.name)
            .unwrap_or_else(|| "Unknown customer".to_string());

        rows.push(DispatchReportRow {
            invoice_number: d.invoice_number,
            customer_name,
            dispatch_date: d.dispatch_date,
            status: d.status,
            total_weight_kg: d.total_weight_kg,
        });
    }

    Ok(rows)
}

/// Count of dispatches in the given range -- used by report list pages to
/// show quick counts without loading every row.
pub async fn dispatch_count(db: &DatabaseConnection, range: DateRange) -> AppResult<u64> {
    let mut query = dispatch::Entity::find();
    if let Some(from) = range.from {
        query = query.filter(dispatch::Column::DispatchDate.gte(from));
    }
    if let Some(to) = range.to {
        query = query.filter(dispatch::Column::DispatchDate.lte(to));
    }
    Ok(query.count(db).await?)
}
