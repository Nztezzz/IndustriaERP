import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { DispatchStatusBadge } from "@/components/ui/status-badge"
import { ExportButtons } from "@/components/export-buttons"
import { ReportTableCard } from "@/features/reports/report-table-card"
import { DateRangeFilter, toReportRangeQuery, type ReportDateRange } from "@/features/reports/date-range-filter"
import { useDispatchReport } from "@/lib/api/hooks/use-reports"
import { parseResponseDateTime } from "@/lib/api/datetime"
import { sumBy, type ExportColumn } from "@/lib/export"
import { DISPATCH_STATUS_LABEL } from "@/lib/constants"
import type { DispatchReportRowDto } from "@/lib/api/types"

const COLUMNS: ExportColumn<DispatchReportRowDto>[] = [
  {
    header: "Invoice",
    accessor: (r) => r.invoiceNumber,
    // Row count belongs on the first column so the TOTAL row reads
    // "3 dispatches" rather than an unexplained bare number.
    total: (rows) => `TOTAL (${rows.length})`,
  },
  { header: "Customer", accessor: (r) => r.customerName },
  { header: "Dispatch date", accessor: (r) => parseResponseDateTime(r.dispatchDate).toLocaleString() },
  { header: "Status", accessor: (r) => DISPATCH_STATUS_LABEL[r.status] ?? r.status },
  {
    header: "Weight (kg)",
    accessor: (r) => r.totalWeightKg,
    total: (rows) => sumBy(rows, (r) => r.totalWeightKg),
  },
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
  entryLimit,
  onEntryLimitChange,
}: {
  range: ReportDateRange
  onRangeChange: (range: ReportDateRange) => void
  entryLimit?: number
  onEntryLimitChange?: (limit: number | undefined) => void
}) {
  const { data, isLoading } = useDispatchReport(toReportRangeQuery(range))
  const allRows = data ?? []
  const rows = entryLimit ? allRows.slice(0, entryLimit) : allRows

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <DateRangeFilter value={range} onChange={onRangeChange} showEntryLimit entryLimit={entryLimit} onEntryLimitChange={onEntryLimitChange} />
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
                  <DispatchStatusBadge status={row.status} />
                </TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">
                  {row.totalWeightKg ? `${row.totalWeightKg} kg` : "—"}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t-2 bg-muted/50 font-bold">
              <TableCell colSpan={4}>TOTAL ({rows.length})</TableCell>
              <TableCell className="text-right tabular-nums">
                {sumBy(rows, (r) => r.totalWeightKg)} kg
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </ReportTableCard>
    </div>
  )
}
