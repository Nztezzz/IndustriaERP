import { createFileRoute } from "@tanstack/react-router"
import { OutwardEntryPage } from "@/features/inventory/outward-entry-page"

export const Route = createFileRoute("/_authenticated/inventory/outward")({
  component: OutwardEntryPage,
})
