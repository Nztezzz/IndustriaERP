import { createFileRoute } from "@tanstack/react-router"
import { CustomerDetailPage } from "@/features/customers/customer-detail-page"

export const Route = createFileRoute("/_authenticated/customers/$customerId")({
  component: CustomerDetailPage,
})
