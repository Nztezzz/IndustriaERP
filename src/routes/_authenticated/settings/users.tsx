import { createFileRoute } from "@tanstack/react-router"
import { UserManagementPage } from "@/features/settings/user-management-page"

export const Route = createFileRoute("/_authenticated/settings/users")({
  component: UserManagementPage,
})
