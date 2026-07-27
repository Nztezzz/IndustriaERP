import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { ReelListPage } from "@/features/reels/reel-list-page"
import { REEL_STATUSES } from "@/lib/constants"

const reelListSearchSchema = z.object({
  status: z.enum(REEL_STATUSES).optional(),
  customerId: z.string().optional(),
  productId: z.string().optional(),
})

export const Route = createFileRoute("/_authenticated/reels/")({
  validateSearch: reelListSearchSchema,
  component: ReelListPage,
})
