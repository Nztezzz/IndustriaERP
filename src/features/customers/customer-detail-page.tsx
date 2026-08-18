import { useState } from "react"
import { useNavigate, useParams } from "@tanstack/react-router"
import {
  ArrowLeft,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ReceiptText,
} from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { RequireRole } from "@/components/layout/require-role"
import { useCustomer } from "@/lib/api/hooks/use-customers"
import { CustomerFormDialog } from "@/features/customers/customer-form-dialog"

export function CustomerDetailPage() {
  const navigate = useNavigate()
  const { customerId } = useParams({
    from: "/_authenticated/customers/$customerId",
  })
  const { data: customer, isLoading } = useCustomer(customerId)
  const [editOpen, setEditOpen] = useState(false)

  return (
    <>
      <PageHeader
        title={isLoading ? "Loading..." : customer?.name ?? "Customer not found"}
        description="Contact details."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate({ to: "/customers" })}>
              <ArrowLeft />
              Back to customers
            </Button>
            <RequireRole minRole="operator" fallback={null}>
              {customer && (
                <Button size="sm" onClick={() => setEditOpen(true)}>
                  <Pencil />
                  Edit
                </Button>
              )}
            </RequireRole>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
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
            ) : !customer ? (
              <p className="text-sm text-muted-foreground">
                This customer could not be found.
              </p>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <Badge variant={customer.isActive ? "outline" : "secondary"}>
                    {customer.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                {customer.contactPerson && (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Contact: </span>
                    {customer.contactPerson}
                  </div>
                )}
                {customer.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="size-4 text-muted-foreground" />
                    {customer.phone}
                  </div>
                )}
                {customer.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="size-4 text-muted-foreground" />
                    {customer.email}
                  </div>
                )}
                {customer.address && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="size-4 shrink-0 text-muted-foreground" />
                    <span>{customer.address}</span>
                  </div>
                )}
                {customer.gstNumber && (
                  <div className="flex items-center gap-2 text-sm">
                    <ReceiptText className="size-4 text-muted-foreground" />
                    {customer.gstNumber}
                  </div>
                )}
                {!customer.contactPerson &&
                  !customer.phone &&
                  !customer.email &&
                  !customer.address &&
                  !customer.gstNumber && (
                    <p className="text-sm text-muted-foreground">
                      No additional contact details on file.
                    </p>
                  )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {customer && (
        <CustomerFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          customer={customer}
        />
      )}
    </>
  )
}
