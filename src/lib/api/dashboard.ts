import { apiRequest } from "@/lib/api/client"
import type { ActivityEntryDto, DashboardSummaryDto } from "@/lib/api/types"

export function fetchDashboardSummary() {
  return apiRequest<DashboardSummaryDto>("/dashboard/summary")
}

export function fetchRecentActivity() {
  return apiRequest<ActivityEntryDto[]>("/dashboard/activity")
}
