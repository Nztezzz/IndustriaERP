import {
  ArrowDownToLine,
  ArrowUpFromLine,
  SlidersHorizontal,
  Truck,
  Activity as ActivityIcon,
  type LucideIcon,
} from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { parseResponseDateTime } from "@/lib/api/datetime"
import type { ActivityEntryDto } from "@/lib/api/types"
import { cn } from "@/lib/utils"

/** Maps `ActivityEntry.kind` (stock movement types + "dispatch") from
 * `dashboard_service::recent_activity` to an icon + accent color. */
const KIND_META: Record<string, { icon: LucideIcon; className: string }> = {
  inward: { icon: ArrowDownToLine, className: "bg-primary/10 text-primary" },
  outward: {
    icon: ArrowUpFromLine,
    className: "bg-secondary text-secondary-foreground",
  },
  adjustment: {
    icon: SlidersHorizontal,
    className: "bg-accent text-accent-foreground",
  },
  dispatch: { icon: Truck, className: "bg-primary/10 text-primary" },
}

function relativeTime(date: Date): string {
  const diffMs = date.getTime() - Date.now()
  const diffMinutes = Math.round(diffMs / 60_000)

  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" })
  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute")
  }
  const diffHours = Math.round(diffMinutes / 60)
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour")
  }
  const diffDays = Math.round(diffHours / 24)
  return formatter.format(diffDays, "day")
}

export function ActivityFeed({
  entries,
  isLoading,
}: {
  entries: ActivityEntryDto[] | undefined
  isLoading: boolean
}) {
  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <Skeleton className="h-4 flex-1" />
          </div>
        ))}
      </div>
    )
  }

  if (!entries || entries.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
        <ActivityIcon className="size-6" />
        <p className="text-sm">No activity yet today.</p>
      </div>
    )
  }

  return (
    <ul className="flex flex-col divide-y">
      {entries.map((entry, index) => {
        const meta = KIND_META[entry.kind] ?? {
          icon: ActivityIcon,
          className: "bg-muted text-muted-foreground",
        }
        const Icon = meta.icon
        const timestamp = parseResponseDateTime(entry.timestamp)

        return (
          <li
            key={`${entry.timestamp}-${index}`}
            className="flex items-start gap-3 px-4 py-3"
          >
            <div
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full",
                meta.className
              )}
            >
              <Icon className="size-4" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-sm">{entry.description}</span>
              <time
                dateTime={timestamp.toISOString()}
                title={timestamp.toLocaleString()}
                className="text-xs text-muted-foreground"
              >
                {relativeTime(timestamp)}
              </time>
            </div>
          </li>
        )
      })}
    </ul>
  )
}
