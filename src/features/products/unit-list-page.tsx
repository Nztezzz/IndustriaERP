import { useState } from "react"
import { MoreHorizontal, Pencil, Plus, Ruler, Trash2 } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { RequireRole } from "@/components/layout/require-role"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
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
import { useDeleteUnit, useUnits } from "@/lib/api/hooks/use-units"
import { UnitFormDialog } from "@/features/products/unit-form-dialog"
import type { UnitDto } from "@/lib/api/types"

export function UnitListPage() {
  const { data: units, isLoading } = useUnits()
  const deleteUnit = useDeleteUnit()

  const [formOpen, setFormOpen] = useState(false)
  const [editingUnit, setEditingUnit] = useState<UnitDto | null>(null)
  const [deletingUnit, setDeletingUnit] = useState<UnitDto | null>(null)

  function openCreate() {
    setEditingUnit(null)
    setFormOpen(true)
  }

  function openEdit(unit: UnitDto) {
    setEditingUnit(unit)
    setFormOpen(true)
  }

  async function confirmDelete(event: React.MouseEvent) {
    // Radix's AlertDialogAction auto-closes the dialog on click unless we
    // prevent the default -- we need that suppressed so a failed delete
    // (e.g. "unit still in use by a product") keeps the dialog open with
    // the error visible instead of silently vanishing either way.
    event.preventDefault()
    if (!deletingUnit) return
    try {
      await deleteUnit.mutateAsync(deletingUnit.id)
      setDeletingUnit(null)
    } catch {
      // Error toast already shown by useDeleteUnit's onError.
    }
  }

  return (
    <>
      <PageHeader
        title="Units"
        description="Manage unit types and conversion factors."
        actions={
          <RequireRole minRole="operator" fallback={null}>
            <Button size="sm" onClick={openCreate}>
              <Plus />
              New unit
            </Button>
          </RequireRole>
        }
      />

      <div className="p-6">
        <Card>
          <CardContent className="px-0">
            {isLoading ? (
              <div className="flex flex-col gap-3 px-4 py-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : !units || units.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
                <Ruler className="size-8" />
                <p className="text-sm">No units yet. Create one to get started.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Symbol</TableHead>
                    <TableHead>Conversion factor</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {units.map((unit) => (
                    <TableRow key={unit.id}>
                      <TableCell className="font-medium">{unit.name}</TableCell>
                      <TableCell>{unit.symbol}</TableCell>
                      <TableCell className="tabular-nums">
                        {unit.conversionFactor}
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
                              <DropdownMenuItem onSelect={() => openEdit(unit)}>
                                <Pencil />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                variant="destructive"
                                onSelect={() => setDeletingUnit(unit)}
                              >
                                <Trash2 />
                                Delete
                              </DropdownMenuItem>
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

      <UnitFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        unit={editingUnit}
      />

      <AlertDialog
        open={!!deletingUnit}
        onOpenChange={(open) => !open && setDeletingUnit(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete unit?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete &quot;{deletingUnit?.name}&quot;. This
              only works if no product currently uses this unit.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteUnit.isPending}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
