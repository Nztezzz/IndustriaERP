import { apiRequest } from "@/lib/api/client"
import type { ProductDto } from "@/lib/api/types"

export interface ProductInput {
  sku: string
  name: string
  description?: string | null
  baseUnitId: string
  specifications?: Record<string, string> | null
  reorderLevel: number
  isActive?: boolean
}

export function fetchProducts(includeInactive = false) {
  return apiRequest<ProductDto[]>("/products", {
    query: { includeInactive },
  })
}

export function fetchProduct(id: string) {
  return apiRequest<ProductDto>(`/products/${id}`)
}

export function createProduct(input: ProductInput) {
  return apiRequest<ProductDto>("/products", { method: "POST", body: input })
}

export function updateProduct(id: string, input: ProductInput) {
  return apiRequest<ProductDto>(`/products/${id}`, {
    method: "PUT",
    body: input,
  })
}

export function deactivateProduct(id: string) {
  return apiRequest<ProductDto>(`/products/${id}/deactivate`, {
    method: "POST",
  })
}
