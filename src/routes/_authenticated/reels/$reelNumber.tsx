import { createFileRoute } from "@tanstack/react-router"
import { ReelDetailPage } from "@/features/reels/reel-detail-page"

export const Route = createFileRoute("/_authenticated/reels/$reelNumber")({
  component: ReelDetailPage,
})
