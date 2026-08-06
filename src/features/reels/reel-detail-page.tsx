import { useState } from "react"
import { useNavigate, useParams } from "@tanstack/react-router"
import {
  AlertTriangle,
  ArrowLeft,
  Disc3,
  ShieldAlert,
  Truck,
  Undo2,
  type LucideIcon,
} from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { RequireRole } from "@/components/layout/require-role"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ReelStatusBadge } from "@/components/ui/status-badge"
import {
  useReel,
  useReelHistory,
  useReturnReel,
  useMarkReelLost,
  useMarkReelDamaged,
} from "@/lib/api/hooks/use-reels"
import { useProducts } from "@/lib/api/hooks/use-products"
import { useCustomers } from "@/lib/api/hooks/use-customers"
import { parseResponseDateTime } from "@/lib/api/datetime"
import { ReelActionDialog } from "@/features/reels/reel-action-dialog"

const EVENT_META: Record<string, { icon: LucideIcon; label: string; className: string }> = {
  created: { icon: Disc3, label: "Registered", className: "bg-muted text-muted-foreground" },
  dispatched: { icon: Truck, label: "Dispatched", className: "bg-primary/10 text-primary" },
  returned: { icon: Undo2, label: "Returned", className: "bg-secondary text-secondary-foreground" },
  lost: { icon: AlertTriangle, label: "Lost", className: "bg-destructive/10 text-destructive" },
  damaged: { icon: ShieldAlert, label: "Damaged", className: "bg-destructive/10 text-destructive" },
}

type ActionKind = "return" | "lost" | "damaged" | null

export function ReelDetailPage() {
  const navigate = useNavigate()
  const { reelNumber } = useParams({
    from: "/_authenticated/reels/$reelNumber",
  })
  const { data: reel, isLoading } = useReel(reelNumber)
  const { data: history, isLoading: isHistoryLoading } = useReelHistory(reelNumber)
  const { data: products } = useProducts()
  const { data: customers } = useCustomers()

  const returnReel = useReturnReel()
  const markLost = useMarkReelLost()
  const markDamaged = useMarkReelDamaged()

  const [activeAction, setActiveAction] = useState<ActionKind>(null)

  const product = products?.find((p) => p.id === reel?.productId)
  const customer = customers?.find((c) => c.id === reel?.currentCustomerId)

  // Mirrors reel_service's own state-transition rules exactly (return_reel
  // only from "dispatched"; mark_lost_or_damaged from anything except an
  // already-terminal lost/damaged status) so the buttons offered here
  // never present an action the backend would reject anyway.
  const canReturn = reel?.status === "dispatched"
  const canMarkLostOrDamaged = reel && reel.status !== "lost" && reel.status !== "damaged"

  function handleConfirm(remarks: string) {
    if (!reelNumber) return
    if (activeAction === "return") {
      returnReel.mutate(
        { reelNumber, remarks: remarks.trim() ? remarks : null },
        { onSuccess: () => setActiveAction(null) }
      )
    } else if (activeAction === "lost") {
      markLost.mutate({ reelNumber, remarks }, { onSuccess: () => setActiveAction(null) })
    } else if (activeAction === "damaged") {
      markDamaged.mutate({ reelNumber, remarks }, { onSuccess: () => setActiveAction(null) })
    }
  }

  return (
    <>
      <PageHeader
        title={isLoading ? "Loading..." : reel ? `Reel #${reel.reelNumber}` : "Reel not found"}
        description="Status, current holder, and full movement history."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/reels" })}>
              <ArrowLeft />
              Back to reels
            </Button>
            <RequireRole minRole="operator" fallback={null}>
              {reel && canReturn && (
                <Button size="sm" onClick={() => setActiveAction("return")}>
                  <Undo2 />
                  Return
                </Button>
              )}
              {reel && canMarkLostOrDamaged && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveAction("damaged")}
                  >
                    <ShieldAlert />
                    Mark damaged
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveAction("lost")}
                  >
                    <AlertTriangle />
                    Mark lost
                  </Button>
                </>
              )}
            </RequireRole>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {isLoading ? (
              <>
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-2/3" />
              </>
            ) : !reel ? (
              <p className="text-sm text-muted-foreground">
                This reel could not be found.
              </p>
            ) : (
              <>
                <ReelStatusBadge status={reel.status} className="w-fit" />
                <div className="text-sm">
                  <span className="text-muted-foreground">Product: </span>
                  {product ? `${product.name} (${product.sku})` : reel.productId}
                </div>
                {reel.weightKg && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Weight: </span>
                    {reel.weightKg} kg
                  </div>
                )}
                {customer && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Current holder: </span>
                    {customer.name}
                  </div>
                )}
                <div className="text-sm">
                  <span className="text-muted-foreground">Registered: </span>
                  {parseResponseDateTime(reel.createdAt).toLocaleString()}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Movement history</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {isHistoryLoading ? (
              <div className="flex flex-col gap-4 p-4">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="size-8 shrink-0 rounded-full" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))}
              </div>
            ) : !history || history.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
                <Disc3 className="size-6" />
                <p className="text-sm">No movement history yet.</p>
              </div>
            ) : (
              <ul className="flex flex-col divide-y">
                {history.map((entry) => {
                  const meta = EVENT_META[entry.eventType] ?? {
                    icon: Disc3,
                    label: entry.eventType,
                    className: "bg-muted text-muted-foreground",
                  }
                  const Icon = meta.icon
                  const timestamp = parseResponseDateTime(entry.createdAt)
                  return (
                    <li key={entry.id} className="flex items-start gap-3 px-4 py-3">
                      <div
                        className={`flex size-8 shrink-0 items-center justify-center rounded-full ${meta.className}`}
                      >
                        <Icon className="size-4" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="text-sm">{meta.label}</span>
                        {entry.remarks && (
                          <span className="text-xs text-muted-foreground">
                            {entry.remarks}
                          </span>
                        )}
                        <time
                          dateTime={timestamp.toISOString()}
                          title={timestamp.toLocaleString()}
                          className="text-xs text-muted-foreground"
                        >
                          {timestamp.toLocaleString()}
                        </time>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <ReelActionDialog
        open={activeAction === "return"}
        onOpenChange={(open) => !open && setActiveAction(null)}
        title="Return reel"
        description="Marks this reel as returned by its current holder."
        remarksRequired={false}
        confirmLabel="Confirm return"
        isPending={returnReel.isPending}
        onConfirm={handleConfirm}
      />
      <ReelActionDialog
        open={activeAction === "lost"}
        onOpenChange={(open) => !open && setActiveAction(null)}
        title="Mark reel lost"
        description="This cannot be undone. A reason is required for the audit trail."
        remarksRequired
        confirmLabel="Mark lost"
        confirmVariant="destructive"
        isPending={markLost.isPending}
        onConfirm={handleConfirm}
      />
      <ReelActionDialog
        open={activeAction === "damaged"}
        onOpenChange={(open) => !open && setActiveAction(null)}
        title="Mark reel damaged"
        description="This cannot be undone. A reason is required for the audit trail."
        remarksRequired
        confirmLabel="Mark damaged"
        confirmVariant="destructive"
        isPending={markDamaged.isPending}
        onConfirm={handleConfirm}
      />
    </>
  )
}
