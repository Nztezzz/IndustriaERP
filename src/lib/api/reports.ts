import { apiRequest } from "@/lib/api/client"
import type {
  CustomerDispatchSummaryDto,
  DailyActivitySummaryDto,
  DispatchReportRowDto,
  LedgerEntryDto,
  ProductMovementSummaryDto,
} from "@/lib/api/types"

export interface ReportRangeQuery {
  /** "yyyy-MM-ddTHH:mm:ss" -- use `toRequestDateTime` to build this. */
  from?: string
  to?: string
  // Index signature so this satisfies apiRequest's generic query bag type.
  [key: string]: string | number | boolean | undefined | null
}

export interface LedgerQuery extends ReportRangeQuery {
  customerId?: string
}

export function fetchProductWiseReport(query: ReportRangeQuery = {}) {
  return apiRequest<ProductMovementSummaryDto[]>("/reports/product-wise", {
    query,
  })
}

export function fetchCustomerWiseReport(query: ReportRangeQuery = {}) {
  return apiRequest<CustomerDispatchSummaryDto[]>("/reports/customer-wise", {
    query,
  })
}

export function fetchDailyActivityReport(query: ReportRangeQuery = {}) {
  return apiRequest<DailyActivitySummaryDto[]>("/reports/daily-activity", {
    query,
  })
}

export function fetchDispatchReport(query: ReportRangeQuery = {}) {
  return apiRequest<DispatchReportRowDto[]>("/reports/dispatches", { query })
}

export function fetchLedger(query: LedgerQuery = {}) {
  return apiRequest<LedgerEntryDto[]>("/reports/ledger", { query })
}
