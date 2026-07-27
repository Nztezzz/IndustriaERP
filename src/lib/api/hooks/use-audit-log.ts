import { useQuery } from "@tanstack/react-query"
import * as auditLogApi from "@/lib/api/audit-log"
import { queryKeys } from "@/lib/api/query-keys"

export function useAuditLog(query: auditLogApi.AuditLogQuery = {}) {
  return useQuery({
    queryKey: queryKeys.auditLog.all(query),
    queryFn: () => auditLogApi.fetchAuditLog(query),
  })
}
