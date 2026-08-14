import { useNavigate } from "@tanstack/react-router"
import {
  Package,
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Truck,
  Disc3,
  RefreshCw,
} from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { RequireRole } from "@/components/layout/require-role"
import { StatCard } from "@/features/dashboard/stat-card"
import { ActivityFeed } from "@/features/dashboard/activity-feed"
import {
  useDashboardSummary,
  useRecentActivity,
} from "@/lib/api/hooks/use-dashboard"

export function DashboardPage() {
  const navigate = useNavigate()
  const {
    data: summary,
    isLoading: isSummaryLoading,
    isFetching: isSummaryFetching,
    refetch: refetchSummary,
  } = useDashboardSummary()
  const {
    data: activity,
    isLoading: isActivityLoading,
    refetch: refetchActivity,
  } = useRecentActivity()

  function refreshAll() {
    refetchSummary()
    refetchActivity()
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Live stock summary, today's activity, and quick actions."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={refreshAll}
            disabled={isSummaryFetching}
          >
            <RefreshCw className={isSummaryFetching ? "animate-spin" : ""} />
            Refresh
          </Button>
        }
      />

      <div className="flex flex-col gap-6 p-6">
        {/*
         * 3 columns (not 6) so each tile has room to breathe -- six skinny
         * columns made the numbers hard to scan at a glance.
         */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            label="Active products"
            value={summary?.totalProducts ?? 0}
            icon={Package}
            isLoading={isSummaryLoading}
          />
          <StatCard
            label="Low stock"
            value={summary?.lowStockProductCount ?? 0}
            icon={AlertTriangle}
            tone={
              summary && summary.lowStockProductCount > 0
                ? "warning"
                : "default"
            }
            hint={
              summary && summary.lowStockProductCount > 0
                ? "Needs attention"
                : undefined
            }
            isLoading={isSummaryLoading}
          />
          <StatCard
            label="Inward today"
            value={summary?.todayInwardCount ?? 0}
            icon={ArrowDownToLine}
            isLoading={isSummaryLoading}
          />
          <StatCard
            label="Outward today"
            value={summary?.todayOutwardCount ?? 0}
            icon={ArrowUpFromLine}
            isLoading={isSummaryLoading}
          />
          <StatCard
            label="Dispatches today"
            value={summary?.todayDispatchCount ?? 0}
            icon={Truck}
            isLoading={isSummaryLoading}
          />
          {/*
           * `primary` = the one card that gets the orange accent bar. Reels
           * still out with customers is the metric this business actually
           * runs on, so it earns the brand colour; everything else stays
           * neutral so the orange means something.
           */}
          <StatCard
            label="Reels pending return"
            value={summary?.pendingReelCount ?? 0}
            icon={Disc3}
            primary
            hint="Currently out with customers"
            isLoading={isSummaryLoading}
          />
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Recent activity</CardTitle>
              <Button
                variant="link"
                size="sm"
                onClick={() => navigate({ to: "/inventory/history" })}
              >
                View stock history
              </Button>
            </CardHeader>
            <CardContent className="px-0">
              <ActivityFeed entries={activity} isLoading={isActivityLoading} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Quick actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <RequireRole minRole="operator" fallback={null}>
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => navigate({ to: "/inventory/inward" })}
                >
                  <ArrowDownToLine />
                  Record inward stock
                </Button>
                {/*
                 * Stock going OUT to a customer is recorded by creating a
                 * Dispatch -- dispatch_service already writes the outward
                 * stock movement for every line item. There's deliberately
                 * no separate "record outward" shortcut, since doing both
                 * for one shipment would deduct the stock twice.
                 */}
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={() => navigate({ to: "/dispatches" })}
                >
                  <Truck />
                  Record outward / new dispatch
                </Button>
              </RequireRole>
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => navigate({ to: "/reels" })}
              >
                <Disc3 />
                View reel tracking
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
