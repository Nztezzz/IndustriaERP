import { useState } from "react"
import { FileSpreadsheet, FileText, Loader2, Table2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { exportToCsv, exportToExcel, exportToPdf, type ExportColumn } from "@/lib/export"

/**
 * Shared Excel/PDF/CSV export toolbar, used identically by every report
 * tab (task 22) so a report definition only has to describe its own
 * columns once. `rows` should be the CURRENTLY LOADED/filtered data for
 * the report -- exports operate on exactly what the user is looking at,
 * not a separate unfiltered fetch.
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
  const [pending, setPending] = useState<"excel" | "pdf" | "csv" | null>(null)
  const disabled = pending !== null || rows.length === 0

  async function run(kind: "excel" | "pdf" | "csv", action: () => Promise<void>) {
    setPending(kind)
    try {
      await action()
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="flex items-center gap-2">
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
      <Button
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => run("csv", () => exportToCsv(baseFileName, columns, rows))}
      >
        {pending === "csv" ? <Loader2 className="animate-spin" /> : <Table2 />}
        CSV
      </Button>
    </div>
  )
}
