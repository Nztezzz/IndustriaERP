use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Customers::Table)
                    .if_not_exists()
                    .col(pk_uuid(Customers::Id))
                    .col(string(Customers::Name))
                    .col(string_null(Customers::ContactPerson))
                    .col(string_null(Customers::Phone))
                    .col(string_null(Customers::Email))
                    .col(text_null(Customers::Address))
                    .col(string_null(Customers::GstNumber))
                    .col(boolean(Customers::IsActive).default(true))
                    .col(timestamp(Customers::CreatedAt).default(Expr::current_timestamp()))
                    .col(timestamp(Customers::UpdatedAt).default(Expr::current_timestamp()))
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .if_not_exists()
                    .name("idx_customers_name")
                    .table(Customers::Table)
                    .col(Customers::Name)
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Customers::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Customers {
    Table,
    Id,
    Name,
    ContactPerson,
    Phone,
    Email,
    Address,
    GstNumber,
    IsActive,
    CreatedAt,
    UpdatedAt,
}
