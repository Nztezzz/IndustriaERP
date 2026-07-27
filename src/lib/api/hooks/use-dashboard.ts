import { useQuery } from "@tanstack/react-query"
import * as dashboardApi from "@/lib/api/dashboard"
import { queryKeys } from "@/lib/api/query-keys"

export function useDashboardSummary() {
  return useQuery({
    queryKey: queryKeys.dashboard.summary(),
    queryFn: dashboardApi.fetchDashboardSummary,
    // Dashboard is the "at a glance" landing page -- refresh periodically
    // so counts don't go stale while it's left open in the background.
    refetchInterval: 30_000,
  })
}

export function useRecentActivity() {
  return useQuery({
    queryKey: queryKeys.dashboard.activity(),
    queryFn: dashboardApi.fetchRecentActivity,
    refetchInterval: 30_000,
  })
}
