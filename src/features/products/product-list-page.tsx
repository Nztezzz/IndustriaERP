import { useState } from "react"
import { useSearch } from "@tanstack/react-router"
import { MoreHorizontal, Package, Pencil, Plus, XCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/layout/page-header"
import { RequireRole } from "@/components/layout/require-role"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { EmptyState } from "@/components/layout/empty-state"
import { useDeactivateProduct, useProducts } from "@/lib/api/hooks/use-products"
import { ProductFormDialog } from "@/features/products/product-form-dialog"
import type { ProductDto } from "@/lib/api/types"

export function ProductListPage() {
  const routeSearch = useSearch({ from: "/_authenticated/products/" })
  // Seeded from the route's `q` search param so a hit on the global
  // Search page (task 21) can deep-link straight to a pre-filtered list
  // instead of dumping the user on the full unfiltered catalog.
  const [search, setSearch] = useState(routeSearch.q ?? "")
  const [includeInactive, setIncludeInactive] = useState(false)
  const { data: allProducts, isLoading } = useProducts(includeInactive)
  const deactivateProduct = useDeactivateProduct()

  const products = allProducts?.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
  )

  const [formOpen, setFormOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState<ProductDto | null>(null)
  const [deactivatingProduct, setDeactivatingProduct] =
    useState<ProductDto | null>(null)

  function openCreate() {
    setEditingProduct(null)
    setFormOpen(true)
  }

  function openEdit(product: ProductDto) {
    setEditingProduct(product)
    setFormOpen(true)
  }

  async function confirmDeactivate(event: React.MouseEvent) {
    event.preventDefault()
    if (!deactivatingProduct) return
    try {
      await deactivateProduct.mutateAsync(deactivatingProduct.id)
      setDeactivatingProduct(null)
    } catch {
      // Error toast already shown by useDeactivateProduct's onError.
    }
  }

  return (
    <>
      <PageHeader
        title="Products"
        description="Manage products, specifications, and reorder levels."
        actions={
          <RequireRole minRole="operator" fallback={null}>
            <Button size="sm" onClick={openCreate}>
              <Plus />
              New product
            </Button>
          </RequireRole>
        }
      />

      <div className="flex flex-col gap-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <Input
            placeholder="Search by product name or SKU..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-sm"
          />
          <div className="flex items-center gap-2">
            <Switch
              id="include-inactive"
              checked={includeInactive}
              onCheckedChange={setIncludeInactive}
            />
            <Label htmlFor="include-inactive" className="text-sm font-normal">
              Show deactivated products
            </Label>
          </div>
        </div>

        <Card>
          <CardContent className="px-0">
            {isLoading ? (
              <div className="flex flex-col gap-3 px-4 py-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : !products || products.length === 0 ? (
              <EmptyState
                icon={Package}
                title={search ? "No matching products" : "No products yet"}
                description={
                  search
                    ? "Try a different name or SKU, or clear the search box."
                    : "Add your first product to start tracking stock against it."
                }
                action={
                  !search ? (
                    <RequireRole minRole="operator" fallback={null}>
                      <Button size="sm" onClick={openCreate}>
                        <Plus />
                        New product
                      </Button>
                    </RequireRole>
                  ) : undefined
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Reorder level</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {products.map((product) => (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.sku}</TableCell>
                      <TableCell>{product.name}</TableCell>
                      <TableCell>{product.baseUnitSymbol ?? "—"}</TableCell>
                      <TableCell className="tabular-nums">
                        {product.reorderLevel}
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.isActive ? "outline" : "secondary"}>
                          {product.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <RequireRole minRole="operator" fallback={null}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon-sm">
                                <MoreHorizontal />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onSelect={() => openEdit(product)}>
                                <Pencil />
                                Edit
                              </DropdownMenuItem>
                              {product.isActive && (
                                <DropdownMenuItem
                                  variant="destructive"
                                  onSelect={() => setDeactivatingProduct(product)}
                                >
                                  <XCircle />
                                  Deactivate
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </RequireRole>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <ProductFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        product={editingProduct}
      />

      <AlertDialog
        open={!!deactivatingProduct}
        onOpenChange={(open) => !open && setDeactivatingProduct(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate product?</AlertDialogTitle>
            <AlertDialogDescription>
              &quot;{deactivatingProduct?.name}&quot; will be hidden from active
              pickers and lists. Its stock history, dispatches, and reels
              stay intact, and it can be reactivated later by editing it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmDeactivate}
              disabled={deactivateProduct.isPending}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
