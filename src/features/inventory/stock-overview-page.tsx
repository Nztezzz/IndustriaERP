import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { AlertTriangle, Package, RefreshCw } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { EmptyState } from "@/components/layout/empty-state"
import { useStockBalances } from "@/lib/api/hooks/use-stock"
import { parseResponseDateTime } from "@/lib/api/datetime"

export function StockOverviewPage() {
  const navigate = useNavigate()
  const { data: balances, isLoading, isFetching, refetch } = useStockBalances()
  const [search, setSearch] = useState("")

  const filtered = balances?.filter(
    (b) =>
      b.productName.toLowerCase().includes(search.toLowerCase()) ||
      b.productSku.toLowerCase().includes(search.toLowerCase())
  )
  const lowStockCount = balances?.filter((b) => b.isLowStock).length ?? 0

  return (
    <>
      <PageHeader
        title="Stock Overview"
        description="Product-wise inventory levels, updated live from stock movements."
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            <RefreshCw className={isFetching ? "animate-spin" : ""} />
            Refresh
          </Button>
        }
      />

      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between gap-4">
          <Input
            placeholder="Search by product name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          {lowStockCount > 0 && (
            <Badge variant="warning" className="gap-1">
              <AlertTriangle className="size-3" />
              {lowStockCount} at or below reorder level
            </Badge>
          )}
        </div>

        <Card>
          <CardContent className="px-0">
            {isLoading ? (
              <div className="flex flex-col gap-3 px-4 py-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : !filtered || filtered.length === 0 ? (
              <EmptyState
                icon={Package}
                title={search ? "No matching products" : "No active products"}
                description={
                  search
                    ? "Try a different name or SKU, or clear the search box."
                    : "Add a product first, then record inward stock against it."
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>On hand</TableHead>
                    <TableHead>Reorder level</TableHead>
                    <TableHead>Last updated</TableHead>
                    <TableHead />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((balance) => (
                    <TableRow
                      key={balance.productId}
                      className="cursor-pointer"
                      onClick={() =>
                        navigate({
                          to: "/inventory/history",
                          search: { productId: balance.productId },
                        })
                      }
                    >
                      <TableCell className="font-medium">
                        {balance.productSku}
                      </TableCell>
                      <TableCell>{balance.productName}</TableCell>
                      <TableCell className="tabular-nums">
                        {balance.quantityOnHand} {balance.unitSymbol}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {balance.reorderLevel} {balance.unitSymbol}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {parseResponseDateTime(balance.updatedAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {balance.isLowStock && (
                          <Badge variant="warning" className="gap-1">
                            <AlertTriangle className="size-3" />
                            Low stock
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
