/**
 * Central registry of TanStack Query key factories. Keeping these in one
 * file (rather than inlining array literals at each call site) is what
 * makes cross-module invalidation reliable -- e.g. creating a dispatch
 * needs to invalidate stock balances AND dashboard summary,
 * and it's easy to typo an inline key but hard to typo a function call.
 */
import type { AuditLogQuery } from "@/lib/api/audit-log"
import type { DispatchListQuery } from "@/lib/api/dispatches"
import type { MovementsQuery } from "@/lib/api/stock"
import type { ReportRangeQuery } from "@/lib/api/reports"

export const queryKeys = {
  units: {
    all: () => ["units"] as const,
  },
  products: {
    all: (includeInactive?: boolean) =>
      ["products", { includeInactive }] as const,
    detail: (id: string) => ["products", "detail", id] as const,
  },
  customers: {
    all: (includeInactive?: boolean) =>
      ["customers", { includeInactive }] as const,
    detail: (id: string) => ["customers", "detail", id] as const,
  },
  stock: {
    balances: () => ["stock", "balances"] as const,
    movements: (query: MovementsQuery = {}) =>
      ["stock", "movements", query] as const,
  },
  dispatches: {
    all: (query: DispatchListQuery = {}) => ["dispatches", query] as const,
    detail: (id: string) => ["dispatches", "detail", id] as const,
  },
  dashboard: {
    summary: () => ["dashboard", "summary"] as const,
    activity: () => ["dashboard", "activity"] as const,
  },
  search: {
    results: (query: string) => ["search", query] as const,
  },
  reports: {
    productWise: (query: ReportRangeQuery = {}) =>
      ["reports", "product-wise", query] as const,
    customerWise: (query: ReportRangeQuery = {}) =>
      ["reports", "customer-wise", query] as const,
    dailyActivity: (query: ReportRangeQuery = {}) =>
      ["reports", "daily-activity", query] as const,
    dispatches: (query: ReportRangeQuery = {}) =>
      ["reports", "dispatches", query] as const,
  },
  auditLog: {
    all: (query: AuditLogQuery = {}) => ["audit-log", query] as const,
  },
  backup: {
    all: () => ["backup"] as const,
  },
}
