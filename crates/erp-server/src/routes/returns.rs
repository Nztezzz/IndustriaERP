use axum::{extract::State, routing::post, Json, Router};
use axum::extract::Path;
use erp_core::services::return_service;
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::ApiError;
use crate::extractors::OperatorUser;
use crate::state::AppState;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ReturnItemDto {
    product_id: Uuid,
    quantity: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CreateReturnRequest {
    dispatch_id: Uuid,
    items: Vec<ReturnItemDto>,
    remarks: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct CreateReturnResponse {
    dispatch_id: Uuid,
    items_returned: usize,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ReturnableItemDto {
    product_id: Uuid,
    dispatched_qty: f64,
    already_returned_qty: f64,
    returnable_qty: f64,
}

async fn create_return(
    State(state): State<AppState>,
    user: OperatorUser,
    Json(body): Json<CreateReturnRequest>,
) -> Result<Json<CreateReturnResponse>, ApiError> {
    let items = body
        .items
        .into_iter()
        .map(|i| return_service::ReturnItemInput {
            product_id: i.product_id,
            quantity: i.quantity,
        })
        .collect();

    let result = return_service::create_return(
        &state.db,
        return_service::CreateReturnInput {
            dispatch_id: body.dispatch_id,
            items,
            remarks: body.remarks,
        },
        user.0.user_id,
    )
    .await?;

    Ok(Json(CreateReturnResponse {
        dispatch_id: result.dispatch_id,
        items_returned: result.items_returned,
    }))
}

async fn get_returnable_items(
    State(state): State<AppState>,
    _user: OperatorUser,
    Path(dispatch_id): Path<Uuid>,
) -> Result<Json<Vec<ReturnableItemDto>>, ApiError> {
    let items = return_service::get_returnable_items(&state.db, dispatch_id).await?;

    let dto: Vec<ReturnableItemDto> = items
        .into_iter()
        .map(|i| ReturnableItemDto {
            product_id: i.product_id,
            dispatched_qty: i.dispatched_qty,
            already_returned_qty: i.already_returned_qty,
            returnable_qty: i.returnable_qty,
        })
        .collect();

    Ok(Json(dto))
}

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/returns", post(create_return))
        .route("/dispatches/{dispatch_id}/returnable-items", axum::routing::get(get_returnable_items))
}
