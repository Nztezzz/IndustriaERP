import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ReelStatusBadge } from "@/components/ui/status-badge"
import {
  useMarkReelDamaged,
  useMarkReelLost,
  useReturnReel,
} from "@/lib/api/hooks/use-reels"
import type { ReelStatus } from "@/lib/constants"

/**
 * Which statuses a reel can legally move to, keyed by where it is now.
 *
 * This mirrors the server-side guards in `reel_service` exactly so the
 * dropdown never offers a transition the backend would reject:
 *   - `return_reel` requires the reel to currently be `dispatched`
 *   - `mark_lost_or_damaged` works from anything except an already
 *     terminal `lost` / `damaged`
 *
 * `dispatched` is deliberately NOT offered here: a reel goes out by being
 * attached to a Dispatch (which also records the customer and the stock
 * movement), never by flipping a status by hand.
 */
const ALLOWED_TRANSITIONS: Record<ReelStatus, ReelStatus[]> = {
  in_stock: ["lost", "damaged"],
  dispatched: ["returned", "lost", "damaged"],
  returned: ["lost", "damaged"],
  lost: [],
  damaged: [],
}

/** Lost/damaged require a reason for the audit trail; returning doesn't. */
function requiresReason(status: ReelStatus) {
  return status === "lost" || status === "damaged"
}

function label(status: ReelStatus) {
  const spaced = status.replace(/_/g, " ")
  return spaced.charAt(0).toUpperCase() + spaced.slice(1)
}

export function ReelStatusDialog({
  open,
  onOpenChange,
  reelNumber,
  currentStatus,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  reelNumber: string | null
  currentStatus: ReelStatus | null
}) {
  const [target, setTarget] = useState<ReelStatus | "">("")
  const [remarks, setRemarks] = useState("")

  const returnReel = useReturnReel()
  const markLost = useMarkReelLost()
  const markDamaged = useMarkReelDamaged()

  const isPending =
    returnReel.isPending || markLost.isPending || markDamaged.isPending

  // Reset on each open so a previous choice never leaks into the next reel.
  useEffect(() => {
    if (open) {
      setTarget("")
      setRemarks("")
    }
  }, [open])

  const options = currentStatus ? ALLOWED_TRANSITIONS[currentStatus] : []
  const needsReason = target ? requiresReason(target) : false
  const canSubmit =
    !!target && !isPending && (!needsReason || remarks.trim().length > 0)

  function handleSubmit() {
    if (!reelNumber || !target) return
    const done = { onSuccess: () => onOpenChange(false) }

    if (target === "returned") {
      returnReel.mutate(
        { reelNumber, remarks: remarks.trim() || null },
        done
      )
    } else if (target === "lost") {
      markLost.mutate({ reelNumber, remarks }, done)
    } else if (target === "damaged") {
      markDamaged.mutate({ reelNumber, remarks }, done)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (canSubmit) handleSubmit()
          }}
        >
          <DialogHeader>
            <DialogTitle>Change reel status</DialogTitle>
            <DialogDescription>
              {reelNumber
                ? `Update the status of reel #${reelNumber}.`
                : "Update the reel's status."}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 py-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Current status:</span>
              {currentStatus && <ReelStatusBadge status={currentStatus} />}
            </div>

            {options.length === 0 ? (
              <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                A reel marked <strong>{currentStatus && label(currentStatus)}</strong>{" "}
                is final and cannot be changed again.
              </p>
            ) : (
              <>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="reel-new-status">New status</Label>
                  <Select
                    value={target}
                    onValueChange={(v) => setTarget(v as ReelStatus)}
                  >
                    <SelectTrigger id="reel-new-status" className="w-full">
                      <SelectValue placeholder="Select a new status" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((status) => (
                        <SelectItem key={status} value={status}>
                          {label(status)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {currentStatus === "in_stock" && (
                    <p className="text-xs text-muted-foreground">
                      To send a reel out to a customer, add it to a Dispatch
                      instead — that records the customer and stock movement too.
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="reel-status-remarks">
                    Reason{" "}
                    {needsReason ? (
                      <span className="text-destructive">*</span>
                    ) : (
                      <span className="text-muted-foreground">(optional)</span>
                    )}
                  </Label>
                  <Textarea
                    id="reel-status-remarks"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder={
                      needsReason
                        ? "Required — this is kept in the audit trail"
                        : "Optional note"
                    }
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            {options.length > 0 && (
              <Button
                type="submit"
                variant={needsReason ? "destructive" : "default"}
                disabled={!canSubmit}
              >
                {isPending && <Loader2 className="animate-spin" />}
                Update status
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
