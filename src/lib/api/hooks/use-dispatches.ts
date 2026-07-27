import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import * as dispatchesApi from "@/lib/api/dispatches"
import { queryKeys } from "@/lib/api/query-keys"
import { ApiError } from "@/lib/api/client"

export function useDispatches(query: dispatchesApi.DispatchListQuery = {}) {
  return useQuery({
    queryKey: queryKeys.dispatches.all(query),
    queryFn: () => dispatchesApi.fetchDispatches(query),
  })
}

export function useDispatch(id: string | undefined) {
  return useQuery({
    queryKey: queryKeys.dispatches.detail(id ?? ""),
    queryFn: () => dispatchesApi.fetchDispatch(id!),
    enabled: !!id,
  })
}

/**
 * Creating a dispatch atomically records stock outward movements and
 * transitions any included reels to `dispatched` on the backend -- so on
 * success we invalidate every view those changes touch: dispatch lists,
 * stock balances/movements, reel lists, and the dashboard.
 */
export function useCreateDispatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: dispatchesApi.createDispatch,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dispatches"] })
      queryClient.invalidateQueries({ queryKey: queryKeys.stock.balances() })
      queryClient.invalidateQueries({ queryKey: ["stock", "movements"] })
      queryClient.invalidateQueries({ queryKey: ["reels"] })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary() })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.activity() })
      toast.success("Dispatch created")
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to create dispatch")
    },
  })
}
