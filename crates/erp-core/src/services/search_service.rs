use crate::entities::{customer, dispatch, product, reel};
use crate::error::AppResult;
use sea_orm::{ColumnTrait, Condition, DatabaseConnection, EntityTrait, QueryFilter, QuerySelect};

/// Result cap per entity type in a combined search -- this is a "type as
/// you go, jump to the thing you meant" quick-search, not a paginated
/// browse view, so a handful of best matches per category is the right
/// shape for the global search bar in the header.
const MAX_RESULTS_PER_TYPE: u64 = 8;

pub struct SearchResults {
    pub products: Vec<product::Model>,
    pub customers: Vec<customer::Model>,
    pub reels: Vec<reel::Model>,
    pub dispatches: Vec<dispatch::Model>,
}

/// Case-insensitive substring search across products (name/SKU),
/// customers (name/phone/GST), reels (reel number), and dispatches
/// (invoice number).
///
/// Implemented with plain `LIKE` queries against SQLite rather than a
/// dedicated search engine. This is intentionally simple: at the data
/// volumes a single warehouse/office generates (thousands, not millions,
/// of rows) a `LIKE '%term%'` with an index-friendly prefix hint is fast
/// enough, and it avoids running a whole search server for an offline
/// desktop app. If usage ever demands typo-tolerant/fuzzy matching, this
/// is the seam where a Meilisearch-backed implementation would slot in
/// without changing any caller.
pub async fn search(db: &DatabaseConnection, term: &str) -> AppResult<SearchResults> {
    let term = term.trim();
    if term.is_empty() {
        return Ok(SearchResults {
            products: vec![],
            customers: vec![],
            reels: vec![],
            dispatches: vec![],
        });
    }

    let pattern = format!("%{term}%");

    let products = product::Entity::find()
        .filter(
            Condition::any()
                .add(product::Column::Name.like(&pattern))
                .add(product::Column::Sku.like(&pattern)),
        )
        .limit(MAX_RESULTS_PER_TYPE)
        .all(db)
        .await?;

    let customers = customer::Entity::find()
        .filter(
            Condition::any()
                .add(customer::Column::Name.like(&pattern))
                .add(customer::Column::Phone.like(&pattern))
                .add(customer::Column::GstNumber.like(&pattern)),
        )
        .limit(MAX_RESULTS_PER_TYPE)
        .all(db)
        .await?;

    let reels = reel::Entity::find()
        .filter(reel::Column::ReelNumber.like(&pattern))
        .limit(MAX_RESULTS_PER_TYPE)
        .all(db)
        .await?;

    let dispatches = dispatch::Entity::find()
        .filter(dispatch::Column::InvoiceNumber.like(&pattern))
        .limit(MAX_RESULTS_PER_TYPE)
        .all(db)
        .await?;

    Ok(SearchResults {
        products,
        customers,
        reels,
        dispatches,
    })
}
