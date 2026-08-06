import { useState } from "react"
import { Plus, Printer, Trash2, History, ArrowLeft } from "lucide-react"
import { jsPDF } from "jspdf"
import { autoTable } from "jspdf-autotable"
import { toast } from "sonner"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { PageHeader } from "@/components/layout/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { addLogoToPdf } from "@/lib/logo-data"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { EmptyState } from "@/components/layout/empty-state"
import { useCustomers } from "@/lib/api/hooks/use-customers"
import {
  fetchPackingSlips,
  fetchPackingSlip,
  createPackingSlip,
  type PackingSlipDto,
  type PackingSlipLineItem,
} from "@/lib/api/packing-slips"

const SIZES = ["300", "480", "500", "630", "800"] as const

interface SlipRow extends PackingSlipLineItem {
  id: number
}

function computeNet(gross: string, tare: string): number {
  const g = parseFloat(gross) || 0
  const t = parseFloat(tare) || 0
  return Math.max(0, +(g - t).toFixed(3))
}

async function buildPdfDoc(
  partyName: string,
  invoiceNo: string,
  date: string,
  tempoNo: string,
  totalParcel: string,
  rows: { size: string; strand: string; meter: string; grossWeight: string; tareWeight: string }[],
  totalGross: number,
  totalTare: number,
  totalNet: number,
): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 14

  // Letterhead
  doc.setDrawColor(245, 130, 13)
  doc.setLineWidth(1.5)
  doc.line(margin, 10, pageWidth - margin, 10)

  // Logo on left (maintain 677:369 aspect ratio)
  await addLogoToPdf(doc, margin, 11, 22, 12)

  // Logo on right
  await addLogoToPdf(doc, pageWidth - margin - 22, 11, 22, 12)

  doc.setFontSize(18)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(10, 10, 10)
  doc.text("PREYANSH METAL INDUSTRIES LLP", pageWidth / 2, 20, { align: "center" })

  doc.setFontSize(10)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(80, 80, 80)
  doc.text("TUNDEL, NADIAD.", pageWidth / 2, 26, { align: "center" })

  doc.setDrawColor(200, 200, 200)
  doc.setLineWidth(0.3)
  doc.line(margin, 29, pageWidth - margin, 29)

  doc.setFontSize(14)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(245, 130, 13)
  doc.text("Packing Slip", pageWidth / 2, 36, { align: "center" })

  // Info
  const infoY = 44
  doc.setFontSize(10)
  doc.setTextColor(30, 30, 30)

  doc.setFont("helvetica", "bold")
  doc.text("Party Name:", margin, infoY)
  doc.setFont("helvetica", "normal")
  doc.text(partyName || "\u2014", margin + 28, infoY)

  doc.setFont("helvetica", "bold")
  doc.text("Invoice No:", margin, infoY + 6)
  doc.setFont("helvetica", "normal")
  doc.text(invoiceNo || "\u2014", margin + 26, infoY + 6)

  doc.setFont("helvetica", "bold")
  doc.text("Date:", pageWidth - margin - 40, infoY)
  doc.setFont("helvetica", "normal")
  doc.text(date, pageWidth - margin - 28, infoY)

  doc.setFont("helvetica", "bold")
  doc.text("Tempo No:", margin, infoY + 12)
  doc.setFont("helvetica", "normal")
  doc.text(tempoNo || "\u2014", margin + 24, infoY + 12)

  doc.setFont("helvetica", "bold")
  doc.text("Total Parcel:", pageWidth - margin - 44, infoY + 6)
  doc.setFont("helvetica", "normal")
  doc.text(totalParcel || "\u2014", pageWidth - margin - 18, infoY + 6)

  // Table
  const tableData = rows.map((r, idx) => [
    String(idx + 1),
    r.size,
    r.strand,
    r.meter,
    r.grossWeight || "0.000",
    r.tareWeight || "0.000",
    computeNet(r.grossWeight, r.tareWeight).toFixed(3),
  ])

  // Add total row inside the table
  tableData.push([
    "",
    "",
    "",
    "TOTAL",
    totalGross.toFixed(3),
    totalTare.toFixed(3),
    totalNet.toFixed(3),
  ])

  autoTable(doc, {
    startY: infoY + 18,
    head: [["#", "Size", "Strand", "Meter", "Gross Wt", "Tare Wt", "Net Wt"]],
    body: tableData,
    theme: "grid",
    headStyles: { fillColor: [245, 130, 13], textColor: 255, fontStyle: "bold", fontSize: 9, halign: "center" },
    bodyStyles: { fontSize: 9 },
    columnStyles: {
      0: { halign: "center", cellWidth: 10 },
      1: { halign: "center", cellWidth: 18 },
      2: { halign: "center", cellWidth: 18 },
      3: { cellWidth: 40 },
      4: { halign: "right", cellWidth: 28 },
      5: { halign: "right", cellWidth: 28 },
      6: { halign: "right", cellWidth: 28 },
    },
    didParseCell: (data) => {
      // Bold the last row (total row)
      if (data.row.index === tableData.length - 1) {
        data.cell.styles.fontStyle = "bold"
        data.cell.styles.fillColor = [240, 239, 237]
      }
    },
  })

  const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 6

  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.setTextColor(30, 30, 30)
  doc.text(`Net Weight: ${totalNet.toFixed(3)}`, pageWidth / 2, finalY, { align: "center" })

  doc.setDrawColor(245, 130, 13)
  doc.setLineWidth(0.8)
  doc.line(margin, finalY + 6, pageWidth - margin, finalY + 6)

  doc.setFontSize(8)
  doc.setFont("helvetica", "normal")
  doc.setTextColor(120, 120, 120)
  doc.text("This is a computer-generated packing slip.", pageWidth / 2, finalY + 11, { align: "center" })

  return doc
}

