import { useQuery } from "@tanstack/react-query"
import * as reportsApi from "@/lib/api/reports"
import { queryKeys } from "@/lib/api/query-keys"

export function useProductWiseReport(query: reportsApi.ReportRangeQuery = {}) {
  return useQuery({
    queryKey: queryKeys.reports.productWise(query),
    queryFn: () => reportsApi.fetchProductWiseReport(query),
  })
}

export function useCustomerWiseReport(query: reportsApi.ReportRangeQuery = {}) {
  return useQuery({
    queryKey: queryKeys.reports.customerWise(query),
    queryFn: () => reportsApi.fetchCustomerWiseReport(query),
  })
}

export function useDailyActivityReport(query: reportsApi.ReportRangeQuery = {}) {
  return useQuery({
    queryKey: queryKeys.reports.dailyActivity(query),
    queryFn: () => reportsApi.fetchDailyActivityReport(query),
  })
}

export function useDispatchReport(query: reportsApi.ReportRangeQuery = {}) {
  return useQuery({
    queryKey: queryKeys.reports.dispatches(query),
    queryFn: () => reportsApi.fetchDispatchReport(query),
  })
}
