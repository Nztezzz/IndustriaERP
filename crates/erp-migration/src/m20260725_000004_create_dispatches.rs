use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Dispatches::Table)
                    .if_not_exists()
                    .col(pk_uuid(Dispatches::Id))
                    .col(string_uniq(Dispatches::InvoiceNumber))
                    .col(uuid(Dispatches::CustomerId))
                    .col(string_null(Dispatches::VehicleNumber))
                    .col(string_null(Dispatches::DriverName))
                    .col(string_null(Dispatches::DriverPhone))
                    .col(date_time(Dispatches::DispatchDate))
                    // pending | delivered | cancelled -- see erp_core::domain::DispatchStatus.
                    // Stored as plain text (not a DB-level enum) since SQLite
                    // has no native enum type; the Rust layer is the source
                    // of truth for valid values via a `validator` check.
                    .col(string(Dispatches::Status).default("pending"))
                    .col(double_null(Dispatches::TotalWeightKg))
                    .col(text_null(Dispatches::Remarks))
                    .col(uuid(Dispatches::CreatedBy))
                    .col(timestamp(Dispatches::CreatedAt).default(Expr::current_timestamp()))
                    .col(timestamp(Dispatches::UpdatedAt).default(Expr::current_timestamp()))
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_dispatches_customer")
                            .from(Dispatches::Table, Dispatches::CustomerId)
                            .to(Customers::Table, Customers::Id)
                            .on_update(ForeignKeyAction::Cascade)
                            .on_delete(ForeignKeyAction::Restrict),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_dispatches_created_by")
                            .from(Dispatches::Table, Dispatches::CreatedBy)
                            .to(Users::Table, Users::Id)
                            .on_update(ForeignKeyAction::Cascade)
                            .on_delete(ForeignKeyAction::Restrict),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(DispatchItems::Table)
                    .if_not_exists()
                    .col(pk_uuid(DispatchItems::Id))
                    .col(uuid(DispatchItems::DispatchId))
                    .col(uuid(DispatchItems::ProductId))
                    .col(double(DispatchItems::Quantity))
                    .col(double_null(DispatchItems::WeightKg))
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_dispatch_items_dispatch")
                            .from(DispatchItems::Table, DispatchItems::DispatchId)
                            .to(Dispatches::Table, Dispatches::Id)
                            .on_update(ForeignKeyAction::Cascade)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_dispatch_items_product")
                            .from(DispatchItems::Table, DispatchItems::ProductId)
                            .to(Products::Table, Products::Id)
                            .on_update(ForeignKeyAction::Cascade)
                            .on_delete(ForeignKeyAction::Restrict),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_dispatches_customer")
                    .table(Dispatches::Table)
                    .col(Dispatches::CustomerId)
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_dispatches_date")
                    .table(Dispatches::Table)
                    .col(Dispatches::DispatchDate)
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(DispatchItems::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Dispatches::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Dispatches {
    Table,
    Id,
    InvoiceNumber,
    CustomerId,
    VehicleNumber,
    DriverName,
    DriverPhone,
    DispatchDate,
    Status,
    TotalWeightKg,
    Remarks,
    CreatedBy,
    CreatedAt,
    UpdatedAt,
}

#[derive(DeriveIden)]
enum DispatchItems {
    Table,
    Id,
    DispatchId,
    ProductId,
    Quantity,
    WeightKg,
}

#[derive(DeriveIden)]
enum Customers {
    Table,
    Id,
}

#[derive(DeriveIden)]
enum Products {
    Table,
    Id,
}

#[derive(DeriveIden)]
enum Users {
    Table,
    Id,
}
