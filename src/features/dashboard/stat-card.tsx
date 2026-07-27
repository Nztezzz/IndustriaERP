import type { LucideIcon } from "lucide-react"
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
  isLoading,
}: StatCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-lg",
            tone === "warning"
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary"
          )}
        >
          <Icon className="size-5" />
        </div>
        <div className="flex min-w-0 flex-col">
          {isLoading ? (
            <Skeleton className="h-7 w-12" />
          ) : (
            <span className="font-heading text-2xl font-semibold tabular-nums leading-tight">
              {value}
            </span>
          )}
          <span className="text-sm text-muted-foreground">{label}</span>
          {hint && (
            <span className="text-xs text-muted-foreground/80">{hint}</span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
