import { useState } from "react"
import { useNavigate, useParams } from "@tanstack/react-router"
import { ArrowLeft, Package, Undo2, User } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useDispatch } from "@/lib/api/hooks/use-dispatches"
import { useProducts } from "@/lib/api/hooks/use-products"
import { parseResponseDateTime } from "@/lib/api/datetime"
import { RequireRole } from "@/components/layout/require-role"
import { ReturnDialog } from "@/features/dispatches/return-dialog"
import type { DispatchStatus } from "@/lib/constants"

const STATUS_VARIANT: Record<DispatchStatus, "outline" | "secondary" | "destructive"> = {
  pending: "outline",
  delivered: "secondary",
  cancelled: "destructive",
}

export function DispatchDetailPage() {
  const navigate = useNavigate()
  const { dispatchId } = useParams({
    from: "/_authenticated/dispatches/$dispatchId",
  })
  const { data: dispatch, isLoading } = useDispatch(dispatchId)
  const { data: products } = useProducts(true)
  const [returnOpen, setReturnOpen] = useState(false)

  return (
    <>
      <PageHeader
        title={isLoading ? "Loading..." : dispatch?.invoiceNumber ?? "Dispatch not found"}
        description="Dispatch details and line items."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/dispatches" })}>
              <ArrowLeft />
              Back to dispatches
            </Button>
            <RequireRole minRole="operator" fallback={null}>
              {dispatch && (
                <Button size="sm" onClick={() => setReturnOpen(true)}>
                  <Undo2 />
                  Return
                </Button>
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
                <Skeleton className="h-5 w-1/2" />
              </>
            ) : !dispatch ? (
              <p className="text-sm text-muted-foreground">
                This dispatch could not be found.
              </p>
            ) : (
              <>
                <Badge
                  variant={STATUS_VARIANT[dispatch.status]}
                  className="w-fit capitalize"
                >
                  {dispatch.status}
                </Badge>
                <div className="flex items-center gap-2 text-sm">
                  <User className="size-4 text-muted-foreground" />
                  {dispatch.customerName}
                </div>
                <div className="text-sm">
                  <span className="text-muted-foreground">Dispatch date: </span>
                  {parseResponseDateTime(dispatch.dispatchDate).toLocaleString()}
                </div>
                {dispatch.vehicleNumber && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Vehicle: </span>
                    {dispatch.vehicleNumber}
                  </div>
                )}
                {dispatch.driverName && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Driver: </span>
                    {dispatch.driverName}
                    {dispatch.driverPhone && ` (${dispatch.driverPhone})`}
                  </div>
                )}
                {dispatch.totalWeightKg && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Total weight: </span>
                    {dispatch.totalWeightKg} kg
                  </div>
                )}
                {dispatch.remarks && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Remarks: </span>
                    {dispatch.remarks}
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Line items</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {isLoading ? (
              <div className="flex flex-col gap-3 px-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : !dispatch || dispatch.items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
                <Package className="size-6" />
                <p className="text-sm">No product line items on this dispatch.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Weight</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dispatch.items.map((item) => {
                    const product = products?.find((p) => p.id === item.productId)
                    return (
                      <TableRow key={item.id}>
                        <TableCell>
                          {product ? `${product.name} (${product.sku})` : item.productId}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {item.quantity} {product?.baseUnitSymbol ?? ""}
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {item.weightKg ? `${item.weightKg} kg` : "—"}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

      </div>

      {dispatch && (
        <ReturnDialog
          open={returnOpen}
          onOpenChange={setReturnOpen}
          dispatchId={dispatchId}
          invoiceNumber={dispatch.invoiceNumber}
          customerName={dispatch.customerName}
        />
      )}
    </>
  )
}
