import { createFileRoute } from "@tanstack/react-router"
import { InwardEntryPage } from "@/features/inventory/inward-entry-page"

export const Route = createFileRoute("/_authenticated/inventory/inward")({
  component: InwardEntryPage,
})
