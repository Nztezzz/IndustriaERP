import { useState } from "react"
import { FileSpreadsheet, FileText, Loader2, Printer } from "lucide-react"
import { jsPDF } from "jspdf"
import { autoTable } from "jspdf-autotable"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { exportToExcel, exportToPdf, type ExportColumn } from "@/lib/export"
import { addLogoToPdf } from "@/lib/logo-data"

/**
 * Shared Excel/PDF export + print toolbar for every report tab.
 * Print generates a landscape A4 PDF with the selected number of entries.
 */
export function ExportButtons<T>({
  baseFileName,
  title,
  columns,
  rows,
}: {
  baseFileName: string
  title: string
  columns: ExportColumn<T>[]
  rows: T[]
}) {
  const [pending, setPending] = useState<"excel" | "pdf" | null>(null)
  const [printCount, setPrintCount] = useState<string>("10")
  const disabled = pending !== null || rows.length === 0

  async function run(kind: "excel" | "pdf", action: () => Promise<void>) {
    setPending(kind)
    try {
      await action()
    } finally {
      setPending(null)
    }
  }

  async function handlePrint() {
    const count = printCount === "all" ? rows.length : parseInt(printCount, 10)
    const printRows = rows.slice(0, count)

    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
    const pageWidth = doc.internal.pageSize.getWidth()

    // Logo left and right (maintain 677:369 aspect ratio)
    await addLogoToPdf(doc, 8, 3, 22, 12)
    await addLogoToPdf(doc, pageWidth - 30, 3, 22, 12)

    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.text("PREYANSH METAL INDUSTRIES LLP", pageWidth / 2, 12, { align: "center" })
    doc.setFontSize(9)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(80)
    doc.text(title, pageWidth / 2, 18, { align: "center" })
    doc.setTextColor(30)
    doc.setFontSize(8)
    doc.text(`Showing ${printRows.length} of ${rows.length} entries | Generated: ${new Date().toLocaleString()}`, 14, 24)

    autoTable(doc, {
      startY: 28,
      head: [columns.map((c) => c.header)],
      body: printRows.map((row) => columns.map((c) => String(c.accessor(row) ?? ""))),
      theme: "grid",
      headStyles: { fillColor: [245, 130, 13], textColor: 255, fontStyle: "bold", fontSize: 7 },
      bodyStyles: { fontSize: 7 },
      styles: { cellPadding: 2, overflow: "linebreak" },
      margin: { left: 10, right: 10 },
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

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 rounded-md border px-2 py-1">
        <span className="text-xs text-muted-foreground">Print:</span>
        <Select value={printCount} onValueChange={setPrintCount}>
          <SelectTrigger className="h-7 w-24 border-0 bg-transparent p-1 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="5">Last 5</SelectItem>
            <SelectItem value="10">Last 10</SelectItem>
            <SelectItem value="20">Last 20</SelectItem>
            <SelectItem value="50">Last 50</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="default"
          size="sm"
          disabled={rows.length === 0}
          onClick={handlePrint}
          className="h-7"
        >
          <Printer className="size-3.5" />
          Print
        </Button>
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => run("excel", () => exportToExcel(baseFileName, title, columns, rows))}
      >
        {pending === "excel" ? <Loader2 className="animate-spin" /> : <FileSpreadsheet />}
        Excel
      </Button>
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => run("pdf", () => exportToPdf(baseFileName, title, columns, rows))}
      >
        {pending === "pdf" ? <Loader2 className="animate-spin" /> : <FileText />}
        PDF
      </Button>
    </div>
  )
}
