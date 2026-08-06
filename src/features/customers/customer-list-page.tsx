import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { Building2, Pencil, Plus } from "lucide-react"
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
import { EmptyState } from "@/components/layout/empty-state"
import { useCustomers } from "@/lib/api/hooks/use-customers"
import { CustomerFormDialog } from "@/features/customers/customer-form-dialog"
import type { CustomerDto } from "@/lib/api/types"

export function CustomerListPage() {
  const navigate = useNavigate()
  const [includeInactive, setIncludeInactive] = useState(false)
  const { data: customers, isLoading } = useCustomers(includeInactive)

  const [formOpen, setFormOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState<CustomerDto | null>(null)

  function openCreate() {
    setEditingCustomer(null)
    setFormOpen(true)
  }

  function openEdit(event: React.MouseEvent, customer: CustomerDto) {
    // Row click navigates to the detail page -- the edit button inside
    // the row needs to stop that click from bubbling up to it.
    event.stopPropagation()
    setEditingCustomer(customer)
    setFormOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Customers"
        description="Customer directory with purchase history and pending reels."
        actions={
          <RequireRole minRole="operator" fallback={null}>
            <Button size="sm" onClick={openCreate}>
              <Plus />
              New customer
            </Button>
          </RequireRole>
        }
      />

      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-2">
          <Switch
            id="include-inactive"
            checked={includeInactive}
            onCheckedChange={setIncludeInactive}
          />
          <Label htmlFor="include-inactive" className="text-sm font-normal">
            Show deactivated customers
          </Label>
        </div>

        <Card>
          <CardContent className="px-0">
            {isLoading ? (
              <div className="flex flex-col gap-3 px-4 py-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : !customers || customers.length === 0 ? (
              <EmptyState
                icon={Building2}
                title="No customers yet"
                description="Add your first customer to start recording dispatches and reel movements against them."
                action={
                  <RequireRole minRole="operator" fallback={null}>
                    <Button size="sm" onClick={openCreate}>
                      <Plus />
                      New customer
                    </Button>
                  </RequireRole>
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>GST number</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((customer) => (
                    <TableRow
                      key={customer.id}
                      className="cursor-pointer"
                      onClick={() =>
                        navigate({
                          to: "/customers/$customerId",
                          params: { customerId: customer.id },
                        })
                      }
                    >
                      <TableCell className="font-medium">{customer.name}</TableCell>
                      <TableCell>{customer.contactPerson ?? "—"}</TableCell>
                      <TableCell>{customer.phone ?? "—"}</TableCell>
                      <TableCell>{customer.gstNumber ?? "—"}</TableCell>
                      <TableCell>
                        <Badge variant={customer.isActive ? "outline" : "secondary"}>
                          {customer.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <RequireRole minRole="operator" fallback={null}>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={(e) => openEdit(e, customer)}
                          >
                            <Pencil />
                          </Button>
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

      <CustomerFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        customer={editingCustomer}
      />
    </>
  )
}
