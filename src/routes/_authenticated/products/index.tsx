import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { ProductListPage } from "@/features/products/product-list-page"

const productListSearchSchema = z.object({
  q: z.string().optional(),
})

export const Route = createFileRoute("/_authenticated/products/")({
  validateSearch: productListSearchSchema,
  component: ProductListPage,
})
