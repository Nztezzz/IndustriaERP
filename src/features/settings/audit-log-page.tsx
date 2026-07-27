import { useState } from "react"
import { ScrollText, X } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { RequireRole } from "@/components/layout/require-role"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useAuditLog } from "@/lib/api/hooks/use-audit-log"
import { parseResponseDateTime } from "@/lib/api/datetime"
import { useDebouncedValue } from "@/hooks/use-debounced-value"

export function AuditLogPage() {
  return (
    <>
      <PageHeader
        title="Audit Log"
        description="Full history of manual stock adjustments and other sensitive actions."
      />
      <RequireRole minRole="admin">
        <AuditLogContent />
      </RequireRole>
    </>
  )
}

/**
 * Split into its own inner component (same pattern as task 18's inward
 * entry page and task 23's backup-restore page) so the data hook only
 * runs once the RequireRole check above has actually passed.
 */
function AuditLogContent() {
  const [entityTypeInput, setEntityTypeInput] = useState("")
  const entityType = useDebouncedValue(entityTypeInput.trim(), 300)

  const { data, isLoading } = useAuditLog({
    entityType: entityType || undefined,
  })

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Filter by entity type (e.g. stock_adjustment)"
          value={entityTypeInput}
          onChange={(e) => setEntityTypeInput(e.target.value)}
          className="w-72"
        />
        {entityTypeInput && (
          <Button variant="ghost" size="sm" onClick={() => setEntityTypeInput("")}>
            <X />
            Clear
          </Button>
        )}
        <span className="text-sm text-muted-foreground">
          Showing the most recent {data?.length ?? "…"} entries
        </span>
      </div>

      <Card>
        <CardContent className="px-0">
          {isLoading ? (
            <div className="flex flex-col gap-3 px-4 py-2">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-full" />
              ))}
            </div>
          ) : !data || data.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
              <ScrollText className="size-8" />
              <p className="text-sm">
                {entityType
                  ? "No audit entries match this filter."
                  : "No audit entries recorded yet."}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>Entity</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Performed by</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="text-muted-foreground">
                      {parseResponseDateTime(entry.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <Badge variant="outline" className="w-fit capitalize">
                          {entry.entityType.replace(/_/g, " ")}
                        </Badge>
                        <span
                          className="max-w-48 truncate text-xs text-muted-foreground"
                          title={entry.entityId}
                        >
                          {entry.entityId}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="capitalize">{entry.action}</TableCell>
                    <TableCell className="font-medium">
                      {entry.performedByUsername}
                    </TableCell>
                    <TableCell className="max-w-sm text-muted-foreground">
                      {entry.changesSummary ?? "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
