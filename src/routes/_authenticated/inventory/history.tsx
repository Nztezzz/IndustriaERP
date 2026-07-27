import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { StockHistoryPage } from "@/features/inventory/stock-history-page"
import { STOCK_MOVEMENT_TYPES } from "@/lib/constants"

const historySearchSchema = z.object({
  productId: z.string().optional(),
  movementType: z.enum(STOCK_MOVEMENT_TYPES).optional(),
})

export const Route = createFileRoute("/_authenticated/inventory/history")({
  validateSearch: historySearchSchema,
  component: StockHistoryPage,
})
