use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(PackingSlips::Table)
                    .if_not_exists()
                    .col(uuid(PackingSlips::Id).primary_key())
                    .col(string(PackingSlips::PartyName))
                    .col(string(PackingSlips::InvoiceNo))
                    .col(string(PackingSlips::Date))
                    .col(string_null(PackingSlips::TempoNo))
                    .col(string_null(PackingSlips::TotalParcel))
                    .col(json(PackingSlips::LineItems))
                    .col(float(PackingSlips::TotalGross))
                    .col(float(PackingSlips::TotalTare))
                    .col(float(PackingSlips::TotalNet))
                    .col(uuid(PackingSlips::CreatedBy))
                    .col(timestamp(PackingSlips::CreatedAt).default(Expr::current_timestamp()))
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(PackingSlips::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum PackingSlips {
    Table,
    Id,
    PartyName,
    InvoiceNo,
    Date,
    TempoNo,
    TotalParcel,
    LineItems,
    TotalGross,
    TotalTare,
    TotalNet,
    CreatedBy,
    CreatedAt,
}
