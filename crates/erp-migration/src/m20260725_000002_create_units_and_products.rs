use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Units::Table)
                    .if_not_exists()
                    .col(pk_uuid(Units::Id))
                    .col(string_uniq(Units::Name))
                    .col(string_uniq(Units::Symbol))
                    // Multiplier to convert 1 of this unit into the product's
                    // base unit (e.g. 1 "roll" = 500 "meters" -> 500.0). Kept
                    // as a plain float since reel/stock weights are never
                    // financial values requiring exact decimal arithmetic.
                    .col(float(Units::ConversionFactor).default(1.0))
                    .col(timestamp(Units::CreatedAt).default(Expr::current_timestamp()))
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(Products::Table)
                    .if_not_exists()
                    .col(pk_uuid(Products::Id))
                    .col(string_uniq(Products::Sku))
                    .col(string(Products::Name))
                    .col(text_null(Products::Description))
                    .col(uuid(Products::BaseUnitId))
                    // Free-form key/value spec sheet (e.g. GSM, width, core
                    // diameter for paper reels) stored as JSON so new
                    // product categories don't require schema changes.
                    .col(json_null(Products::Specifications))
                    .col(double(Products::ReorderLevel).default(0.0))
                    .col(boolean(Products::IsActive).default(true))
                    .col(timestamp(Products::CreatedAt).default(Expr::current_timestamp()))
                    .col(timestamp(Products::UpdatedAt).default(Expr::current_timestamp()))
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_products_base_unit")
                            .from(Products::Table, Products::BaseUnitId)
                            .to(Units::Table, Units::Id)
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
                    .name("idx_products_name")
                    .table(Products::Table)
                    .col(Products::Name)
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Products::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Units::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Units {
    Table,
    Id,
    Name,
    Symbol,
    ConversionFactor,
    CreatedAt,
}

#[derive(DeriveIden)]
enum Products {
    Table,
    Id,
    Sku,
    Name,
    Description,
    BaseUnitId,
    Specifications,
    ReorderLevel,
    IsActive,
    CreatedAt,
    UpdatedAt,
}
