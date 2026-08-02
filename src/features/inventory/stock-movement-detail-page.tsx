import { useNavigate, useParams } from "@tanstack/react-router"
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpFromLine,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useStockMovement } from "@/lib/api/hooks/use-stock"
import { useProducts } from "@/lib/api/hooks/use-products"
import { parseResponseDateTime } from "@/lib/api/datetime"
import type { StockMovementType } from "@/lib/constants"

const MOVEMENT_META: Record<StockMovementType, { icon: LucideIcon; label: string; className: string }> = {
  inward: { icon: ArrowDownToLine, label: "Inward", className: "bg-primary/10 text-primary" },
  outward: { icon: ArrowUpFromLine, label: "Outward", className: "bg-secondary text-secondary-foreground" },
  adjustment: { icon: SlidersHorizontal, label: "Adjustment", className: "bg-accent text-accent-foreground" },
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value || value === "—") return null
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  )
}

export function StockMovementDetailPage() {
  const navigate = useNavigate()
  const { movementId } = useParams({
    from: "/_authenticated/inventory/movement/$movementId",
  })
  const { data: movement, isLoading } = useStockMovement(movementId)
  const { data: products } = useProducts()

  const product = products?.find((p) => p.id === movement?.productId)
  const meta = movement ? MOVEMENT_META[movement.movementType] : null
  const Icon = meta?.icon ?? ArrowDownToLine

  const signedQuantity = movement
    ? movement.movementType === "outward"
      ? -movement.quantity
      : movement.movementType === "adjustment"
        ? movement.adjustmentDelta ?? movement.quantity
        : movement.quantity
    : 0

  return (
    <>
      <PageHeader
        title={isLoading ? "Loading..." : `${meta?.label ?? "Stock"} Entry`}
        description="Full details of this stock movement record."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate({ to: "/inventory/history" })}
          >
            <ArrowLeft />
            Back to history
          </Button>
        }
      />

      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Movement Details</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {isLoading ? (
              <>
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-5 w-1/2" />
                <Skeleton className="h-5 w-3/4" />
              </>
            ) : !movement ? (
              <p className="text-sm text-muted-foreground">
                This stock movement could not be found.
              </p>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <div
                    className={`flex size-8 items-center justify-center rounded-full ${meta?.className}`}
                  >
                    <Icon className="size-4" />
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {movement.movementType}
                  </Badge>
                </div>

                <DetailRow
                  label="Product"
                  value={
                    product
                      ? `${product.name} (${product.sku})`
                      : movement.productId
                  }
                />

                <DetailRow
                  label="Quantity"
                  value={
                    <span className="tabular-nums text-base font-semibold">
                      {signedQuantity > 0 ? "+" : ""}
                      {signedQuantity}
                      {product?.baseUnitSymbol ? ` ${product.baseUnitSymbol}` : ""}
                    </span>
                  }
                />

                {movement.adjustmentDelta !== null && (
                  <DetailRow
                    label="Adjustment Delta"
                    value={
                      <span className="tabular-nums">
                        {movement.adjustmentDelta > 0 ? "+" : ""}
                        {movement.adjustmentDelta}
                      </span>
                    }
                  />
                )}

                <DetailRow
                  label="Reference / Invoice Number"
                  value={movement.referenceNumber ?? "—"}
                />

                <DetailRow
                  label="Remarks / Reason"
                  value={
                    movement.remarks ? (
                      <div
                        className="w-full overflow-y-auto overflow-x-hidden rounded border bg-muted/50 p-4 text-sm leading-relaxed break-words whitespace-pre-wrap"
                        style={{ minHeight: "120px", maxHeight: "400px" }}
                      >
                        {movement.remarks}
                      </div>
                    ) : (
                      "—"
                    )
                  }
                />

                <DetailRow
                  label="Dispatch ID"
                  value={movement.dispatchId ?? undefined}
                />
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {isLoading ? (
              <>
                <Skeleton className="h-5 w-full" />
                <Skeleton className="h-5 w-2/3" />
              </>
            ) : movement ? (
              <>
                <DetailRow label="Movement ID" value={movement.id} />
                <DetailRow label="Performed By (User ID)" value={movement.performedBy} />
                <DetailRow
                  label="Timestamp"
                  value={parseResponseDateTime(movement.createdAt).toLocaleString()}
                />
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
