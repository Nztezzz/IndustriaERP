import { createFileRoute } from "@tanstack/react-router"
import { StockAdjustmentsPage } from "@/features/inventory/stock-adjustments-page"

export const Route = createFileRoute("/_authenticated/inventory/adjustments")({
  component: StockAdjustmentsPage,
})
