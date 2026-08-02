import { useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ExportButtons } from "@/components/export-buttons"
import { ReportTableCard } from "@/features/reports/report-table-card"
import { DateRangeFilter, toReportRangeQuery, type ReportDateRange } from "@/features/reports/date-range-filter"
import { useDailyActivityReport } from "@/lib/api/hooks/use-reports"
import type { ExportColumn } from "@/lib/export"
import type { DailyActivitySummaryDto } from "@/lib/api/types"

const COLUMNS: ExportColumn<DailyActivitySummaryDto>[] = [
  { header: "Date", accessor: (r) => r.date },
  { header: "Inward count", accessor: (r) => r.inwardCount },
  { header: "Outward count", accessor: (r) => r.outwardCount },
  { header: "Dispatch count", accessor: (r) => r.dispatchCount },
]

interface MonthlyRow {
  month: string
  inwardCount: number
  outwardCount: number
  dispatchCount: number
}

const MONTHLY_COLUMNS: ExportColumn<MonthlyRow>[] = [
  { header: "Month", accessor: (r) => r.month },
  { header: "Inward count", accessor: (r) => r.inwardCount },
  { header: "Outward count", accessor: (r) => r.outwardCount },
  { header: "Dispatch count", accessor: (r) => r.dispatchCount },
]

/** Rolls up daily buckets into a "YYYY-MM" monthly view by summing --
 * report_service.rs's own doc comment confirms this bucketing is
 * intentional ("one query shape serves both daily and monthly reports"),
 * so the aggregation belongs on the frontend rather than a second
 * backend endpoint. */
function toMonthly(rows: DailyActivitySummaryDto[]): MonthlyRow[] {
  const byMonth = new Map<string, MonthlyRow>()
  for (const row of rows) {
    const month = row.date.slice(0, 7)
    const existing = byMonth.get(month)
    if (existing) {
      existing.inwardCount += row.inwardCount
      existing.outwardCount += row.outwardCount
      existing.dispatchCount += row.dispatchCount
    } else {
      byMonth.set(month, {
        month,
        inwardCount: row.inwardCount,
        outwardCount: row.outwardCount,
        dispatchCount: row.dispatchCount,
      })
    }
  }
  return Array.from(byMonth.values()).sort((a, b) => a.month.localeCompare(b.month))
}

/**
 * Daily/monthly activity: inward/outward/dispatch counts bucketed by
 * calendar day, with a toggle to roll the same data up into a monthly
 * view (both "Daily reports" and "Monthly reports" from the original
 * spec are satisfied by one endpoint + client-side bucketing, matching
 * how report_service.rs itself documents this data shape).
 */
export function DailyActivityReportTab({
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
  const [granularity, setGranularity] = useState<"daily" | "monthly">("daily")
  const { data, isLoading } = useDailyActivityReport(toReportRangeQuery(range))
  const allDailyRows = data ?? []
  const dailyRows = entryLimit ? allDailyRows.slice(0, entryLimit) : allDailyRows
  const monthlyRows = useMemo(() => toMonthly(dailyRows), [dailyRows])

  // Daily and monthly rows share the same count fields but a differently
  // named bucket key ("date" vs "month") -- normalized to one common
  // `label` shape just for the chart so `chartData` stays a single
  // concrete type instead of a union (recharts' generic BarChart can't
  // usefully infer a shared type across two differently-shaped arrays).
  const chartData = useMemo(
    () =>
      granularity === "daily"
        ? dailyRows.map((r) => ({
            label: r.date,
            inwardCount: r.inwardCount,
            outwardCount: r.outwardCount,
            dispatchCount: r.dispatchCount,
          }))
        : monthlyRows.map((r) => ({
            label: r.month,
            inwardCount: r.inwardCount,
            outwardCount: r.outwardCount,
            dispatchCount: r.dispatchCount,
          })),
    [granularity, dailyRows, monthlyRows]
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <DateRangeFilter value={range} onChange={onRangeChange} showEntryLimit entryLimit={entryLimit} onEntryLimitChange={onEntryLimitChange} />
          <div className="flex items-center rounded-md border p-0.5">
            <Button
              variant={granularity === "daily" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setGranularity("daily")}
            >
              Daily
            </Button>
            <Button
              variant={granularity === "monthly" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setGranularity("monthly")}
            >
              Monthly
            </Button>
          </div>
        </div>
        {granularity === "daily" ? (
          <ExportButtons
            baseFileName="daily-activity-report"
            title="Daily Activity Report"
            columns={COLUMNS}
            rows={dailyRows}
          />
        ) : (
          <ExportButtons
            baseFileName="monthly-activity-report"
            title="Monthly Activity Report"
            columns={MONTHLY_COLUMNS}
            rows={monthlyRows}
          />
        )}
      </div>

      <Card>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : chartData.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
              No activity in this date range.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="label"
                  fontSize={12}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--popover)",
                    color: "var(--popover-foreground)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-md)",
                    fontSize: 12,
                  }}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="inwardCount" name="Inward" fill="var(--chart-1)" radius={3} />
                <Bar dataKey="outwardCount" name="Outward" fill="var(--chart-3)" radius={3} />
                <Bar dataKey="dispatchCount" name="Dispatches" fill="var(--chart-5)" radius={3} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <ReportTableCard
        isLoading={isLoading}
        isEmpty={chartData.length === 0}
        emptyLabel="No activity in this date range."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{granularity === "daily" ? "Date" : "Month"}</TableHead>
              <TableHead className="text-right">Inward</TableHead>
              <TableHead className="text-right">Outward</TableHead>
              <TableHead className="text-right">Dispatches</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {granularity === "daily"
              ? dailyRows.map((row) => (
                  <TableRow key={row.date}>
                    <TableCell className="font-medium">{row.date}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.inwardCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.outwardCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.dispatchCount}</TableCell>
                  </TableRow>
                ))
              : monthlyRows.map((row) => (
                  <TableRow key={row.month}>
                    <TableCell className="font-medium">{row.month}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.inwardCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.outwardCount}</TableCell>
                    <TableCell className="text-right tabular-nums">{row.dispatchCount}</TableCell>
                  </TableRow>
                ))}
          </TableBody>
        </Table>
      </ReportTableCard>
    </div>
  )
}
