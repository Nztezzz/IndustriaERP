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
    /// Stock sent out to customers (dispatches). Surfaced in the UI as
    /// "Dispatch" rather than "Outward" -- dispatching is the only way
    /// stock leaves, so the operator-facing word is the useful one.
    pub total_outward: f64,
    /// Stock that came back from customers. Tracked separately from
    /// `total_inward` on purpose: inward is what was produced/received and
    /// must not move when goods are returned.
    pub total_return: f64,
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
                    total_return: 0.0,
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
            // An "inward" movement WITH a dispatch_id is a pre-migration
            // return (back when returns were stored as inward). Count it
            // under return so the inward figure stays at what was actually
            // produced/received. New returns use movement_type = "return".
            "inward" if movement.dispatch_id.is_some() => {
                summary.total_return += movement.quantity;
            }
            "inward" => summary.total_inward += movement.quantity,
            "outward" => summary.total_outward += movement.quantity,
            "return" => summary.total_return += movement.quantity,
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
    pub return_count: u64,
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
            return_count: 0,
            dispatch_count: 0,
        });
        match m.movement_type.as_str() {
            "inward" if m.dispatch_id.is_some() => entry.return_count += 1,
            "inward" => entry.inward_count += 1,
            "outward" => entry.outward_count += 1,
            "return" => entry.return_count += 1,
            _ => {}
        }
    }

    for d in dispatches {
        let date = d.dispatch_date.format("%Y-%m-%d").to_string();
        let entry = buckets.entry(date.clone()).or_insert(DailyActivitySummary {
            date,
            inward_count: 0,
            outward_count: 0,
            return_count: 0,
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

#[derive(Serialize)]
pub struct LedgerEntry {
    pub id: Uuid,
    pub date: NaiveDateTime,
    /// Resolved from the linked dispatch's customer when the movement has
    /// a `dispatch_id` (outward/return); otherwise parsed out of the
    /// "Party: Name" convention Inward Entry writes into `remarks` (see
    /// inward-entry-page.tsx). `None` when neither source has a name --
    /// e.g. a manual adjustment with no party involved.
    pub customer_name: Option<String>,
    pub product_id: Uuid,
    pub product_name: String,
    pub product_sku: String,
    pub movement_type: String,
    pub quantity: f64,
    pub reference_number: Option<String>,
    pub remarks: Option<String>,
}

/// Pulls "Party: Name" out of a remarks string written by Inward Entry
/// (see inward-entry-page.tsx's `partyStr` construction). Stops at the
/// next " | " separator or end of string.
fn parse_party_from_remarks(remarks: &str) -> Option<String> {
    let idx = remarks.find("Party:")?;
    let after = &remarks[idx + "Party:".len()..];
    let name = after.split(" | ").next().unwrap_or(after).trim();
    if name.is_empty() {
        None
    } else {
        Some(name.to_string())
    }
}

/// Individual-entry ledger: every stock movement in the range with its
/// date, resolved customer/party name, and product -- the row-level view
/// behind the "Show me every entry, not just a total" reports (as
/// opposed to `product_wise_summary`, which only returns aggregates).
///
/// `customer_id` narrows to entries tied to one customer: either the
/// dispatch a return/outward movement is linked to, or (for inward
/// entries with no dispatch) a remarks-embedded party name matching that
/// customer.
pub async fn ledger_entries(
    db: &DatabaseConnection,
    range: DateRange,
    customer_id: Option<Uuid>,
) -> AppResult<Vec<LedgerEntry>> {
    let mut query = stock_movement::Entity::find();
    if let Some(from) = range.from {
        query = query.filter(stock_movement::Column::CreatedAt.gte(from));
    }
    if let Some(to) = range.to {
        query = query.filter(stock_movement::Column::CreatedAt.lte(to));
    }
    let movements = query
        .order_by_desc(stock_movement::Column::CreatedAt)
        .all(db)
        .await?;

    let products = product::Entity::find().all(db).await?;
    let product_by_id: std::collections::HashMap<Uuid, &product::Model> =
        products.iter().map(|p| (p.id, p)).collect();

    let dispatches = dispatch::Entity::find().all(db).await?;
    let dispatch_by_id: std::collections::HashMap<Uuid, &dispatch::Model> =
        dispatches.iter().map(|d| (d.id, d)).collect();

    let customers = customer::Entity::find().all(db).await?;
    let customer_by_id: std::collections::HashMap<Uuid, &customer::Model> =
        customers.iter().map(|c| (c.id, c)).collect();

    // Name of the customer we're filtering to, if any -- used to match
    // inward entries that only carry the name in remarks (no dispatch_id
    // to resolve a customer_id from).
    let filter_customer_name = customer_id.and_then(|id| customer_by_id.get(&id)).map(|c| c.name.as_str());

    let mut rows = Vec::new();
    for m in movements {
        let dispatch_customer_id = m
            .dispatch_id
            .and_then(|id| dispatch_by_id.get(&id))
            .map(|d| d.customer_id);

        let customer_name = dispatch_customer_id
            .and_then(|cid| customer_by_id.get(&cid))
            .map(|c| c.name.clone())
            .or_else(|| m.remarks.as_deref().and_then(parse_party_from_remarks));

        if let Some(target_id) = customer_id {
            let matches_dispatch = dispatch_customer_id == Some(target_id);
            let matches_remarks = filter_customer_name
                .map(|name| customer_name.as_deref() == Some(name))
                .unwrap_or(false);
            if !matches_dispatch && !matches_remarks {
                continue;
            }
        }

        let Some(product) = product_by_id.get(&m.product_id) else {
            continue;
        };

        rows.push(LedgerEntry {
            id: m.id,
            date: m.created_at,
            customer_name,
            product_id: m.product_id,
            product_name: product.name.clone(),
            product_sku: product.sku.clone(),
            movement_type: m.movement_type,
            quantity: m.quantity,
            reference_number: m.reference_number,
            remarks: m.remarks,
        });
    }

    Ok(rows)
}
