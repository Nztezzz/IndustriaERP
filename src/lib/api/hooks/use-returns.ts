import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import * as returnsApi from "@/lib/api/returns"
import { queryKeys } from "@/lib/api/query-keys"
import { ApiError } from "@/lib/api/client"

export function useReturnableItems(dispatchId: string | undefined) {
  return useQuery({
    queryKey: ["returns", "returnable", dispatchId ?? ""],
    queryFn: () => returnsApi.fetchReturnableItems(dispatchId!),
    enabled: !!dispatchId,
  })
}

export function useCreateReturn() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: returnsApi.createReturn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dispatches"] })
      queryClient.invalidateQueries({ queryKey: queryKeys.stock.balances() })
      queryClient.invalidateQueries({ queryKey: ["stock", "movements"] })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary() })
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.activity() })
      queryClient.invalidateQueries({ queryKey: ["returns"] })
      toast.success("Return recorded successfully")
    },
    onError: (error) => {
      toast.error(
        error instanceof ApiError ? error.message : "Failed to record return"
      )
    },
  })
}
