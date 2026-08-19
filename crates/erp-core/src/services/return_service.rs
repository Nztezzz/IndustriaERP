//! Product Return service.
//!
//! A return is linked to a previous dispatch: the customer can return
//! only products that were dispatched to them, up to the dispatched
//! quantity minus any amount already returned. Each successful return
//! records an inward stock movement (with `dispatch_id` set) so the
//! stock balance is automatically restored.

use crate::entities::{dispatch, dispatch_item, stock_movement};
use crate::error::{AppError, AppResult};
use crate::services::stock_service;
use sea_orm::{
    ColumnTrait, ConnectionTrait, DatabaseConnection, EntityTrait, QueryFilter, TransactionTrait,
};
use uuid::Uuid;

pub struct ReturnItemInput {
    pub product_id: Uuid,
    pub quantity: f64,
}

pub struct CreateReturnInput {
    pub dispatch_id: Uuid,
    pub items: Vec<ReturnItemInput>,
    pub remarks: Option<String>,
}

/// Summary of what was returned, for the response.
pub struct ReturnResult {
    pub dispatch_id: Uuid,
    pub items_returned: usize,
}

/// For each product in a dispatch, how much was dispatched and how much
/// has already been returned.
pub struct ReturnableItem {
    pub product_id: Uuid,
    pub dispatched_qty: f64,
    pub already_returned_qty: f64,
    pub returnable_qty: f64,
}

/// Returns the returnable quantities for each line item in a dispatch.
pub async fn get_returnable_items(
    db: &DatabaseConnection,
    dispatch_id: Uuid,
) -> AppResult<Vec<ReturnableItem>> {
    // Verify dispatch exists
    let _dispatch = dispatch::Entity::find_by_id(dispatch_id)
        .one(db)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("dispatch {dispatch_id} not found")))?;

    // Get all line items for this dispatch
    let items = dispatch_item::Entity::find()
        .filter(dispatch_item::Column::DispatchId.eq(dispatch_id))
        .all(db)
        .await?;

    let mut result = Vec::new();

    for item in &items {
        // Find all inward movements linked to this dispatch for this product
        // (these are previous returns)
        let returned_qty = get_returned_qty(db, dispatch_id, item.product_id).await?;

        let returnable = item.quantity - returned_qty;
        result.push(ReturnableItem {
            product_id: item.product_id,
            dispatched_qty: item.quantity,
            already_returned_qty: returned_qty,
            returnable_qty: if returnable > 0.0 { returnable } else { 0.0 },
        });
    }

    Ok(result)
}

/// Sums the quantity of all inward movements linked to a specific dispatch
/// and product (i.e. previous returns for that item).
async fn get_returned_qty<C: ConnectionTrait>(
    db: &C,
    dispatch_id: Uuid,
    product_id: Uuid,
) -> AppResult<f64> {
    let movements = stock_movement::Entity::find()
        .filter(stock_movement::Column::DispatchId.eq(dispatch_id))
        .filter(stock_movement::Column::ProductId.eq(product_id))
        .filter(stock_movement::Column::MovementType.eq("inward"))
        .all(db)
        .await?;

    Ok(movements.iter().map(|m| m.quantity).sum())
}

/// Records a product return against a previous dispatch.
///
/// Validates:
/// - The dispatch exists
/// - Each product was in that dispatch
/// - Return quantity does not exceed (dispatched - already returned)
///
/// On success, records inward stock movements (one per item) that restore
/// the stock balance.
pub async fn create_return(
    db: &DatabaseConnection,
    input: CreateReturnInput,
    performed_by: Uuid,
) -> AppResult<ReturnResult> {
    if input.items.is_empty() {
        return Err(AppError::Validation("at least one item is required".into()));
    }

    // Verify dispatch exists
    let dispatch_model = dispatch::Entity::find_by_id(input.dispatch_id)
        .one(db)
        .await?
        .ok_or_else(|| {
            AppError::NotFound(format!("dispatch {} not found", input.dispatch_id))
        })?;

    // Get the dispatch line items
    let dispatch_items = dispatch_item::Entity::find()
        .filter(dispatch_item::Column::DispatchId.eq(input.dispatch_id))
        .all(db)
        .await?;

    let txn = db.begin().await?;

    for return_item in &input.items {
        if return_item.quantity <= 0.0 {
            return Err(AppError::Validation(
                "return quantity must be greater than zero".into(),
            ));
        }

        // Find the dispatch line item for this product
        let dispatch_line = dispatch_items
            .iter()
            .find(|di| di.product_id == return_item.product_id)
            .ok_or_else(|| {
                AppError::Validation(format!(
                    "product {} was not part of dispatch {}",
                    return_item.product_id, input.dispatch_id
                ))
            })?;

        // Check how much has already been returned
        let already_returned = get_returned_qty(&txn, input.dispatch_id, return_item.product_id).await?;
        let max_returnable = dispatch_line.quantity - already_returned;

        if return_item.quantity > max_returnable {
            return Err(AppError::Validation(format!(
                "return quantity ({}) exceeds returnable balance ({:.2}) for this product",
                return_item.quantity, max_returnable
            )));
        }

        // Record an inward movement linked to the dispatch
        let remarks = match &input.remarks {
            Some(r) if !r.trim().is_empty() => {
                Some(format!("Return from {} | {}", dispatch_model.invoice_number, r))
            }
            _ => Some(format!("Return from {}", dispatch_model.invoice_number)),
        };

        stock_service::record_inward_in(
            &txn,
            stock_service::InwardInput {
                product_id: return_item.product_id,
                quantity: return_item.quantity,
                reference_number: Some(dispatch_model.invoice_number.clone()),
                remarks,
            },
            performed_by,
            Some(input.dispatch_id),
        )
        .await?;
    }

    txn.commit().await?;

    Ok(ReturnResult {
        dispatch_id: input.dispatch_id,
        items_returned: input.items.len(),
    })
}
