use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Reels::Table)
                    .if_not_exists()
                    .col(pk_uuid(Reels::Id))
                    // The physical/printed reel number, distinct from the
                    // internal UUID -- this is what staff read off the reel
                    // itself and what search/filters key on.
                    .col(string_uniq(Reels::ReelNumber))
                    .col(uuid(Reels::ProductId))
                    // in_stock | dispatched | returned | lost | damaged
                    // -- see erp_core::domain::ReelStatus.
                    .col(string(Reels::Status).default("in_stock"))
                    // Denormalized "current holder" pointer, updated by
                    // reel_service on every dispatch/return so "customer-wise
                    // reel history" and "pending reels per customer" queries
                    // don't need to reduce over reel_movements every time.
                    // reel_movements remains the append-only source of truth.
                    .col(uuid_null(Reels::CurrentCustomerId))
                    .col(double_null(Reels::WeightKg))
                    .col(timestamp(Reels::CreatedAt).default(Expr::current_timestamp()))
                    .col(timestamp(Reels::UpdatedAt).default(Expr::current_timestamp()))
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_reels_product")
                            .from(Reels::Table, Reels::ProductId)
                            .to(Products::Table, Products::Id)
                            .on_update(ForeignKeyAction::Cascade)
                            .on_delete(ForeignKeyAction::Restrict),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_reels_current_customer")
                            .from(Reels::Table, Reels::CurrentCustomerId)
                            .to(Customers::Table, Customers::Id)
                            .on_update(ForeignKeyAction::Cascade)
                            .on_delete(ForeignKeyAction::SetNull),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(ReelMovements::Table)
                    .if_not_exists()
                    .col(pk_uuid(ReelMovements::Id))
                    .col(uuid(ReelMovements::ReelId))
                    // created | dispatched | returned | lost | damaged
                    .col(string(ReelMovements::EventType))
                    .col(uuid_null(ReelMovements::DispatchId))
                    .col(uuid_null(ReelMovements::CustomerId))
                    .col(text_null(ReelMovements::Remarks))
                    .col(uuid(ReelMovements::PerformedBy))
                    .col(timestamp(ReelMovements::CreatedAt).default(Expr::current_timestamp()))
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_reel_movements_reel")
                            .from(ReelMovements::Table, ReelMovements::ReelId)
                            .to(Reels::Table, Reels::Id)
                            .on_update(ForeignKeyAction::Cascade)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_reel_movements_dispatch")
                            .from(ReelMovements::Table, ReelMovements::DispatchId)
                            .to(Dispatches::Table, Dispatches::Id)
                            .on_update(ForeignKeyAction::Cascade)
                            .on_delete(ForeignKeyAction::SetNull),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_reel_movements_customer")
                            .from(ReelMovements::Table, ReelMovements::CustomerId)
                            .to(Customers::Table, Customers::Id)
                            .on_update(ForeignKeyAction::Cascade)
                            .on_delete(ForeignKeyAction::SetNull),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_reel_movements_performed_by")
                            .from(ReelMovements::Table, ReelMovements::PerformedBy)
                            .to(Users::Table, Users::Id)
                            .on_update(ForeignKeyAction::Cascade)
                            .on_delete(ForeignKeyAction::Restrict),
                    )
                    .to_owned(),
            )
            .await?;

        for (name, table, column) in [
            ("idx_reels_status", Reels::Table, Reels::Status),
            (
                "idx_reels_current_customer",
                Reels::Table,
                Reels::CurrentCustomerId,
            ),
        ] {
            manager
                .create_index(
                    Index::create()
                        .if_not_exists()
                        .name(name)
                        .table(table)
                        .col(column)
                        .to_owned(),
                )
                .await?;
        }

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_reel_movements_reel")
                    .table(ReelMovements::Table)
                    .col(ReelMovements::ReelId)
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(ReelMovements::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Reels::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Reels {
    Table,
    Id,
    ReelNumber,
    ProductId,
    Status,
    CurrentCustomerId,
    WeightKg,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum ReelMovements {
    Table,
    Id,
    ReelId,
    EventType,
    DispatchId,
    CustomerId,
    Remarks,
    PerformedBy,
    CreatedAt,
}

#[derive(DeriveIden)]
enum Products {
    Table,
    Id,
}

#[derive(DeriveIden)]
enum Customers {
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
