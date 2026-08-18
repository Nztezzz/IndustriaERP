import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { DispatchStatus } from "@/lib/constants"

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"]

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

export { DISPATCH_STATUS_VARIANT }
