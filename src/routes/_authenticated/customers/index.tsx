import { createFileRoute } from "@tanstack/react-router"
import { CustomerListPage } from "@/features/customers/customer-list-page"

export const Route = createFileRoute("/_authenticated/customers/")({
  component: CustomerListPage,
})
