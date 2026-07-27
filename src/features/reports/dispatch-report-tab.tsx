import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ExportButtons } from "@/components/export-buttons"
import { ReportTableCard } from "@/features/reports/report-table-card"
import { DateRangeFilter, toReportRangeQuery, type ReportDateRange } from "@/features/reports/date-range-filter"
import { useDispatchReport } from "@/lib/api/hooks/use-reports"
import { parseResponseDateTime } from "@/lib/api/datetime"
import type { ExportColumn } from "@/lib/export"
import type { DispatchReportRowDto } from "@/lib/api/types"
import type { DispatchStatus } from "@/lib/constants"

// Same status->badge-color mapping used by dispatch-list-page.tsx (task 19).
const STATUS_VARIANT: Record<DispatchStatus, "outline" | "secondary" | "destructive"> = {
  pending: "outline",
  delivered: "secondary",
  cancelled: "destructive",
}

const COLUMNS: ExportColumn<DispatchReportRowDto>[] = [
  { header: "Invoice", accessor: (r) => r.invoiceNumber },
  { header: "Customer", accessor: (r) => r.customerName },
  { header: "Dispatch date", accessor: (r) => parseResponseDateTime(r.dispatchDate).toLocaleString() },
  { header: "Status", accessor: (r) => r.status },
  { header: "Weight (kg)", accessor: (r) => r.totalWeightKg },
]

/**
 * Dispatch report: every dispatch within the date range with its
 * customer name already resolved server-side (DispatchReportRowDto has
 * `customerName` inline, unlike the lightweight `DispatchListItemDto`
 * used by the main dispatch list -- confirmed by reading reports.rs's
 * own DTO struct directly rather than assuming it matches).
 */
export function DispatchReportTab({
  range,
  onRangeChange,
}: {
  range: ReportDateRange
  onRangeChange: (range: ReportDateRange) => void
}) {
  const { data, isLoading } = useDispatchReport(toReportRangeQuery(range))
  const rows = data ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <DateRangeFilter value={range} onChange={onRangeChange} />
        <ExportButtons
          baseFileName="dispatch-report"
          title="Dispatch Report"
          columns={COLUMNS}
          rows={rows}
        />
      </div>

      <ReportTableCard
        isLoading={isLoading}
        isEmpty={rows.length === 0}
        emptyLabel="No dispatches in this date range."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Invoice</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Dispatch date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Weight</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.invoiceNumber}>
                <TableCell className="font-medium">{row.invoiceNumber}</TableCell>
                <TableCell>{row.customerName}</TableCell>
                <TableCell className="text-muted-foreground">
                  {parseResponseDateTime(row.dispatchDate).toLocaleString()}
                </TableCell>
                <TableCell>
                  <Badge variant={STATUS_VARIANT[row.status]} className="capitalize">
                    {row.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {row.totalWeightKg ? `${row.totalWeightKg} kg` : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ReportTableCard>
    </div>
  )
}
