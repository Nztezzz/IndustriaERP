import { createFileRoute } from "@tanstack/react-router"
import { BackupRestorePage } from "@/features/settings/backup-restore-page"

export const Route = createFileRoute("/_authenticated/settings/backup")({
  component: BackupRestorePage,
})