function NewSlipTab() {
  const { data: customers } = useCustomers()
  const queryClient = useQueryClient()
  const [partyName, setPartyName] = useState("")
  const [invoiceNo, setInvoiceNo] = useState("")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [tempoNo, setTempoNo] = useState("")
  const [totalParcel, setTotalParcel] = useState("")
  const [rows, setRows] = useState<SlipRow[]>([
    { id: 1, size: "480", strand: "1", meter: "Copper Wire", grossWeight: "", tareWeight: "" },
  ])
  const [saving, setSaving] = useState(false)

  let nextId = rows.length > 0 ? Math.max(...rows.map((r) => r.id)) + 1 : 1

  function addRow() {
    setRows((prev) => [
      ...prev,
      { id: nextId++, size: "480", strand: "1", meter: "Copper Wire", grossWeight: "", tareWeight: "" },
    ])
  }

  function removeRow(id: number) {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  function updateRow(id: number, field: keyof SlipRow, value: string) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
  }

  const totalGross = rows.reduce((sum, r) => sum + (parseFloat(r.grossWeight) || 0), 0)
  const totalTare = rows.reduce((sum, r) => sum + (parseFloat(r.tareWeight) || 0), 0)
  const totalNet = rows.reduce((sum, r) => sum + computeNet(r.grossWeight, r.tareWeight), 0)

  async function handleSaveAndPrint() {
    if (!partyName || !invoiceNo) {
      toast.error("Party Name and Invoice No are required")
      return
    }
    setSaving(true)
    try {
      await createPackingSlip({
        partyName, invoiceNo, date,
        tempoNo: tempoNo || null,
        totalParcel: totalParcel || null,
        lineItems: rows.map(({ size, strand, meter, grossWeight, tareWeight }) => ({ size, strand, meter, grossWeight, tareWeight })),
        totalGross, totalTare, totalNet,
      })
      queryClient.invalidateQueries({ queryKey: ["packing-slips"] })
      toast.success("Packing slip saved")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save slip")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader><CardTitle>Slip Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col gap-1.5">
              <Label>Party Name *</Label>
              <Select value={partyName} onValueChange={setPartyName}>
                <SelectTrigger><SelectValue placeholder="Select party" /></SelectTrigger>
                <SelectContent>
                  {customers?.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Invoice No *</Label>
              <Input value={invoiceNo} onChange={(e) => setInvoiceNo(e.target.value)} placeholder="PMI-2026/27-0362" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Tempo No</Label>
              <Input value={tempoNo} onChange={(e) => setTempoNo(e.target.value)} placeholder="GJ07TU4875" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Total Parcel</Label>
              <Input value={totalParcel} onChange={(e) => setTotalParcel(e.target.value)} placeholder="30+10" />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Line Items</CardTitle>
          <Button size="sm" onClick={addRow}><Plus /> Add Row</Button>
        </CardHeader>
        <CardContent className="px-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-20">Size (mm)</TableHead>
                <TableHead className="w-20">Strand</TableHead>
                <TableHead>Meter</TableHead>
                <TableHead className="w-28">Gross Wt</TableHead>
                <TableHead className="w-28">Tare Wt</TableHead>
                <TableHead className="w-28">Net Wt</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <Select value={row.size} onValueChange={(v) => updateRow(row.id, "size", v)}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SIZES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell><Input className="h-8 w-16" value={row.strand} onChange={(e) => updateRow(row.id, "strand", e.target.value)} /></TableCell>
                  <TableCell><Input className="h-8" value={row.meter} onChange={(e) => updateRow(row.id, "meter", e.target.value)} /></TableCell>
                  <TableCell><Input className="h-8" type="number" step="0.001" value={row.grossWeight} onChange={(e) => updateRow(row.id, "grossWeight", e.target.value)} placeholder="0.000" /></TableCell>
                  <TableCell><Input className="h-8" type="number" step="0.001" value={row.tareWeight} onChange={(e) => updateRow(row.id, "tareWeight", e.target.value)} placeholder="0.000" /></TableCell>
                  <TableCell className="tabular-nums font-medium text-right">{computeNet(row.grossWeight, row.tareWeight).toFixed(3)}</TableCell>
                  <TableCell><Button variant="ghost" size="sm" onClick={() => removeRow(row.id)} className="text-destructive"><Trash2 className="size-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">Total Gross</p>
              <p className="text-lg font-semibold tabular-nums">{totalGross.toFixed(3)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Tare</p>
              <p className="text-lg font-semibold tabular-nums">{totalTare.toFixed(3)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Net Weight</p>
              <p className="text-lg font-bold tabular-nums text-primary">{totalNet.toFixed(3)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button onClick={handleSaveAndPrint} disabled={saving}>
          Save
        </Button>
      </div>
    </div>
  )
}

function PreviousRecordsTab() {
  const { data: slips, isLoading } = useQuery({
    queryKey: ["packing-slips"],
    queryFn: fetchPackingSlips,
  })
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data: selected } = useQuery({
    queryKey: ["packing-slips", selectedId],
    queryFn: () => fetchPackingSlip(selectedId!),
    enabled: !!selectedId,
  })

  async function handlePrint(slip: PackingSlipDto) {
    const doc = await buildPdfDoc(
      slip.partyName, slip.invoiceNo, slip.date,
      slip.tempoNo || "", slip.totalParcel || "",
      slip.lineItems, slip.totalGross, slip.totalTare, slip.totalNet,
    )
    // Create a blob and open in a hidden iframe to trigger system print dialog
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
        // Cleanup after 10 minutes
        setTimeout(() => {
          document.body.removeChild(iframe)
          URL.revokeObjectURL(url)
        }, 600000)
      }, 500)
    }
  }

  if (selectedId && selected) {
    return (
      <div className="flex flex-col gap-4">
        <Button variant="outline" size="sm" className="w-fit" onClick={() => setSelectedId(null)}>
          <ArrowLeft /> Back to records
        </Button>
        <Card>
          <CardHeader>
            <CardTitle>Packing Slip: {selected.invoiceNo}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2 text-sm lg:grid-cols-4">
              <div><span className="text-muted-foreground">Party:</span> {selected.partyName}</div>
              <div><span className="text-muted-foreground">Date:</span> {selected.date}</div>
              <div><span className="text-muted-foreground">Tempo:</span> {selected.tempoNo || "\u2014"}</div>
              <div><span className="text-muted-foreground">Parcel:</span> {selected.totalParcel || "\u2014"}</div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Strand</TableHead>
                  <TableHead>Meter</TableHead>
                  <TableHead>Gross</TableHead>
                  <TableHead>Tare</TableHead>
                  <TableHead>Net</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {selected.lineItems.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell>{item.size}</TableCell>
                    <TableCell>{item.strand}</TableCell>
                    <TableCell>{item.meter}</TableCell>
                    <TableCell>{item.grossWeight}</TableCell>
                    <TableCell>{item.tareWeight}</TableCell>
                    <TableCell className="font-medium">{computeNet(item.grossWeight, item.tareWeight).toFixed(3)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <div className="grid grid-cols-3 gap-4 text-center pt-2 border-t">
              <div><span className="text-sm text-muted-foreground">Gross:</span> <strong>{selected.totalGross.toFixed(3)}</strong></div>
              <div><span className="text-sm text-muted-foreground">Tare:</span> <strong>{selected.totalTare.toFixed(3)}</strong></div>
              <div><span className="text-sm text-muted-foreground">Net:</span> <strong className="text-primary">{selected.totalNet.toFixed(3)}</strong></div>
            </div>
            <Button className="w-fit" onClick={() => handlePrint(selected)}>
              <Printer /> Print
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <Card>
      <CardContent className="px-0">
        {isLoading ? (
          <div className="flex flex-col gap-3 px-4 py-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-9 w-full" />)}
          </div>
        ) : !slips || slips.length === 0 ? (
          <EmptyState
            icon={History}
            title="No packing slips yet"
            description="Slips you save from the New Slip tab will appear here, ready to reprint."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice No</TableHead>
                <TableHead>Party Name</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Net Weight</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slips.map((slip) => (
                <TableRow key={slip.id} className="cursor-pointer" onClick={() => setSelectedId(slip.id)}>
                  <TableCell className="font-medium">{slip.invoiceNo}</TableCell>
                  <TableCell>{slip.partyName}</TableCell>
                  <TableCell>{slip.date}</TableCell>
                  <TableCell className="tabular-nums">{slip.totalNet.toFixed(3)}</TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="sm" onClick={() => handlePrint(slip)}>
                      <Printer className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

export function PackingSlipPage() {
  return (
    <>
      <PageHeader
        title="Packing Slip"
        description="Create packing slips and access previous records."
      />
      <div className="p-6">
        <Tabs defaultValue="new">
          <TabsList>
            <TabsTrigger value="new">New Slip</TabsTrigger>
            <TabsTrigger value="records">Previous Records</TabsTrigger>
          </TabsList>
          <TabsContent value="new" className="pt-4">
            <NewSlipTab />
          </TabsContent>
          <TabsContent value="records" className="pt-4">
            <PreviousRecordsTab />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}
