import { createRootRoute, Outlet } from "@tanstack/react-router"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Toaster } from "@/components/ui/sonner"
import { FirstRunCredentialsDialog } from "@/components/layout/first-run-credentials-dialog"

export const Route = createRootRoute({
  component: RootComponent,
})

function RootComponent() {
  return (
    <TooltipProvider>
      <Outlet />
      <Toaster position="top-right" richColors closeButton />
      <FirstRunCredentialsDialog />
    </TooltipProvider>
  )
}
