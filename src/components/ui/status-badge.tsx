import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { DispatchStatus, ReelStatus } from "@/lib/constants"

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"]

/**
 * Single source of truth for status -> colour mapping.
 *
 * These deliberately use the SEMANTIC palette (green/amber/red/blue) and
 * never the brand orange: orange is reserved for primary actions and the
 * single headline metric, so a table full of orange status pills would
 * dilute it. Previously `dispatched` rendered as `variant="default"`
 * (orange) and this map was copy-pasted across three pages -- both fixed
 * by centralising here.
 */
const REEL_STATUS_VARIANT: Record<ReelStatus, BadgeVariant> = {
  in_stock: "success", // on hand, nothing owed
  dispatched: "info", // out with a customer / in transit
  returned: "success", // came back safely
  lost: "destructive",
  damaged: "destructive",
}

const DISPATCH_STATUS_VARIANT: Record<DispatchStatus, BadgeVariant> = {
  pending: "warning",
  delivered: "success",
  cancelled: "destructive",
}

/** Turns `in_stock` into `In stock` for display. */
function humanise(status: string) {
  const spaced = status.replace(/_/g, " ")
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function ReelStatusBadge({
  status,
  className,
}: {
  status: ReelStatus
  className?: string
}) {
  return (
    <Badge variant={REEL_STATUS_VARIANT[status]} className={cn(className)}>
      {humanise(status)}
    </Badge>
  )
}

export function DispatchStatusBadge({
  status,
  className,
}: {
  status: DispatchStatus
  className?: string
}) {
  return (
    <Badge variant={DISPATCH_STATUS_VARIANT[status]} className={cn(className)}>
      {humanise(status)}
    </Badge>
  )
}

export { REEL_STATUS_VARIANT, DISPATCH_STATUS_VARIANT }
