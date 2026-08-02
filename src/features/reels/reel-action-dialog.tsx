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

/**
 * Shared confirm-with-remarks dialog for the three reel status-transition
 * actions (return / mark lost / mark damaged). A plain AlertDialog can't
 * collect the remarks text, so this is a small purpose-built Dialog
 * instead -- `remarksRequired` toggles whether the confirm button is
 * disabled on an empty remarks field, matching each action's own backend
 * validation (return_reel's remarks are optional, mark_lost_or_damaged's
 * are required).
 */
export function ReelActionDialog({
  open,
  onOpenChange,
  title,
  description,
  remarksRequired,
  confirmLabel,
  confirmVariant = "default",
  isPending,
  onConfirm,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  remarksRequired: boolean
  confirmLabel: string
  confirmVariant?: "default" | "destructive"
  isPending: boolean
  onConfirm: (remarks: string) => void
}) {
  const [remarks, setRemarks] = useState("")

  useEffect(() => {
    if (open) setRemarks("")
  }, [open])

  const canConfirm = !remarksRequired || remarks.trim().length > 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (canConfirm && !isPending) onConfirm(remarks)
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2 py-4">
            <Label htmlFor="reel-action-remarks">
              Remarks {remarksRequired && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              id="reel-action-remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder={remarksRequired ? "Reason is required" : "Optional"}
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant={confirmVariant}
              disabled={!canConfirm || isPending}
            >
              {isPending && <Loader2 className="animate-spin" />}
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
