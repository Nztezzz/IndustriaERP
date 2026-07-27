use sea_orm_migration::{prelude::*, schema::*};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        // Generic append-only audit trail covering every sensitive
        // mutation across modules (stock adjustments, user/role changes,
        // reel status overrides, etc.) -- not just inventory. `entity_type`
        // + `entity_id` let the UI show "audit history for this row" on any
        // detail page without a dedicated table per module.
        manager
            .create_table(
                Table::create()
                    .table(AuditLogs::Table)
                    .if_not_exists()
                    .col(pk_uuid(AuditLogs::Id))
                    .col(string(AuditLogs::EntityType))
                    .col(string(AuditLogs::EntityId))
                    .col(string(AuditLogs::Action))
                    .col(uuid(AuditLogs::PerformedBy))
                    .col(json_null(AuditLogs::BeforeState))
                    .col(json_null(AuditLogs::AfterState))
                    .col(text_null(AuditLogs::ChangesSummary))
                    .col(timestamp(AuditLogs::CreatedAt).default(Expr::current_timestamp()))
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_audit_logs_performed_by")
                            .from(AuditLogs::Table, AuditLogs::PerformedBy)
                            .to(Users::Table, Users::Id)
                            .on_update(ForeignKeyAction::Cascade)
                            .on_delete(ForeignKeyAction::Restrict),
                    )
                    .to_owned(),
            )
            .await?;

        // Tracks every backup ever taken (manual or scheduled) so the
        // Backup & Restore page can show history and let an admin pick
        // which snapshot to restore, rather than only ever seeing "latest".
        manager
            .create_table(
                Table::create()
                    .table(Backups::Table)
                    .if_not_exists()
                    .col(pk_uuid(Backups::Id))
                    .col(string(Backups::FilePath))
                    .col(big_integer(Backups::FileSizeBytes))
                    // manual | scheduled
                    .col(string(Backups::TriggerType))
                    .col(uuid_null(Backups::CreatedBy))
                    .col(timestamp(Backups::CreatedAt).default(Expr::current_timestamp()))
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_backups_created_by")
                            .from(Backups::Table, Backups::CreatedBy)
                            .to(Users::Table, Users::Id)
                            .on_update(ForeignKeyAction::Cascade)
                            .on_delete(ForeignKeyAction::SetNull),
                    )
                    .to_owned(),
            )
            .await?;

        for (name, table, column) in [
            (
                "idx_audit_logs_entity",
                AuditLogs::Table,
                AuditLogs::EntityType,
            ),
            (
                "idx_audit_logs_created_at",
                AuditLogs::Table,
                AuditLogs::CreatedAt,
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

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Backups::Table).to_owned())
            .await?;
        manager
            .drop_table(Table::drop().table(AuditLogs::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum AuditLogs {
    Table,
    Id,
    EntityType,
    EntityId,
    Action,
    PerformedBy,
    BeforeState,
    AfterState,
    ChangesSummary,
    CreatedAt,
}

#[derive(DeriveIden)]
enum Backups {
    Table,
    Id,
    FilePath,
    FileSizeBytes,
    TriggerType,
    CreatedBy,
    CreatedAt,
}

#[derive(DeriveIden)]
enum Users {
    Table,
    Id,
}
