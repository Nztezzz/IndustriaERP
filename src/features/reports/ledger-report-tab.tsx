import { useState } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
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
import { useLedger } from "@/lib/api/hooks/use-reports"
import { useCustomers } from "@/lib/api/hooks/use-customers"
import { parseResponseDateTime } from "@/lib/api/datetime"
import { sumBy, type ExportColumn } from "@/lib/export"
import { MOVEMENT_TYPE_LABEL } from "@/lib/constants"
import type { LedgerEntryDto } from "@/lib/api/types"

/**
 * Net quantity this entry contributes: outward adds (goods went to the
 * party), return subtracts (goods came back), adjustment carries its own
 * signed value from remarks-less quantity (adjustments have no party so
 * they're excluded from the customer view but still shown/exported here).
 */
function signedQty(row: LedgerEntryDto): number {
  if (row.movementType === "return") return -row.quantity
  return row.quantity
}

const COLUMNS: ExportColumn<LedgerEntryDto>[] = [
  {
    header: "Date",
    accessor: (r) => parseResponseDateTime(r.date).toLocaleDateString(),
  },
  { header: "Customer / Party", accessor: (r) => r.customerName ?? "\u2014" },
  { header: "Product", accessor: (r) => r.productName },
  {
    header: "Type",
    accessor: (r) => MOVEMENT_TYPE_LABEL[r.movementType] ?? r.movementType,
  },
  {
    header: "Quantity",
    accessor: (r) => signedQty(r),
    total: (rows) => sumBy(rows, signedQty),
  },
  { header: "Reference", accessor: (r) => r.referenceNumber ?? "" },
]

/**
 * Row-level ledger: every stock movement (inward/dispatch/return/
 * adjustment) with its date and resolved customer name, filterable by
 * date range AND customer -- the entry-level counterpart to the
 * aggregated Product-wise report.
 */
export function LedgerReportTab({
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
  const [customerId, setCustomerId] = useState<string>("")
  const { data: customers } = useCustomers()
  const { data, isLoading } = useLedger({
    ...toReportRangeQuery(range),
    customerId: customerId || undefined,
  })
  const allRows = data ?? []
  const rows = entryLimit ? allRows.slice(0, entryLimit) : allRows

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter value={range} onChange={onRangeChange} showEntryLimit entryLimit={entryLimit} onEntryLimitChange={onEntryLimitChange} />
          <Select value={customerId} onValueChange={setCustomerId}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All parties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All parties</SelectItem>
              {customers?.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <ExportButtons
          baseFileName="ledger-report"
          title="Stock Movement Ledger"
          columns={COLUMNS}
          rows={rows}
        />
      </div>

      <ReportTableCard
        isLoading={isLoading}
        isEmpty={rows.length === 0}
        emptyLabel="No entries in this date range."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Customer / Party</TableHead>
              <TableHead>Product</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead>Reference</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="text-muted-foreground">
                  {parseResponseDateTime(row.date).toLocaleDateString()}
                </TableCell>
                <TableCell className="font-medium">
                  {row.customerName ?? "\u2014"}
                </TableCell>
                <TableCell>{row.productName}</TableCell>
                <TableCell>{MOVEMENT_TYPE_LABEL[row.movementType] ?? row.movementType}</TableCell>
                <TableCell className="text-right tabular-nums">
                  {signedQty(row)}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.referenceNumber ?? "\u2014"}
                </TableCell>
              </TableRow>
            ))}
            <TableRow className="border-t-2 bg-muted/50 font-bold">
              <TableCell colSpan={4}>TOTAL ({rows.length})</TableCell>
              <TableCell className="text-right tabular-nums">
                {sumBy(rows, signedQty)}
              </TableCell>
              <TableCell></TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </ReportTableCard>
    </div>
  )
}
