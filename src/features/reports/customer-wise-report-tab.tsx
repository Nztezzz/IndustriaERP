import { useNavigate } from "@tanstack/react-router"
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
import { useCustomerWiseReport } from "@/lib/api/hooks/use-reports"
import type { ExportColumn } from "@/lib/export"
import type { CustomerDispatchSummaryDto } from "@/lib/api/types"

const COLUMNS: ExportColumn<CustomerDispatchSummaryDto>[] = [
  { header: "Customer", accessor: (r) => r.customerName },
  { header: "Dispatch count", accessor: (r) => r.dispatchCount },
  { header: "Total weight (kg)", accessor: (r) => r.totalWeightKg },
]

/**
 * Customer-wise dispatch summary: dispatch count + total weight per
 * customer, sorted by dispatch count descending server-side (confirmed
 * in report_service.rs). Rows link to the customer detail page, same
 * navigation convention as task 21's search-hit rows.
 */
export function CustomerWiseReportTab({
  range,
  onRangeChange,
}: {
  range: ReportDateRange
  onRangeChange: (range: ReportDateRange) => void
}) {
  const navigate = useNavigate()
  const { data, isLoading } = useCustomerWiseReport(toReportRangeQuery(range))
  const rows = data ?? []

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <DateRangeFilter value={range} onChange={onRangeChange} />
        <ExportButtons
          baseFileName="customer-wise-report"
          title="Customer-wise Dispatch Report"
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
              <TableHead>Customer</TableHead>
              <TableHead className="text-right">Dispatches</TableHead>
              <TableHead className="text-right">Total weight</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.customerId}
                className="cursor-pointer"
                onClick={() =>
                  navigate({
                    to: "/customers/$customerId",
                    params: { customerId: row.customerId },
                  })
                }
              >
                <TableCell className="font-medium">{row.customerName}</TableCell>
                <TableCell className="text-right tabular-nums">{row.dispatchCount}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {row.totalWeightKg} kg
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ReportTableCard>
    </div>
  )
}
