import { useState } from "react"
import { PageHeader } from "@/components/layout/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProductWiseReportTab } from "@/features/reports/product-wise-report-tab"
import { CustomerWiseReportTab } from "@/features/reports/customer-wise-report-tab"
import { DailyActivityReportTab } from "@/features/reports/daily-activity-report-tab"
import { PendingReelsReportTab } from "@/features/reports/pending-reels-report-tab"
import { DispatchReportTab } from "@/features/reports/dispatch-report-tab"
import type { ReportDateRange } from "@/features/reports/date-range-filter"

/**
 * Reports module (task 22). Five report types, each its own tab, sharing
 * ONE date-range selection across the four range-filterable reports
 * (product-wise/customer-wise/daily-activity/dispatches) -- switching
 * tabs keeps the same range rather than resetting it, since a user
 * comparing "this month" across report types shouldn't have to re-pick
 * the range each time. Pending reels is a point-in-time snapshot with no
 * date range (see pending-reels-report-tab.tsx), so it's excluded from
 * the shared range state.
 */
export function ReportsPage() {
  const [range, setRange] = useState<ReportDateRange>({})

  return (
    <>
      <PageHeader
        title="Reports"
        description="Daily, monthly, product-wise, customer-wise, stock, and dispatch reports."
      />
      <div className="p-6">
        <Tabs defaultValue="product-wise">
          <TabsList>
            <TabsTrigger value="product-wise">Product-wise</TabsTrigger>
            <TabsTrigger value="customer-wise">Customer-wise</TabsTrigger>
            <TabsTrigger value="daily-activity">Daily / Monthly</TabsTrigger>
            <TabsTrigger value="pending-reels">Pending Reels</TabsTrigger>
            <TabsTrigger value="dispatches">Dispatches</TabsTrigger>
          </TabsList>
          <TabsContent value="product-wise" className="pt-4">
            <ProductWiseReportTab range={range} onRangeChange={setRange} />
          </TabsContent>
          <TabsContent value="customer-wise" className="pt-4">
            <CustomerWiseReportTab range={range} onRangeChange={setRange} />
          </TabsContent>
          <TabsContent value="daily-activity" className="pt-4">
            <DailyActivityReportTab range={range} onRangeChange={setRange} />
          </TabsContent>
          <TabsContent value="pending-reels" className="pt-4">
            <PendingReelsReportTab />
          </TabsContent>
          <TabsContent value="dispatches" className="pt-4">
            <DispatchReportTab range={range} onRangeChange={setRange} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
