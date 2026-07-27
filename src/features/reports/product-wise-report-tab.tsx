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
import type { ExportColumn } from "@/lib/export"
import type { ProductMovementSummaryDto } from "@/lib/api/types"

const COLUMNS: ExportColumn<ProductMovementSummaryDto>[] = [
  { header: "SKU", accessor: (r) => r.productSku },
  { header: "Product", accessor: (r) => r.productName },
  { header: "Total inward", accessor: (r) => r.totalInward },
  { header: "Total outward", accessor: (r) => r.totalOutward },
  { header: "Adjustment delta", accessor: (r) => r.totalAdjustmentDelta },
  { header: "Net change", accessor: (r) => r.totalInward - r.totalOutward + r.totalAdjustmentDelta },
]

/**
 * Product-wise movement summary: total inward/outward/adjustment per
 * product within the selected date range. `ProductMovementSummaryDto`
 * has no pre-computed "net" figure server-side (confirmed by reading
 * report_service.rs directly), so it's derived client-side for both the
 * on-screen table and the export -- inward minus outward plus the
 * signed adjustment delta.
 */
export function ProductWiseReportTab({
  range,
  onRangeChange,
}: {
  range: ReportDateRange
  onRangeChange: (range: ReportDateRange) => void
}) {
  const { data, isLoading } = useProductWiseReport(toReportRangeQuery(range))
  const rows = data ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <DateRangeFilter value={range} onChange={onRangeChange} />
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
              <TableHead className="text-right">Outward</TableHead>
              <TableHead className="text-right">Adjustments</TableHead>
              <TableHead className="text-right">Net change</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => {
              const net = row.totalInward - row.totalOutward + row.totalAdjustmentDelta
              return (
                <TableRow key={row.productId}>
                  <TableCell className="font-medium">{row.productSku}</TableCell>
                  <TableCell>{row.productName}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.totalInward}</TableCell>
                  <TableCell className="text-right tabular-nums">{row.totalOutward}</TableCell>
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
          </TableBody>
        </Table>
      </ReportTableCard>
    </div>
  )
}
