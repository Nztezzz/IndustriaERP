import { useState } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"
import { toast } from "sonner"
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  ChevronLeft,
  ChevronRight,
  History,
  SlidersHorizontal,
  Trash2,
  X,
  type LucideIcon,
} from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Skeleton } from "@/components/ui/skeleton"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
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
import { EmptyState } from "@/components/layout/empty-state"
import { useProducts } from "@/lib/api/hooks/use-products"
import { useCustomers } from "@/lib/api/hooks/use-customers"
import { useStockMovements, useDeleteMovements } from "@/lib/api/hooks/use-stock"
import { parseResponseDateTime } from "@/lib/api/datetime"
import { STOCK_MOVEMENT_TYPES, type StockMovementType } from "@/lib/constants"
import type { StockMovementDto } from "@/lib/api/types"

const PAGE_SIZE = 50

const MOVEMENT_META: Record<StockMovementType, { icon: LucideIcon; className: string }> = {
  inward: { icon: ArrowDownToLine, className: "bg-primary/10 text-primary" },
  outward: { icon: ArrowUpFromLine, className: "bg-secondary text-secondary-foreground" },
  adjustment: { icon: SlidersHorizontal, className: "bg-accent text-accent-foreground" },
}

function getSignedQuantity(m: StockMovementDto): number {
  if (m.movementType === "outward") return -m.quantity
  if (m.movementType === "adjustment") return m.adjustmentDelta ?? m.quantity
  return m.quantity
}

