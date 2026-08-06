import {
  createFileRoute,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router"
import { useEffect } from "react"
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { AppHeader } from "@/components/layout/app-header"
import { useAuthStore } from "@/stores/auth-store"

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
})

/**
 * Gates every route under this pathless layout behind an active session.
 *
 * We intentionally do NOT redirect from `beforeLoad`: the Zustand `persist`
 * middleware rehydrates from disk asynchronously, and redirecting before
 * that finishes would bounce an already-logged-in user to /login on every
 * cold start. Instead we wait for `hasHydrated` and then redirect from an
 * effect, showing nothing in between (the flash is a few ms at most).
 *
 * This is UI gating only, not an authorization boundary -- every API call
 * still carries the JWT and the Rust backend re-validates it independently.
 */
function AuthenticatedLayout() {
  const navigate = useNavigate()
  const token = useAuthStore((s) => s.token)
  const hasHydrated = useAuthStore((s) => s.hasHydrated)
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  useEffect(() => {
    if (hasHydrated && !token) {
      navigate({ to: "/login", replace: true })
    }
  }, [hasHydrated, token, navigate])

  if (!hasHydrated || !token) {
    return null
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        {/*
         * Keying on pathname re-mounts this wrapper on every navigation,
         * which re-triggers the short `page-enter` fade+rise. Cheap way to
         * get page transitions without a route-level animation library.
         */}
        <div key={pathname} className="page-enter flex flex-1 flex-col">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
