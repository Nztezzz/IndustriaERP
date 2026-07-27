import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { ChevronLeft, ChevronRight, Plus, Truck } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { RequireRole } from "@/components/layout/require-role"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useDispatches } from "@/lib/api/hooks/use-dispatches"
import { useCustomers } from "@/lib/api/hooks/use-customers"
import { parseResponseDateTime } from "@/lib/api/datetime"
import { DispatchFormSheet } from "@/features/dispatches/dispatch-form-sheet"
import type { DispatchStatus } from "@/lib/constants"

const PAGE_SIZE = 25

const STATUS_VARIANT: Record<DispatchStatus, "outline" | "secondary" | "destructive"> = {
  pending: "outline",
  delivered: "secondary",
  cancelled: "destructive",
}

export function DispatchListPage() {
  const navigate = useNavigate()
  const [page, setPage] = useState(0)
  const { data, isLoading } = useDispatches({ page, pageSize: PAGE_SIZE })
  const { data: customers } = useCustomers()
  const [formOpen, setFormOpen] = useState(false)

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <>
      <PageHeader
        title="Dispatches"
        description="Dispatch entries with invoice, vehicle, and driver details."
        actions={
          <RequireRole minRole="operator" fallback={null}>
            <Button size="sm" onClick={() => setFormOpen(true)}>
              <Plus />
              New dispatch
            </Button>
          </RequireRole>
        }
      />

      <div className="flex flex-col gap-4 p-6">
        <Card>
          <CardContent className="px-0">
            {isLoading ? (
              <div className="flex flex-col gap-3 px-4 py-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : !data || data.items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
                <Truck className="size-8" />
                <p className="text-sm">No dispatches yet.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>Dispatch date</TableHead>
                    <TableHead>Weight</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.items.map((dispatch) => {
                    const customer = customers?.find((c) => c.id === dispatch.customerId)
                    return (
                      <TableRow
                        key={dispatch.id}
                        className="cursor-pointer"
                        onClick={() =>
                          navigate({
                            to: "/dispatches/$dispatchId",
                            params: { dispatchId: dispatch.id },
                          })
                        }
                      >
                        <TableCell className="font-medium">
                          {dispatch.invoiceNumber}
                        </TableCell>
                        <TableCell>{customer?.name ?? dispatch.customerId}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {parseResponseDateTime(dispatch.dispatchDate).toLocaleString()}
                        </TableCell>
                        <TableCell className="tabular-nums text-muted-foreground">
                          {dispatch.totalWeightKg ? `${dispatch.totalWeightKg} kg` : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={STATUS_VARIANT[dispatch.status]} className="capitalize">
                            {dispatch.status}
                          </Badge>
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
              Page {page + 1} of {totalPages} &middot; {data.total} total dispatches
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

      <DispatchFormSheet open={formOpen} onOpenChange={setFormOpen} />
    </>
  )
}
