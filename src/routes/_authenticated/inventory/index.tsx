import { createFileRoute } from "@tanstack/react-router"
import { StockOverviewPage } from "@/features/inventory/stock-overview-page"

export const Route = createFileRoute("/_authenticated/inventory/")({
  component: StockOverviewPage,
})
