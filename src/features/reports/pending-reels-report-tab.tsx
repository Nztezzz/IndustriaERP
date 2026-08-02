import { useNavigate } from "@tanstack/react-router"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ExportButtons } from "@/components/export-buttons"
import { ReportTableCard } from "@/features/reports/report-table-card"
import { usePendingReelsReport } from "@/lib/api/hooks/use-reports"
import { parseResponseDateTime } from "@/lib/api/datetime"
import type { ExportColumn } from "@/lib/export"
import type { PendingReelReportRowDto } from "@/lib/api/types"
import type { ReelStatus } from "@/lib/constants"

// Same status->badge-color mapping used by reel-list-page.tsx (task 20)
// and global-search-page.tsx (task 21) -- kept visually consistent
// across every surface that shows a reel status.
const STATUS_VARIANT: Record<ReelStatus, "outline" | "secondary" | "default" | "destructive"> = {
  in_stock: "outline",
  dispatched: "default",
  returned: "secondary",
  lost: "destructive",
  damaged: "destructive",
}

const COLUMNS: ExportColumn<PendingReelReportRowDto>[] = [
  { header: "Reel number", accessor: (r) => r.reelNumber },
  { header: "Product", accessor: (r) => r.productName },
  { header: "Customer", accessor: (r) => r.customerName ?? "" },
  { header: "Status", accessor: (r) => r.status },
  { header: "Since", accessor: (r) => parseResponseDateTime(r.since).toLocaleString() },
]

/**
 * Pending reels report: every reel currently out with a customer,
 * oldest-outstanding first (report_service.rs sorts this server-side --
 * confirmed by reading `pending_reels`, no client-side re-sort needed).
 * Unlike the other 4 reports, this endpoint takes no date-range query
 * param at all (it's a point-in-time snapshot of "what's out right
 * now", not a historical range), so no DateRangeFilter is rendered here.
 */
export function PendingReelsReportTab({
  entryLimit,
  onEntryLimitChange,
}: {
  entryLimit?: number
  onEntryLimitChange?: (limit: number | undefined) => void
}) {
  const navigate = useNavigate()
  const { data, isLoading } = usePendingReelsReport()
  const allRows = data ?? []
  const rows = entryLimit ? allRows.slice(0, entryLimit) : allRows

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Reels currently out with a customer, oldest first.
          </p>
          {onEntryLimitChange && (
            <div className="flex items-center gap-1.5">
              <span className="text-sm text-muted-foreground">Show:</span>
              {[5, 10, undefined].map((limit) => (
                <Button
                  key={limit ?? "all"}
                  variant={entryLimit === limit ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => onEntryLimitChange(limit)}
                >
                  {limit ?? "All"}
                </Button>
              ))}
            </div>
          )}
        </div>
        <ExportButtons
          baseFileName="pending-reels-report"
          title="Pending Reels Report"
          columns={COLUMNS}
          rows={rows}
        />
      </div>

      <ReportTableCard
        isLoading={isLoading}
        isEmpty={rows.length === 0}
        emptyLabel="No reels are currently outstanding."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Reel number</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Since</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.reelNumber}
                className="cursor-pointer"
                onClick={() =>
                  navigate({
                    to: "/reels/$reelNumber",
                    params: { reelNumber: row.reelNumber },
                  })
                }
              >
                <TableCell className="font-medium">{row.reelNumber}</TableCell>
                <TableCell>{row.productName}</TableCell>
                <TableCell className="text-muted-foreground">
                  {row.customerName ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[row.status]} className="capitalize">
                    {row.status.replace("_", " ")}
                  </Badge>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {parseResponseDateTime(row.since).toLocaleString()}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ReportTableCard>
    </div>
  )
}
