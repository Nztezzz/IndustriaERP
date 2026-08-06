import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

interface StatCardProps {
  label: string
  value: number
  icon: LucideIcon
  hint?: string
  /** "warning" accents the icon for attention-worthy counts (e.g. low stock). */
  tone?: "default" | "warning"
  /**
   * Marks this as THE headline metric on the page. Only one card per grid
   * should set this -- it gets the orange accent bar so the brand colour
   * points at a single place rather than competing across every tile.
   */
  primary?: boolean
  /** Optional period-over-period change, rendered as a small up/down chip. */
  trend?: { value: number; label?: string }
  isLoading?: boolean
}

/**
 * Single headline metric tile used across the dashboard's summary grid.
 * Deliberately dumb/presentational -- all the counting happens server-side
 * in `dashboard_service::summary`, this just renders the number.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "default",
  primary = false,
  trend,
  isLoading,
}: StatCardProps) {
  const isUp = (trend?.value ?? 0) >= 0

  return (
    <Card className="relative hover:shadow-md">
      {/* Accent bar: orange only on the single most important metric. */}
      {primary && (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 w-1 rounded-l-xl bg-primary"
        />
      )}
      <CardContent className="flex items-start gap-4">
        <div
          className={cn(
            "flex size-11 shrink-0 items-center justify-center rounded-xl",
            tone === "warning"
              ? "bg-warning/12 text-warning"
              : primary
                ? "bg-primary/10 text-primary"
                : "bg-muted text-muted-foreground"
          )}
        >
          <Icon className="size-5" />
        </div>

        <div className="flex min-w-0 flex-col gap-0.5">
          {isLoading ? (
            <Skeleton className="h-8 w-16" />
          ) : (
            <div className="flex items-baseline gap-2">
              <span className="font-heading text-3xl leading-none font-semibold tabular-nums tracking-tight">
                {value}
              </span>
              {trend && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 text-xs font-medium",
                    isUp ? "text-success" : "text-destructive"
                  )}
                >
                  {isUp ? (
                    <TrendingUp className="size-3" />
                  ) : (
                    <TrendingDown className="size-3" />
                  )}
                  {Math.abs(trend.value)}
                  {trend.label && (
                    <span className="font-normal text-muted-foreground">
                      {trend.label}
                    </span>
                  )}
                </span>
              )}
            </div>
          )}
          <span className="text-sm font-medium text-muted-foreground">
            {label}
          </span>
          {hint && (
            <span className="text-xs text-muted-foreground/70">{hint}</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
