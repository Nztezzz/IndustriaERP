import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import { jsPDF } from "jspdf"
import { autoTable } from "jspdf-autotable"
import { addLogoToPdf } from "@/lib/logo-data"
import {
  Building2,
  Filter,
  Package,
  Printer,
  Search,
  Truck,
  type LucideIcon,
} from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { useSearch } from "@/lib/api/hooks/use-search"
import { useStockMovements } from "@/lib/api/hooks/use-stock"
import { useProducts } from "@/lib/api/hooks/use-products"
import { useCustomers } from "@/lib/api/hooks/use-customers"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { parseResponseDateTime } from "@/lib/api/datetime"
import type {
  CustomerSearchHit,
  DispatchSearchHit,
  ProductSearchHit,
  StockMovementDto,
} from "@/lib/api/types"


function ResultSection<T>({
  title,
  icon: Icon,
  hits,
  isLoading,
  emptyLabel,
  renderHit,
}: {
  title: string
  icon: LucideIcon
  hits: T[] | undefined
  isLoading: boolean
  emptyLabel: string
  renderHit: (hit: T) => React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        <CardTitle className="text-sm">{title}</CardTitle>
        {hits && hits.length > 0 && (
          <Badge variant="outline" className="ml-auto">
            {hits.length}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-1 px-2 pb-2">
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </>
        ) : !hits || hits.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          hits.map((hit, i) => <div key={i}>{renderHit(hit)}</div>)
        )}
      </CardContent>
    </Card>
  )
}

function HitRow({
  onClick,
  primary,
  secondary,
  trailing,
}: {
  onClick: () => void
  primary: string
  secondary?: string
  trailing?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
    >
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{primary}</span>
        {secondary && (
          <span className="truncate text-xs text-muted-foreground">{secondary}</span>
        )}
      </span>
      {trailing}
    </button>
  )
}

/**
 * Net quantity a movement contributes to a PARTY's ledger balance.
 *
 * This is a party-facing view, not a warehouse one, so the sign convention
 * differs from stock-history's:
 *  - `outward`   -> +qty, the party received goods
 *  - `return`    -> -qty, the party sent goods back
 *  - `inward`    ->  0,   internal production, no party involved
 *  - `adjustment`->  its signed delta
 *
 * Note `inward` deliberately contributes nothing. It used to be treated as
 * the return marker, which double-counted internal production against
 * whichever party happened to be on the remark.
 */
function ledgerQty(m: StockMovementDto): number {
  switch (m.movementType) {
    case "outward":
      return m.quantity
    case "return":
      return -m.quantity
    case "adjustment":
      return m.adjustmentDelta ?? 0
    default:
      return 0
  }
}

/** Sums `ledgerQty` across the movements for one product. */
function sumLedger(list: StockMovementDto[], productId: string | undefined): number {
  return list.reduce((s, m) => (m.productId === productId ? s + ledgerQty(m) : s), 0)
}

