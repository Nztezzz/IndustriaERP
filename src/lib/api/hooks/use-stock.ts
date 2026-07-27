import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import * as stockApi from "@/lib/api/stock"
import { queryKeys } from "@/lib/api/query-keys"
import { ApiError } from "@/lib/api/client"

export function useStockBalances() {
  return useQuery({
    queryKey: queryKeys.stock.balances(),
    queryFn: stockApi.fetchStockBalances,
  })
}

export function useStockMovements(query: stockApi.MovementsQuery = {}) {
  return useQuery({
    queryKey: queryKeys.stock.movements(query),
    queryFn: () => stockApi.fetchStockMovements(query),
  })
}

/** Any stock movement affects balances, movement history, AND the dashboard. */
function invalidateStockRelated(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: queryKeys.stock.balances() })
  queryClient.invalidateQueries({ queryKey: ["stock", "movements"] })
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary() })
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.activity() })
}

export function useRecordInward() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: stockApi.recordInward,
    onSuccess: () => {
      invalidateStockRelated(queryClient)
      toast.success("Inward entry recorded")
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to record inward entry")
    },
  })
}

export function useRecordOutward() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: stockApi.recordOutward,
    onSuccess: () => {
      invalidateStockRelated(queryClient)
      toast.success("Outward entry recorded")
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to record outward entry")
    },
  })
}

export function useRecordAdjustment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: stockApi.recordAdjustment,
    onSuccess: () => {
      invalidateStockRelated(queryClient)
      queryClient.invalidateQueries({ queryKey: ["audit-log"] })
      toast.success("Stock adjustment recorded")
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to record adjustment")
    },
  })
}
