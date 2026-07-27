import { AlertTriangle } from "lucide-react"
import { hasMinRole, type Role } from "@/lib/constants"
import { useAuthStore } from "@/stores/auth-store"

/**
 * Renders `children` only if the current user meets `minRole`, otherwise
 * shows an inline "not authorized" message. Use this to gate page content
 * for admin/operator-only actions (e.g. inward entry forms on a page that
 * viewers can still open in read-only mode).
 *
 * This is a UX convenience only. The Rust backend enforces RBAC on every
 * endpoint independently, so hiding a button here never substitutes for a
 * server-side permission check.
 */
export function RequireRole({
  minRole,
  children,
  fallback,
}: {
  minRole: Role
  children: React.ReactNode
  fallback?: React.ReactNode
}) {
  const role = useAuthStore((s) => s.user?.role)

  if (!hasMinRole(role, minRole)) {
    return (
      fallback ?? (
        <div className="flex items-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
          <AlertTriangle className="size-4" />
          You don&apos;t have permission to perform this action.
        </div>
      )
    )
  }

  return <>{children}</>
}