/** Party ledger view matching the reference spreadsheet format */
function RecentEntriesSection() {
  const { data: products } = useProducts(true)
  const { data: allCustomers } = useCustomers()
  const [filterCustomer, setFilterCustomer] = useState<string>("")
  const [filterProduct, setFilterProduct] = useState<string>("")
  const [filterDate, setFilterDate] = useState<string>("")
  const [entryCount, setEntryCount] = useState<number>(10)

  // Fetch recent movements
  const { data: movements } = useStockMovements({
    productId: filterProduct || undefined,
    page: 0,
    pageSize: entryCount,
    from: filterDate ? `${filterDate}T00:00:00` : undefined,
  })

  // Fetch ALL movements for old-data totals (larger page)
  const { data: allMovements } = useStockMovements({
    productId: filterProduct || undefined,
    page: 0,
    pageSize: 500,
    from: filterDate ? `${filterDate}T00:00:00` : undefined,
  })

  // Filter by customer if selected (customer name is stored in remarks as "Party: xyz")
  const rows = (movements?.items ?? []).filter((m) => {
    if (!filterCustomer) return true
    const customer = allCustomers?.find((c) => c.id === filterCustomer)
    if (!customer) return true
    return m.remarks?.includes(customer.name) ?? false
  })

  // All entries filtered by customer (for old data total)
  const allRows = (allMovements?.items ?? []).filter((m) => {
    if (!filterCustomer) return true
    const customer = allCustomers?.find((c) => c.id === filterCustomer)
    if (!customer) return true
    return m.remarks?.includes(customer.name) ?? false
  })

  // Old data = everything beyond the displayed entries
  const oldRows = allRows.slice(entryCount)

  // Build the product columns -- only show the 5 core products
  // (P. Reel + the size-based spools). Filter out debug/test products
  // so the table fits on screen without horizontal scroll.
  const CORE_PRODUCT_NAMES = ["Plastic Reel", "300 mm Spool", "500 mm Spool", "630 mm Spool", "800 mm Spool"]
  const coreProducts = (products ?? []).filter(p => CORE_PRODUCT_NAMES.includes(p.name))
  const productColumns = products ?? []
  const pReel = coreProducts.find(p => p.name === "Plastic Reel")
  const otherProducts = coreProducts.filter(p => p.name !== "Plastic Reel")

  // Calculate totals per product
  const totals: Record<string, number> = {}
  for (const row of rows) {
    const key = row.productId
    totals[key] = (totals[key] ?? 0) + ledgerQty(row)
  }

  async function handlePrint() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
    const pageWidth = doc.internal.pageSize.getWidth()

    // Logo (maintain 677:369 aspect ratio)
    await addLogoToPdf(doc, 8, 3, 22, 12)
    await addLogoToPdf(doc, pageWidth - 30, 3, 22, 12)

    // Header
    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.text("PREYANSH METAL INDUSTRIES LLP", pageWidth / 2, 12, { align: "center" })
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(80)
    doc.text("Party Ledger", pageWidth / 2, 17, { align: "center" })

    const customerName = filterCustomer
      ? allCustomers?.find((c) => c.id === filterCustomer)?.name ?? "All"
      : "All Parties"
    doc.setTextColor(30)
    doc.setFontSize(10)
    doc.text(`Party: ${customerName}`, 14, 24)
    if (filterDate) doc.text(`From: ${filterDate}`, pageWidth - 60, 24)

    // Table columns
    const heads = ["#", "Party Name", "Date", "P. Reel", ...productColumns.filter(p => p.name !== "Plastic Reel").map(p => p.name)]
    const pReel = productColumns.find(p => p.name === "Plastic Reel")
    const otherProducts = productColumns.filter(p => p.name !== "Plastic Reel")

    const bodyData = rows.map((m, i) => {
      // Extract party name from remarks
      const partyMatch = m.remarks?.match(/Party:\s*([^|]+)/)
      const party = partyMatch?.[1]?.trim() ?? "\u2014"
      // Extract date from remarks
      const dateMatch = m.remarks?.match(/\[(\d{4}-\d{2}-\d{2})\]/)
      const dateStr = dateMatch?.[1] ?? parseResponseDateTime(m.createdAt).toLocaleDateString()

      const isReturn = m.movementType === "return"
      const pReelVal = m.productId === pReel?.id ? (isReturn ? "RETURN" : String(m.quantity)) : "0"

      const otherVals = otherProducts.map(p => {
        if (m.productId !== p.id) return "0"
        return String(ledgerQty(m))
      })

      return [String(i + 1), party, dateStr, pReelVal, ...otherVals]
    })

    // Totals row
    const pReelTotal = sumLedger(rows, pReel?.id)
    const otherTotals = otherProducts.map((p) => sumLedger(rows, p.id))
    bodyData.push(["", "", "TOTAL", String(pReelTotal), ...otherTotals.map(String)])

    autoTable(doc, {
      startY: 28,
      head: [heads],
      body: bodyData,
      theme: "grid",
      headStyles: { fillColor: [245, 130, 13], textColor: 255, fontStyle: "bold", fontSize: 8 },
      bodyStyles: { fontSize: 8 },
      didParseCell: (data) => {
        if (data.row.index === bodyData.length - 1) {
          data.cell.styles.fontStyle = "bold"
          data.cell.styles.fillColor = [240, 239, 237]
        }
      },
    })

    const pdfBlob = doc.output("blob")
    const url = URL.createObjectURL(pdfBlob)
    const iframe = document.createElement("iframe")
    iframe.style.position = "fixed"
    iframe.style.top = "-10000px"
    iframe.style.left = "-10000px"
    iframe.style.width = "0"
    iframe.style.height = "0"
    iframe.style.border = "none"
    iframe.style.overflow = "hidden"
    iframe.src = url
    document.body.appendChild(iframe)
    iframe.onload = () => {
      setTimeout(() => {
        iframe.contentWindow?.print()
        setTimeout(() => {
          document.body.removeChild(iframe)
          URL.revokeObjectURL(url)
        }, 600000)
      }, 500)
    }
  }

  // For display
  return (
    <Card className="flex flex-col overflow-hidden">
      <CardHeader className="flex shrink-0 flex-row items-center justify-between py-3">
        <div className="flex items-center gap-2">
          <Filter className="size-4 text-muted-foreground" />
          <CardTitle className="text-sm">Party Ledger (Last {entryCount})</CardTitle>
        </div>
        <Button variant="outline" size="sm" onClick={handlePrint} disabled={rows.length === 0}>
          <Printer /> Print
        </Button>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pb-3 pt-0">
        <div className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
          <Select value={filterCustomer} onValueChange={setFilterCustomer}>
            <SelectTrigger className="w-56">
              <SelectValue placeholder="All parties" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All parties</SelectItem>
              {allCustomers?.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterProduct} onValueChange={setFilterProduct}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All products" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All products</SelectItem>
              {products?.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            className="w-44"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
          />
          <div className="flex items-center gap-1 rounded-md border p-0.5">
            {[5, 10].map((n) => (
              <Button
                key={n}
                variant={entryCount === n ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setEntryCount(n)}
              >
                Last {n}
              </Button>
            ))}
          </div>
          {(filterCustomer || filterProduct || filterDate) && (
            <Button variant="ghost" size="sm" onClick={() => { setFilterCustomer(""); setFilterProduct(""); setFilterDate("") }}>
              Clear
            </Button>
          )}
        </div>

        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No entries found.</p>
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[25%]">Party</TableHead>
                  <TableHead className="w-[15%]">Date</TableHead>
                  <TableHead className="w-[12%] text-center">P. Reel</TableHead>
                  {otherProducts.map((p) => (
                    <TableHead key={p.id} className="w-[12%] text-center">{p.name.replace(" mm Spool", " MM")}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((m) => {
                  const partyMatch = m.remarks?.match(/Party:\s*([^|]+)/)
                  const party = partyMatch?.[1]?.trim() ?? "\u2014"
                  const dateMatch = m.remarks?.match(/\[(\d{4}-\d{2}-\d{2})\]/)
                  const dateStr = dateMatch?.[1] ?? parseResponseDateTime(m.createdAt).toLocaleDateString()
                  const isReturn = m.movementType === "return"

                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{party}</TableCell>
                      <TableCell>{dateStr}</TableCell>
                      <TableCell className="text-center tabular-nums">
                        {m.productId === pReel?.id
                          ? isReturn ? <span className="text-info font-medium">RETURN</span> : m.quantity
                          : 0}
                      </TableCell>
                      {otherProducts.map((p) => (
                        <TableCell key={p.id} className="text-center tabular-nums">
                          {m.productId === p.id ? String(ledgerQty(m)) : "0"}
                        </TableCell>
                      ))}
                    </TableRow>
                  )
                })}
                {/* Old data totals row */}
                <TableRow className="border-t bg-muted/30 italic">
                  <TableCell></TableCell>
                  <TableCell className="text-muted-foreground">OLD</TableCell>
                  <TableCell className="text-center tabular-nums">
                    {sumLedger(oldRows, pReel?.id)}
                  </TableCell>
                  {otherProducts.map((p) => (
                    <TableCell key={p.id} className="text-center tabular-nums">
                      {sumLedger(oldRows, p.id)}
                    </TableCell>
                  ))}
                </TableRow>
                {/* Grand total row (current + old) */}
                <TableRow className="border-t-2 font-bold bg-muted/50">
                  <TableCell></TableCell>
                  <TableCell>TOTAL</TableCell>
                  <TableCell className="text-center tabular-nums">
                    {sumLedger(allRows, pReel?.id)}
                  </TableCell>
                  {otherProducts.map((p) => (
                    <TableCell key={p.id} className="text-center tabular-nums">
                      {sumLedger(allRows, p.id)}
                    </TableCell>
                  ))}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function GlobalSearchPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebouncedValue(query, 300)
  const { data, isFetching } = useSearch(debouncedQuery)

  const hasQuery = debouncedQuery.trim().length > 0
  const totalHits = data
    ? data.products.length +
      data.customers.length +
      data.dispatches.length
    : 0

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Search"
        description="Search across customers, products, invoices, and filter recent entries."
      />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-6 pb-4 pt-2">
        <div className="relative max-w-xl shrink-0">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search products, customers, invoice numbers..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>

        {/* Filtered recent entries section - always visible, takes remaining space */}
        <div className="min-h-0 flex-1 overflow-auto">
          <RecentEntriesSection />

          {hasQuery && (
            <div className="mt-4">
              {!isFetching && totalHits === 0 && (
                <p className="text-sm text-muted-foreground">
                  No results for &quot;{debouncedQuery}&quot;.
                </p>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <ResultSection<ProductSearchHit>
                  title="Products"
                  icon={Package}
                  hits={data?.products}
                  isLoading={isFetching}
                  emptyLabel="No matching products."
                  renderHit={(hit) => (
                    <HitRow
                      onClick={() =>
                        navigate({ to: "/products", search: { q: hit.sku } })
                      }
                      primary={hit.name}
                      secondary={hit.sku}
                    />
                  )}
                />

                <ResultSection<CustomerSearchHit>
                  title="Customers"
                  icon={Building2}
                  hits={data?.customers}
                  isLoading={isFetching}
                  emptyLabel="No matching customers."
                  renderHit={(hit) => (
                    <HitRow
                      onClick={() =>
                        navigate({
                          to: "/customers/$customerId",
                          params: { customerId: hit.id },
                        })
                      }
                      primary={hit.name}
                      secondary={hit.phone ?? undefined}
                    />
                  )}
                />

                <ResultSection<DispatchSearchHit>
                  title="Dispatches"
                  icon={Truck}
                  hits={data?.dispatches}
                  isLoading={isFetching}
                  emptyLabel="No matching dispatches."
                  renderHit={(hit) => (
                    <HitRow
                      onClick={() =>
                        navigate({
                          to: "/dispatches/$dispatchId",
                          params: { dispatchId: hit.id },
                        })
                      }
                      primary={hit.invoiceNumber}
                    />
                  )}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
