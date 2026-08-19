import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ExportButtons } from "@/components/export-buttons"
import { ReportTableCard } from "@/features/reports/report-table-card"
import { DateRangeFilter, toReportRangeQuery, type ReportDateRange } from "@/features/reports/date-range-filter"
import { useProductWiseReport } from "@/lib/api/hooks/use-reports"
import { sumBy, type ExportColumn } from "@/lib/export"
import type { ProductMovementSummaryDto } from "@/lib/api/types"

/**
 * Net stock change for a product: what came in, minus what went out to
 * customers, plus what customers sent back, plus any manual correction.
 *
 * Returns add back because the goods are physically on the shelf again --
 * but they're counted here rather than inside `totalInward`, so the inward
 * figure keeps meaning "produced/received".
 */
function netChange(r: ProductMovementSummaryDto): number {
  return r.totalInward - r.totalOutward + r.totalReturn + r.totalAdjustmentDelta
}

const COLUMNS: ExportColumn<ProductMovementSummaryDto>[] = [
  { header: "SKU", accessor: (r) => r.productSku },
  { header: "Product", accessor: (r) => r.productName },
  {
    header: "Inward",
    accessor: (r) => r.totalInward,
    total: (rows) => sumBy(rows, (r) => r.totalInward),
  },
  {
    header: "Dispatch",
    accessor: (r) => r.totalOutward,
    total: (rows) => sumBy(rows, (r) => r.totalOutward),
  },
  {
    header: "Return",
    accessor: (r) => r.totalReturn,
    total: (rows) => sumBy(rows, (r) => r.totalReturn),
  },
  {
    header: "Adjustments",
    accessor: (r) => r.totalAdjustmentDelta,
    total: (rows) => sumBy(rows, (r) => r.totalAdjustmentDelta),
  },
  {
    header: "Net change",
    accessor: (r) => netChange(r),
    total: (rows) => sumBy(rows, netChange),
  },
]

/**
 * Product-wise movement summary: inward / dispatch / return / adjustment
 * totals per product within the selected date range.
 *
 * "Dispatch" is the operator-facing name for what the ledger stores as
 * `outward` -- dispatching is the only way stock leaves. `Return` is its
 * own column rather than being folded into Inward, so a 20-unit inward
 * still reads 20 after a 3-unit return.
 *
 * The server sends no pre-computed net figure, so `netChange` derives it
 * client-side for the table, the TOTAL row, and all three exports.
 */
export function ProductWiseReportTab({
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
  const { data, isLoading } = useProductWiseReport(toReportRangeQuery(range))
  const allRows = data ?? []
  const rows = entryLimit ? allRows.slice(0, entryLimit) : allRows

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <DateRangeFilter value={range} onChange={onRangeChange} showEntryLimit entryLimit={entryLimit} onEntryLimitChange={onEntryLimitChange} />
        <ExportButtons
          baseFileName="product-wise-report"
          title="Product-wise Movement Report"
          columns={COLUMNS}
          rows={rows}
        />
      </div>

      <ReportTableCard
        isLoading={isLoading}
        isEmpty={rows.length === 0}
        emptyLabel="No stock movements in this date range."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>SKU</TableHead>
              <TableHead>Product</TableHead>
              <TableHead className="text-right">Inward</TableHead>
              <TableHead className="text-right">Dispatch</TableHead>
              <TableHead className="text-right">Return</TableHead>
              <TableHead className="text-right">Adjustments</TableHead>
              <TableHead className="text-right">Net change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const net = netChange(row)
              return (
                <TableRow key={row.productId}>
                  <TableCell className="font-medium">{row.productSku}</TableCell>
                  <TableCell>{row.productName}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.totalInward}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.totalOutward}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.totalReturn}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {row.totalAdjustmentDelta > 0 ? `+${row.totalAdjustmentDelta}` : row.totalAdjustmentDelta}
                  </TableCell>
                  <TableCell
                    className={`text-right tabular-nums font-medium ${net < 0 ? "text-destructive" : ""}`}
                  >
                    {net > 0 ? `+${net}` : net}
                  </TableCell>
                </TableRow>
              )
            })}
            <TableRow className="border-t-2 bg-muted/50 font-bold">
              <TableCell colSpan={2}>TOTAL</TableCell>
              <TableCell className="text-right tabular-nums">
                {sumBy(rows, (r) => r.totalInward)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {sumBy(rows, (r) => r.totalOutward)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {sumBy(rows, (r) => r.totalReturn)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {sumBy(rows, (r) => r.totalAdjustmentDelta)}
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {sumBy(rows, netChange)}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </ReportTableCard>
    </div>
  )
}
