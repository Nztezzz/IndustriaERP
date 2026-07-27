import { apiRequest } from "@/lib/api/client"
import type { AuditLogDto } from "@/lib/api/types"

export interface AuditLogQuery {
  entityType?: string
  performedBy?: string
  limit?: number
  // Index signature so this satisfies apiRequest's generic query bag type.
  [key: string]: string | number | boolean | undefined | null
}

export function fetchAuditLog(query: AuditLogQuery = {}) {
  return apiRequest<AuditLogDto[]>("/audit-log", { query })
}
