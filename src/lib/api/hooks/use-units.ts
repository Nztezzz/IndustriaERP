import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import * as unitsApi from "@/lib/api/units"
import { queryKeys } from "@/lib/api/query-keys"
import { ApiError } from "@/lib/api/client"

export function useUnits() {
  return useQuery({
    queryKey: queryKeys.units.all(),
    queryFn: unitsApi.fetchUnits,
  })
}

export function useCreateUnit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: unitsApi.createUnit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.units.all() })
      toast.success("Unit created")
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to create unit")
    },
  })
}

export function useUpdateUnit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: unitsApi.UnitInput }) =>
      unitsApi.updateUnit(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.units.all() })
      toast.success("Unit updated")
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to update unit")
    },
  })
}

export function useDeleteUnit() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: unitsApi.deleteUnit,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.units.all() })
      toast.success("Unit deleted")
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to delete unit")
    },
  })
}
