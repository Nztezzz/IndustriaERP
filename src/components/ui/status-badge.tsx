import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { DISPATCH_STATUS_LABEL, type DispatchStatus } from "@/lib/constants"

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"]

const DISPATCH_STATUS_VARIANT: Record<DispatchStatus, BadgeVariant> = {
  pending: "warning",
  delivered: "success",
  // Goods coming back isn't good or bad news, it's just a state change --
  // so info/blue rather than success/green or destructive/red.
  partially_returned: "info",
  returned: "info",
  cancelled: "destructive",
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
      {DISPATCH_STATUS_LABEL[status] ?? status}
    </Badge>
  )
}

export { DISPATCH_STATUS_VARIANT }
