import { createFileRoute } from "@tanstack/react-router"
import { DispatchDetailPage } from "@/features/dispatches/dispatch-detail-page"

export const Route = createFileRoute(
  "/_authenticated/dispatches/$dispatchId"
)({
  component: DispatchDetailPage,
})