export function StockHistoryPage() {
  const navigate = useNavigate()
  const search = useSearch({ from: "/_authenticated/inventory/history" })
  // Include inactive products: history rows can reference a product that was
  // since deactivated, and an active-only lookup made those cells print the
  // raw product UUID.
  const { data: products } = useProducts(true)
  const { data: customers } = useCustomers()
  const [page, setPage] = useState(0)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [filterCustomer, setFilterCustomer] = useState<string>("")
  const deleteMovements = useDeleteMovements()

  const { data, isLoading } = useStockMovements({
    productId: search.productId,
    movementType: search.movementType,
    page,
    pageSize: PAGE_SIZE,
  })

  // Filter by customer (stored in remarks as "Party: xyz")
  const allItems = (data?.items ?? []).filter((m) => {
    if (!filterCustomer) return true
    const customer = customers?.find((c) => c.id === filterCustomer)
    if (!customer) return true
    return m.remarks?.includes(customer.name) ?? false
  })

  // Split into latest 10 and the rest
  const latest10 = allItems.slice(0, 10)
  const restItems = allItems.slice(10)

  // Sum of latest 10
  const latest10Sum = latest10.reduce((sum, m) => sum + getSignedQuantity(m), 0)

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1
  const selectedProduct = products?.find((p) => p.id === search.productId)
  const allOnPage = allItems.map((m) => m.id)
  const allSelected = allOnPage.length > 0 && allOnPage.every((id) => selected.has(id))

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev)
        allOnPage.forEach((id) => next.delete(id))
        return next
      })
    } else {
      setSelected((prev) => {
        const next = new Set(prev)
        allOnPage.forEach((id) => next.add(id))
        return next
      })
    }
  }

  async function handleDelete() {
    const ids = Array.from(selected)
    try {
      const result = await deleteMovements.mutateAsync(ids)
      toast.success(`Deleted ${result.deleted} entries`)
      setSelected(new Set())
    } catch {
      toast.error("Failed to delete entries")
    }
  }

  function updateFilter(next: { productId?: string; movementType?: StockMovementType }) {
    setPage(0)
    setSelected(new Set())
    navigate({
      to: "/inventory/history",
      search: (prev) => ({ ...prev, ...next }),
    })
  }

  function clearFilters() {
    setPage(0)
    setSelected(new Set())
    setFilterCustomer("")
    navigate({ to: "/inventory/history", search: {} })
  }

  function renderRow(movement: StockMovementDto) {
    const meta = MOVEMENT_META[movement.movementType]
    const Icon = meta.icon
    const product = products?.find((p) => p.id === movement.productId)
    const signedQuantity = getSignedQuantity(movement)
    const isChecked = selected.has(movement.id)

    return (
      <TableRow key={movement.id} data-state={isChecked ? "selected" : undefined}>
        <TableCell onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isChecked}
            onCheckedChange={() => toggleOne(movement.id)}
          />
        </TableCell>
        <TableCell
          className="cursor-pointer"
          onClick={() => navigate({ to: "/inventory/movement/$movementId", params: { movementId: movement.id } })}
        >
          <div className="flex items-center gap-2">
            <div className={`flex size-6 items-center justify-center rounded-full ${meta.className}`}>
              <Icon className="size-3.5" />
            </div>
            <span className="capitalize">{movement.movementType}</span>
          </div>
        </TableCell>
        <TableCell className="max-w-[11rem] truncate" title={product?.name}>
          {product ? product.name : "Unknown product"}
        </TableCell>
        <TableCell className="tabular-nums">
          {signedQuantity > 0 ? "+" : ""}{signedQuantity}
        </TableCell>
        <TableCell className="hidden max-w-[10rem] truncate text-muted-foreground lg:table-cell">
          {movement.referenceNumber ?? "\u2014"}
        </TableCell>
        <TableCell
          className="hidden text-muted-foreground xl:table-cell"
          title={movement.remarks ?? undefined}
        >
          {movement.remarks
            ? movement.remarks.length > 20 ? `${movement.remarks.slice(0, 20)}\u2026` : movement.remarks
            : "\u2014"}
        </TableCell>
        <TableCell
          className="text-muted-foreground"
          title={parseResponseDateTime(movement.createdAt).toLocaleString()}
        >
          {/* Date only; full timestamp in the tooltip. */}
          {parseResponseDateTime(movement.createdAt).toLocaleDateString()}
        </TableCell>
      </TableRow>
    )
  }

  return (
    <>
      <PageHeader
        title="Stock History"
        description="Full log of every inward, outward, and adjustment movement."
        actions={
          selected.size > 0 ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 /> Delete ({selected.size})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {selected.size} entries?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently remove the selected stock history entries. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-4 p-6">
        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={filterCustomer}
            onValueChange={setFilterCustomer}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="All customers/parties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All customers/parties</SelectItem>
              {customers?.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={search.productId ?? "all"}
            onValueChange={(value) => updateFilter({ productId: value === "all" ? undefined : value })}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All products</SelectItem>
              {products?.map((product) => (
                <SelectItem key={product.id} value={product.id}>{product.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={search.movementType ?? "all"}
            onValueChange={(value) => updateFilter({ movementType: value === "all" ? undefined : (value as StockMovementType) })}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {STOCK_MOVEMENT_TYPES.map((type) => (
                <SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(search.productId || search.movementType || filterCustomer) && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X /> Clear filters
            </Button>
          )}

          {selectedProduct && <Badge variant="outline">Filtered to {selectedProduct.name}</Badge>}
          {filterCustomer && (
            <Badge variant="outline">
              Party: {customers?.find(c => c.id === filterCustomer)?.name}
            </Badge>
          )}
        </div>

        {isLoading ? (
          <Card><CardContent className="px-0">
            <div className="flex flex-col gap-3 px-4 py-2">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
            </div>
          </CardContent></Card>
        ) : allItems.length === 0 ? (
          <Card>
            <CardContent className="px-0">
              <EmptyState
                icon={History}
                title="No movements found"
                description="Nothing matches these filters yet. Try clearing them, or record an inward/outward entry."
              />
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Section 1: Latest 10 entries */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Latest 10 Entries</CardTitle>
              </CardHeader>
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">
                        <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
                      </TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Product</TableHead>
                      <TableHead>Quantity</TableHead>
                      <TableHead className="hidden lg:table-cell">Reference</TableHead>
                      <TableHead className="hidden xl:table-cell">Remarks</TableHead>
                      <TableHead>When</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {latest10.map(renderRow)}
                    {/* Sum row */}
                    <TableRow className="border-t-2 bg-muted/50 font-bold">
                      <TableCell></TableCell>
                      <TableCell></TableCell>
                      <TableCell>TOTAL (Latest 10)</TableCell>
                      <TableCell className="tabular-nums text-primary">
                        {latest10Sum > 0 ? "+" : ""}{latest10Sum}
                      </TableCell>
                      {/* Mirror the responsive columns so cells stay aligned. */}
                      <TableCell className="hidden lg:table-cell" />
                      <TableCell className="hidden xl:table-cell" />
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Section 2: Older entries */}
            {restItems.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Older Entries</CardTitle>
                </CardHeader>
                <CardContent className="px-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10"></TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Product</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead className="hidden lg:table-cell">Reference</TableHead>
                        <TableHead className="hidden xl:table-cell">Remarks</TableHead>
                        <TableHead>When</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {restItems.map(renderRow)}
                      {/* Older entries sum */}
                      <TableRow className="border-t-2 bg-muted/50 font-bold">
                        <TableCell></TableCell>
                        <TableCell></TableCell>
                        <TableCell>TOTAL (Older)</TableCell>
                        <TableCell className="tabular-nums">
                          {restItems.reduce((s, m) => s + getSignedQuantity(m), 0) > 0 ? "+" : ""}
                          {restItems.reduce((s, m) => s + getSignedQuantity(m), 0)}
                        </TableCell>
                        {/* Mirror the responsive columns so cells stay aligned. */}
                        <TableCell className="hidden lg:table-cell" />
                        <TableCell className="hidden xl:table-cell" />
                        <TableCell />
                      </TableRow>
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* Grand Total */}
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex items-center justify-between py-3">
                <span className="font-bold">GRAND TOTAL (All Entries)</span>
                <span className="text-lg font-bold tabular-nums text-primary">
                  {allItems.reduce((s, m) => s + getSignedQuantity(m), 0) > 0 ? "+" : ""}
                  {allItems.reduce((s, m) => s + getSignedQuantity(m), 0)}
                </span>
              </CardContent>
            </Card>
          </>
        )}

        {data && data.total > PAGE_SIZE && (
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Page {page + 1} of {totalPages} &middot; {data.total} total movements</span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                <ChevronLeft /> Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page + 1 >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight />
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
