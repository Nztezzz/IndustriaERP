import { PageHeader } from "@/components/layout/page-header"
import { ModulePlaceholder } from "@/components/layout/module-placeholder"
import { RequireRole } from "@/components/layout/require-role"

export function UserManagementPage() {
  return (
    <>
      <PageHeader
        title="Users & Roles"
        description="Manage user accounts and role assignments (Admin only)."
      />
      <RequireRole minRole="admin">
        <ModulePlaceholder note="User/role management is built alongside the auth backend pass." />
      </RequireRole>
    </>
  )
}
