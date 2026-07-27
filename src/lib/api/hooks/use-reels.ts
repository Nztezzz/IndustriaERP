import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import * as reelsApi from "@/lib/api/reels"
import { queryKeys } from "@/lib/api/query-keys"
import { ApiError } from "@/lib/api/client"

export function useReels(query: reelsApi.ReelListQuery = {}) {
  return useQuery({
    queryKey: queryKeys.reels.all(query),
    queryFn: () => reelsApi.fetchReels(query),
  })
}

export function useReel(reelNumber: string | undefined) {
  return useQuery({
    queryKey: queryKeys.reels.detail(reelNumber ?? ""),
    queryFn: () => reelsApi.fetchReel(reelNumber!),
    enabled: !!reelNumber,
  })
}

export function useReelHistory(reelNumber: string | undefined) {
  return useQuery({
    queryKey: queryKeys.reels.history(reelNumber ?? ""),
    queryFn: () => reelsApi.fetchReelHistory(reelNumber!),
    enabled: !!reelNumber,
  })
}

function invalidateReels(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["reels"] })
  queryClient.invalidateQueries({ queryKey: queryKeys.dashboard.summary() })
}

export function useRegisterReel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: reelsApi.registerReel,
    onSuccess: () => {
      invalidateReels(queryClient)
      toast.success("Reel registered")
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to register reel")
    },
  })
}

export function useReturnReel() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ reelNumber, remarks }: { reelNumber: string; remarks?: string | null }) =>
      reelsApi.returnReel(reelNumber, remarks),
    onSuccess: (_, { reelNumber }) => {
      invalidateReels(queryClient)
      queryClient.invalidateQueries({ queryKey: queryKeys.reels.history(reelNumber) })
      toast.success("Reel marked as returned")
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to return reel")
    },
  })
}

export function useMarkReelLost() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ reelNumber, remarks }: { reelNumber: string; remarks: string }) =>
      reelsApi.markReelLost(reelNumber, remarks),
    onSuccess: (_, { reelNumber }) => {
      invalidateReels(queryClient)
      queryClient.invalidateQueries({ queryKey: queryKeys.reels.history(reelNumber) })
      toast.success("Reel marked as lost")
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to mark reel lost")
    },
  })
}

export function useMarkReelDamaged() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ reelNumber, remarks }: { reelNumber: string; remarks: string }) =>
      reelsApi.markReelDamaged(reelNumber, remarks),
    onSuccess: (_, { reelNumber }) => {
      invalidateReels(queryClient)
      queryClient.invalidateQueries({ queryKey: queryKeys.reels.history(reelNumber) })
      toast.success("Reel marked as damaged")
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to mark reel damaged")
    },
  })
}
