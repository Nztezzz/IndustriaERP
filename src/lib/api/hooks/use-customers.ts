import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import * as customersApi from "@/lib/api/customers"
import { queryKeys } from "@/lib/api/query-keys"
import { ApiError } from "@/lib/api/client"

export function useCustomers(includeInactive = false) {
  return useQuery({
    queryKey: queryKeys.customers.all(includeInactive),
    queryFn: () => customersApi.fetchCustomers(includeInactive),
  })
}

export function useCustomer(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.customers.detail(id ?? ""),
    queryFn: () => customersApi.fetchCustomer(id!),
    enabled: !!id,
  })
}

export function useCreateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: customersApi.createCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] })
      toast.success("Customer created")
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to create customer")
    },
  })
}

export function useUpdateCustomer() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: customersApi.CustomerInput }) =>
      customersApi.updateCustomer(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] })
      toast.success("Customer updated")
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to update customer")
    },
  })
}
