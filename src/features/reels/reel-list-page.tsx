import { useState } from "react"
import { useNavigate, useSearch } from "@tanstack/react-router"
import {
  ChevronLeft,
  ChevronRight,
  Disc3,
  Pencil,
  Plus,
  Undo2,
  X,
} from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { RequireRole } from "@/components/layout/require-role"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ReelStatusBadge } from "@/components/ui/status-badge"
import { EmptyState } from "@/components/layout/empty-state"
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
import { useReels, useReturnReel } from "@/lib/api/hooks/use-reels"
import { useProducts } from "@/lib/api/hooks/use-products"
import { useCustomers } from "@/lib/api/hooks/use-customers"
import { parseResponseDateTime } from "@/lib/api/datetime"
import { REEL_STATUSES, type ReelStatus } from "@/lib/constants"
import { RegisterReelDialog } from "@/features/reels/register-reel-dialog"
import { ReelActionDialog } from "@/features/reels/reel-action-dialog"
import { ReelStatusDialog } from "@/features/reels/reel-status-dialog"
import type { ReelDto } from "@/lib/api/types"

const PAGE_SIZE = 25

export function ReelListPage() {
  const navigate = useNavigate()
  const search = useSearch({ from: "/_authenticated/reels/" })
  const [page, setPage] = useState(0)
  const [formOpen, setFormOpen] = useState(false)
  const [returnReelNumber, setReturnReelNumber] = useState<string | null>(null)
  const [statusTarget, setStatusTarget] = useState<ReelDto | null>(null)
  const returnReel = useReturnReel()

  const { data, isLoading } = useReels({
    status: search.status,
    customerId: search.customerId,
    productId: search.productId,
    page,
    pageSize: PAGE_SIZE,
  })
  // Include INACTIVE products here on purpose. Reels can reference a product
  // that was later deactivated; with an active-only list the lookup missed and
  // the table printed the raw product UUID instead of a name (which also blew
  // the column width out and forced horizontal scrolling).
  const { data: allProducts } = useProducts(true)
  const { data: customers } = useCustomers()

  // The filter dropdown should still only offer products you'd currently pick.
  const activeProducts = allProducts?.filter((p) => p.isActive)

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1
  const hasFilters = !!(search.status || search.customerId || search.productId)

  function updateFilter(next: Partial<typeof search>) {
    setPage(0)
    navigate({
      to: "/reels",
      search: (prev) => ({ ...prev, ...next }),
    })
  }

  function clearFilters() {
    setPage(0)
    navigate({ to: "/reels", search: {} })
  }

  return (
    <>
      <PageHeader
        title="Reel Tracking"
        description="Pending, returned, lost, and damaged reels across all customers."
        actions={
          <RequireRole minRole="operator" fallback={null}>
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus />
              Register reel
            </Button>
          </RequireRole>
        }
      />

      <div className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={search.status ?? "all"}
            onValueChange={(value) =>
              updateFilter({ status: value === "all" ? undefined : (value as ReelStatus) })
            }
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {REEL_STATUSES.map((status) => (
                <SelectItem key={status} value={status} className="capitalize">
                  {status.replace("_", " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={search.productId ?? "all"}
            onValueChange={(value) =>
              updateFilter({ productId: value === "all" ? undefined : value })
            }
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="All products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All products</SelectItem>
              {activeProducts?.map((product) => (
                <SelectItem key={product.id} value={product.id}>
                  {product.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={search.customerId ?? "all"}
            onValueChange={(value) =>
              updateFilter({ customerId: value === "all" ? undefined : value })
            }
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="All customers" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All customers</SelectItem>
              {customers?.map((customer) => (
                <SelectItem key={customer.id} value={customer.id}>
                  {customer.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X />
              Clear filters
            </Button>
          )}

          {/*
           * No `ml-auto` -- pushing this group to the far right fought the
           * flex-wrap and forced the filter row wider than the viewport.
           * Letting it sit inline means it wraps naturally instead.
           */}
          <div className="flex items-center gap-1 rounded-md border p-0.5">
            <Button
              variant={search.status === "dispatched" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => updateFilter({ status: "dispatched" })}
            >
              Dispatched
            </Button>
            <Button
              variant={search.status === "returned" ? "secondary" : "ghost"}
              size="sm"
              onClick={() => updateFilter({ status: "returned" })}
            >
              Returned
            </Button>
            <Button
              variant={!search.status ? "secondary" : "ghost"}
              size="sm"
              onClick={clearFilters}
            >
              All
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="px-0">
            {isLoading ? (
              <div className="flex flex-col gap-3 px-4 py-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : !data || data.items.length === 0 ? (
              <EmptyState
                icon={Disc3}
                title={hasFilters ? "No matching reels" : "No reels yet"}
                description={
                  hasFilters
                    ? "Try clearing or widening your filters to see more results."
                    : "Register your first reel to start tracking where it goes."
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  {/*
                   * Weight and Last updated are the least load-bearing columns,
                   * so they drop out on narrower windows rather than pushing the
                   * table into horizontal scroll. Everything is still on the
                   * detail page.
                   */}
                  <TableRow>
                    <TableHead>Reel number</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Holder</TableHead>
                    <TableHead className="hidden lg:table-cell">Weight</TableHead>
                    <TableHead className="hidden xl:table-cell">Updated</TableHead>
                    <TableHead className="w-px text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((reel) => {
                    const product = allProducts?.find((p) => p.id === reel.productId)
                    const customer = customers?.find(
                      (c) => c.id === reel.currentCustomerId
                    )
                    return (
                      <TableRow
                        key={reel.id}
                        className="cursor-pointer"
                        onClick={() =>
                          navigate({
                            to: "/reels/$reelNumber",
                            params: { reelNumber: reel.reelNumber },
                          })
                        }
                      >
                        <TableCell
                          className="max-w-[11rem] truncate font-medium"
                          title={reel.reelNumber}
                        >
                          {reel.reelNumber}
                        </TableCell>
                        <TableCell
                          className="max-w-[11rem] truncate"
                          title={product?.name ?? reel.productId}
                        >
                          {/* Show the name; only ever fall back to an id if the
                              product row is genuinely missing. */}
                          {product ? (
                            <span>
                              {product.name}
                              {!product.isActive && (
                                <span className="ml-1 text-xs text-muted-foreground">
                                  (inactive)
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-muted-foreground">Unknown product</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <ReelStatusBadge status={reel.status} />
                        </TableCell>
                        <TableCell
                          className="max-w-[10rem] truncate text-muted-foreground"
                          title={customer?.name ?? undefined}
                        >
                          {customer?.name ?? "—"}
                        </TableCell>
                        <TableCell className="hidden tabular-nums text-muted-foreground lg:table-cell">
                          {reel.weightKg ? `${reel.weightKg} kg` : "—"}
                        </TableCell>
                        <TableCell
                          className="hidden text-muted-foreground xl:table-cell"
                          title={parseResponseDateTime(reel.updatedAt).toLocaleString()}
                        >
                          {/* Date only -- the full timestamp is in the tooltip and
                              on the detail page. A full toLocaleString() here was
                              one of the widest cells in the table. */}
                          {parseResponseDateTime(reel.updatedAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell
                          className="text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <RequireRole minRole="operator" fallback={null}>
                            <div className="flex items-center gap-1">
                              {/* Quick path for the most common action. */}
                              {reel.status === "dispatched" && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => setReturnReelNumber(reel.reelNumber)}
                                >
                                  <Undo2 className="size-3.5" />
                                  Return
                                </Button>
                              )}
                              {/* Full status editor for everything else. */}
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                title="Change status"
                                onClick={() => setStatusTarget(reel)}
                              >
                                <Pencil className="size-3.5" />
                              </Button>
                            </div>
                          </RequireRole>
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
              Page {page + 1} of {totalPages} &middot; {data.total} total reels
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

      <RegisterReelDialog open={formOpen} onOpenChange={setFormOpen} />

      <ReelStatusDialog
        open={!!statusTarget}
        onOpenChange={(open) => !open && setStatusTarget(null)}
        reelNumber={statusTarget?.reelNumber ?? null}
        currentStatus={statusTarget?.status ?? null}
      />

      <ReelActionDialog
        open={!!returnReelNumber}
        onOpenChange={(open) => !open && setReturnReelNumber(null)}
        title="Return reel"
        description={`Mark reel #${returnReelNumber} as returned by its current holder.`}
        remarksRequired={false}
        confirmLabel="Confirm return"
        isPending={returnReel.isPending}
        onConfirm={(remarks) => {
          if (returnReelNumber) {
            returnReel.mutate(
              { reelNumber: returnReelNumber, remarks: remarks.trim() || null },
              { onSuccess: () => setReturnReelNumber(null) }
            )
          }
        }}
      />
    </>
  )
}
