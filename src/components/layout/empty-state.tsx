import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon: LucideIcon
  /** Short, plain-language headline: "No dispatches yet". */
  title: string
  /** One supporting sentence. Keep it to a single line where possible. */
  description?: string
  /** Primary action (e.g. an "Add new" Button) so the state is a dead end. */
  action?: React.ReactNode
  className?: string
}

/**
 * Shared empty state for every list/table that can legitimately have no rows.
 * Replaces the per-page ad-hoc "icon + muted <p>" blocks so the tone and
 * spacing are identical across Inventory, Reels, Dispatch, Reports, etc.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 px-6 py-16 text-center",
        className
      )}
    >
      <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-6" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-heading text-sm font-semibold text-foreground">
          {title}
        </p>
        {description && (
          <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
