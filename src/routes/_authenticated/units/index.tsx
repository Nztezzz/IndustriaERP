import { createFileRoute } from "@tanstack/react-router"
import { UnitListPage } from "@/features/products/unit-list-page"

export const Route = createFileRoute("/_authenticated/units/")({
  component: UnitListPage,
})
