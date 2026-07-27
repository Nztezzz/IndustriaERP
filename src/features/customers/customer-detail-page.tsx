import { useState } from "react"
import { useNavigate, useParams } from "@tanstack/react-router"
import {
  ArrowLeft,
  Disc3,
  Mail,
  MapPin,
  Pencil,
  Phone,
  ReceiptText,
  Truck,
  Undo2,
  AlertTriangle,
  ShieldAlert,
  type LucideIcon,
} from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { RequireRole } from "@/components/layout/require-role"
import { useCustomer, useCustomerReelHistory } from "@/lib/api/hooks/use-customers"
import { CustomerFormDialog } from "@/features/customers/customer-form-dialog"
import { parseResponseDateTime } from "@/lib/api/datetime"
import type { CustomerReelMovementDto } from "@/lib/api/types"

const EVENT_META: Record<string, { icon: LucideIcon; label: string; className: string }> = {
  created: { icon: Disc3, label: "Registered", className: "bg-muted text-muted-foreground" },
  dispatched: { icon: Truck, label: "Dispatched", className: "bg-primary/10 text-primary" },
  returned: { icon: Undo2, label: "Returned", className: "bg-secondary text-secondary-foreground" },
  lost: { icon: AlertTriangle, label: "Lost", className: "bg-destructive/10 text-destructive" },
  damaged: { icon: ShieldAlert, label: "Damaged", className: "bg-destructive/10 text-destructive" },
}

function ReelHistoryRow({ entry }: { entry: CustomerReelMovementDto }) {
  const meta = EVENT_META[entry.eventType] ?? {
    icon: Disc3,
    label: entry.eventType,
    className: "bg-muted text-muted-foreground",
  }
  const Icon = meta.icon
  const timestamp = parseResponseDateTime(entry.createdAt)

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className={`flex size-8 shrink-0 items-center justify-center rounded-full ${meta.className}`}>
        <Icon className="size-4" />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm">
          {meta.label} reel <span className="font-medium">#{entry.reelNumber}</span>{" "}
          <span className="text-muted-foreground">({entry.productName})</span>
        </span>
        {entry.remarks && (
          <span className="text-xs text-muted-foreground">{entry.remarks}</span>
        )}
        <time
          dateTime={timestamp.toISOString()}
          title={timestamp.toLocaleString()}
          className="text-xs text-muted-foreground"
        >
          {timestamp.toLocaleString()}
        </time>
      </div>
    </li>
  )
}

export function CustomerDetailPage() {
  const navigate = useNavigate()
  const { customerId } = useParams({
    from: "/_authenticated/customers/$customerId",
  })
  const { data: customer, isLoading } = useCustomer(customerId)
  const { data: history, isLoading: isHistoryLoading } =
    useCustomerReelHistory(customerId)
  const [editOpen, setEditOpen] = useState(false)

  const pendingCount =
    history?.filter((h) => h.eventType === "dispatched").length ?? 0

  return (
    <>
      <PageHeader
        title={isLoading ? "Loading..." : customer?.name ?? "Customer not found"}
        description="Contact details and reel history."
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
                  {pendingCount > 0 && (
                    <Badge variant="secondary">
                      {pendingCount} reel{pendingCount === 1 ? "" : "s"} out
                    </Badge>
                  )}
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

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Reel history</CardTitle>
          </CardHeader>
          <CardContent className="px-0">
            {isHistoryLoading ? (
              <div className="flex flex-col gap-4 p-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <Skeleton className="size-8 shrink-0 rounded-full" />
                    <Skeleton className="h-4 flex-1" />
                  </div>
                ))}
              </div>
            ) : !history || history.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
                <Disc3 className="size-8" />
                <p className="text-sm">No reel activity for this customer yet.</p>
              </div>
            ) : (
              <ul className="flex flex-col divide-y">
                {history.map((entry) => (
                  <ReelHistoryRow key={entry.id} entry={entry} />
                ))}
              </ul>
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
