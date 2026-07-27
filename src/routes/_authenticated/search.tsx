import { createFileRoute } from "@tanstack/react-router"
import { GlobalSearchPage } from "@/features/search/global-search-page"

export const Route = createFileRoute("/_authenticated/search")({
  component: GlobalSearchPage,
})
