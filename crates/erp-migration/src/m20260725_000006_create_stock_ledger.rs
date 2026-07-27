use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Append-only ledger: every inward/outward/adjustment is a new row,
        // never mutated. This is what "Full stock history log" and the
        // manual-adjustment audit trail read from.
        manager
            .create_table(
                Table::create()
                    .table(StockMovements::Table)
                    .if_not_exists()
                    .col(pk_uuid(StockMovements::Id))
                    .col(uuid(StockMovements::ProductId))
                    // inward | outward | adjustment -- see erp_core::domain::StockMovementType.
                    .col(string(StockMovements::MovementType))
                    // Always stored positive; sign is derived from
                    // `movement_type` when computing balances, so an
                    // adjustment can carry an explicit +/- via
                    // `adjustment_delta` instead of overloading this field.
                    .col(double(StockMovements::Quantity))
                    .col(double_null(StockMovements::AdjustmentDelta))
                    .col(uuid_null(StockMovements::DispatchId))
                    .col(string_null(StockMovements::ReferenceNumber))
                    .col(text_null(StockMovements::Remarks))
                    .col(uuid(StockMovements::PerformedBy))
                    .col(timestamp(StockMovements::CreatedAt).default(Expr::current_timestamp()))
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_stock_movements_product")
                            .from(StockMovements::Table, StockMovements::ProductId)
                            .to(Products::Table, Products::Id)
                            .on_update(ForeignKeyAction::Cascade)
                            .on_delete(ForeignKeyAction::Restrict),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_stock_movements_dispatch")
                            .from(StockMovements::Table, StockMovements::DispatchId)
                            .to(Dispatches::Table, Dispatches::Id)
                            .on_update(ForeignKeyAction::Cascade)
                            .on_delete(ForeignKeyAction::SetNull),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_stock_movements_performed_by")
                            .from(StockMovements::Table, StockMovements::PerformedBy)
                            .to(Users::Table, Users::Id)
                            .on_update(ForeignKeyAction::Cascade)
                            .on_delete(ForeignKeyAction::Restrict),
                    )
                    .to_owned(),
            )
            .await?;

        // Denormalized current balance per product, maintained transactionally
        // by stock_service alongside each stock_movements insert. Exists
        // purely so "live stock summary" / "product-wise inventory view"
        // reads are O(1) instead of summing the whole ledger on every load.
        manager
            .create_table(
                Table::create()
                    .table(StockBalances::Table)
                    .if_not_exists()
                    .col(uuid(StockBalances::ProductId).primary_key())
                    .col(double(StockBalances::QuantityOnHand).default(0.0))
                    .col(timestamp(StockBalances::UpdatedAt).default(Expr::current_timestamp()))
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_stock_balances_product")
                            .from(StockBalances::Table, StockBalances::ProductId)
                            .to(Products::Table, Products::Id)
                            .on_update(ForeignKeyAction::Cascade)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        for (name, column) in [
            ("idx_stock_movements_product", StockMovements::ProductId),
            (
                "idx_stock_movements_created_at",
                StockMovements::CreatedAt,
            ),
        ] {
            manager
                .create_index(
                    Index::create()
                        .if_not_exists()
                        .name(name)
                        .table(StockMovements::Table)
                        .col(column)
                        .to_owned(),
                )
                .await?;
        }

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(StockBalances::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(StockMovements::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum StockMovements {
    Table,
    Id,
    ProductId,
    MovementType,
    Quantity,
    AdjustmentDelta,
    DispatchId,
    ReferenceNumber,
    Remarks,
    PerformedBy,
    CreatedAt,
}

#[derive(DeriveIden)]
enum StockBalances {
    Table,
    ProductId,
    QuantityOnHand,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum Products {
    Table,
    Id,
}

#[derive(DeriveIden)]
enum Dispatches {
    Table,
    Id,
}

#[derive(DeriveIden)]
enum Users {
    Table,
    Id,
}
