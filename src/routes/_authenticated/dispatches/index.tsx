import { createFileRoute } from "@tanstack/react-router"
import { DispatchListPage } from "@/features/dispatches/dispatch-list-page"

export const Route = createFileRoute("/_authenticated/dispatches/")({
  component: DispatchListPage,
})
