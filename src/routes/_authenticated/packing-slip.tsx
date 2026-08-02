import { createFileRoute } from "@tanstack/react-router"
import { PackingSlipPage } from "@/features/packing-slip/packing-slip-page"

export const Route = createFileRoute("/_authenticated/packing-slip")({
  component: PackingSlipPage,
})
