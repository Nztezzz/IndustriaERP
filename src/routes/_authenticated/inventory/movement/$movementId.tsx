import { createFileRoute } from "@tanstack/react-router"
import { StockMovementDetailPage } from "@/features/inventory/stock-movement-detail-page"

export const Route = createFileRoute(
  "/_authenticated/inventory/movement/$movementId"
)({
  component: StockMovementDetailPage,
})
