import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import * as productsApi from "@/lib/api/products"
import { queryKeys } from "@/lib/api/query-keys"
import { ApiError } from "@/lib/api/client"

export function useProducts(includeInactive = false) {
  return useQuery({
    queryKey: queryKeys.products.all(includeInactive),
    queryFn: () => productsApi.fetchProducts(includeInactive),
  })
}

export function useProduct(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.products.detail(id ?? ""),
    queryFn: () => productsApi.fetchProduct(id!),
    enabled: !!id,
  })
}

function invalidateProducts(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["products"] })
  // Product changes (reorder level, active status) affect the balances view.
  queryClient.invalidateQueries({ queryKey: queryKeys.stock.balances() })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: productsApi.createProduct,
    onSuccess: () => {
      invalidateProducts(queryClient)
      toast.success("Product created")
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to create product")
    },
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: productsApi.ProductInput }) =>
      productsApi.updateProduct(id, input),
    onSuccess: () => {
      invalidateProducts(queryClient)
      toast.success("Product updated")
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to update product")
    },
  })
}

export function useDeactivateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: productsApi.deactivateProduct,
    onSuccess: () => {
      invalidateProducts(queryClient)
      toast.success("Product deactivated")
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to deactivate product")
    },
  })
}
