import { useState } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronLeft,
  ChevronRight,
  History,
  SlidersHorizontal,
  X,
  type LucideIcon,
} from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useProducts } from "@/lib/api/hooks/use-products"
import { useStockMovements } from "@/lib/api/hooks/use-stock"
import { parseResponseDateTime } from "@/lib/api/datetime"
import { STOCK_MOVEMENT_TYPES, type StockMovementType } from "@/lib/constants"

const PAGE_SIZE = 25

const MOVEMENT_META: Record<StockMovementType, { icon: LucideIcon; className: string }> = {
  inward: { icon: ArrowDownToLine, className: "bg-primary/10 text-primary" },
  outward: { icon: ArrowUpFromLine, className: "bg-secondary text-secondary-foreground" },
  adjustment: { icon: SlidersHorizontal, className: "bg-accent text-accent-foreground" },
}

export function StockHistoryPage() {
  const navigate = useNavigate()
  const search = useSearch({ from: "/_authenticated/inventory/history" })
  const { data: products } = useProducts()
  const [page, setPage] = useState(0)

  const { data, isLoading } = useStockMovements({
    productId: search.productId,
    movementType: search.movementType,
    page,
    pageSize: PAGE_SIZE,
  })

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1
  const selectedProduct = products?.find((p) => p.id === search.productId)

  function updateFilter(next: { productId?: string; movementType?: StockMovementType }) {
    setPage(0)
    navigate({
      to: "/inventory/history",
      search: (prev) => ({ ...prev, ...next }),
    })
  }

  function clearFilters() {
    setPage(0)
    navigate({ to: "/inventory/history", search: {} })
  }

  return (
    <>
      <PageHeader
        title="Stock History"
        description="Full log of every inward, outward, and adjustment movement."
      />

      <div className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={search.productId ?? "all"}
            onValueChange={(value) =>
              updateFilter({ productId: value === "all" ? undefined : value })
            }
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="All products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All products</SelectItem>
              {products?.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name} ({product.sku})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={search.movementType ?? "all"}
            onValueChange={(value) =>
              updateFilter({
                movementType:
                  value === "all" ? undefined : (value as StockMovementType),
              })
            }
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {STOCK_MOVEMENT_TYPES.map((type) => (
                <SelectItem key={type} value={type} className="capitalize">
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(search.productId || search.movementType) && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X />
              Clear filters
            </Button>
          )}

          {selectedProduct && (
            <Badge variant="outline">Filtered to {selectedProduct.name}</Badge>
          )}
        </div>

        <Card>
          <CardContent className="px-0">
            {isLoading ? (
              <div className="flex flex-col gap-3 px-4 py-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : !data || data.items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
                <History className="size-8" />
                <p className="text-sm">No stock movements match these filters.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Type</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Quantity</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Remarks</TableHead>
                    <TableHead>When</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((movement) => {
                    const meta = MOVEMENT_META[movement.movementType]
                    const Icon = meta.icon
                    const product = products?.find((p) => p.id === movement.productId)
                    const signedQuantity =
                      movement.movementType === "outward"
                        ? -movement.quantity
                        : movement.movementType === "adjustment"
                          ? movement.adjustmentDelta ?? movement.quantity
                          : movement.quantity

                    return (
                      <TableRow key={movement.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className={`flex size-6 items-center justify-center rounded-full ${meta.className}`}
                            >
                              <Icon className="size-3.5" />
                            </div>
                            <span className="capitalize">{movement.movementType}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {product ? `${product.name} (${product.sku})` : movement.productId}
                        </TableCell>
                        <TableCell className="tabular-nums">
                          {signedQuantity > 0 ? "+" : ""}
                          {signedQuantity}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {movement.referenceNumber ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {movement.remarks ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {parseResponseDateTime(movement.createdAt).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {data && data.total > PAGE_SIZE && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              Page {page + 1} of {totalPages} &middot; {data.total} total movements
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page + 1 >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
                <ChevronRight />
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
