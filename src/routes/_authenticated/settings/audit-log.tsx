import { createFileRoute } from "@tanstack/react-router"
import { AuditLogPage } from "@/features/settings/audit-log-page"

export const Route = createFileRoute("/_authenticated/settings/audit-log")({
  component: AuditLogPage,
})
