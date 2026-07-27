use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // `roles` is a small lookup table rather than a hardcoded enum so an
        // admin can see/audit exactly which roles exist without a code
        // change, and so Postgres sync later can FK against it normally.
        manager
            .create_table(
                Table::create()
                    .table(Roles::Table)
                    .if_not_exists()
                    .col(string(Roles::Name).primary_key())
                    .col(string(Roles::Description))
                    .to_owned(),
            )
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(Users::Table)
                    .if_not_exists()
                    .col(pk_uuid(Users::Id))
                    .col(string_uniq(Users::Username))
                    .col(string(Users::PasswordHash))
                    .col(string(Users::FullName))
                    .col(string(Users::RoleName))
                    .col(boolean(Users::IsActive).default(true))
                    .col(timestamp_null(Users::LastLoginAt))
                    .col(timestamp(Users::CreatedAt).default(Expr::current_timestamp()))
                    .col(timestamp(Users::UpdatedAt).default(Expr::current_timestamp()))
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_users_role")
                            .from(Users::Table, Users::RoleName)
                            .to(Roles::Table, Roles::Name)
                            .on_update(ForeignKeyAction::Cascade)
                            .on_delete(ForeignKeyAction::Restrict),
                    )
                    .to_owned(),
            )
            .await?;

        // Seed the three fixed roles the app ships with. Admins can still
        // add more rows later (e.g. a future "supervisor" role) without a
        // migration, since application code reads roles from this table.
        let db = manager.get_connection();
        for (name, description) in [
            ("admin", "Full access: all modules, user management, backup/restore, audit log."),
            ("operator", "Day-to-day operations: inventory, dispatch, and reel entry."),
            ("viewer", "Read-only access to dashboards, reports, and search."),
        ] {
            db.execute_raw(sea_orm::Statement::from_sql_and_values(
                manager.get_database_backend(),
                r#"INSERT INTO "roles" ("name", "description") VALUES (?, ?)"#,
                [name.into(), description.into()],
            ))
            .await?;
        }

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Users::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(Roles::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Roles {
    Table,
    Name,
    Description,
}

#[derive(DeriveIden)]
enum Users {
    Table,
    Id,
    Username,
    PasswordHash,
    FullName,
    RoleName,
    IsActive,
    LastLoginAt,
    CreatedAt,
    UpdatedAt,
}
