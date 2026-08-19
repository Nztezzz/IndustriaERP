/**
 * Shared export helpers used by every report tab (task 22). Handles the
 * three formats -- Excel (.xlsx), PDF, and CSV -- through a single narrow
 * `ExportColumn<T>` shape so each report only has to describe its own
 * columns once and reuse the same save flow.
 *
 * IMPORTANT (Tauri, not a browser): exceljs/jspdf/papaparse all normally
 * target browser `Blob` + `<a download>` APIs, which don't meaningfully
 * exist the same way inside a Tauri webview (there's no "downloads
 * folder" concept the OS wires up automatically). Instead:
 *   1. `@tauri-apps/plugin-dialog`'s `save()` opens a native "Save As"
 *      picker and returns the chosen absolute path (or `null` if the
 *      user cancelled -- NOT an error, just a no-op).
 *   2. Each library is asked for its output as raw bytes
 *      (`workbook.xlsx.writeBuffer()` / `doc.output("arraybuffer")`)
 *      rather than a Blob.
 *   3. `@tauri-apps/plugin-fs`'s `writeFile` (binary) or `writeTextFile`
 *      (CSV, plain UTF-8 text) writes those bytes to the path from (1).
 * The `save()` command automatically grants filesystem scope for the
 * exact path the user picked, so no broad static path allow-list is
 * needed in capabilities -- see src-tauri/capabilities/default.json for
 * the narrow `dialog:allow-save` + `fs:allow-write-file` /
 * `fs:allow-write-text-file` permissions this depends on.
 */
import { save } from "@tauri-apps/plugin-dialog"
import { writeFile, writeTextFile } from "@tauri-apps/plugin-fs"
// exceljs and papaparse ship type declarations with no `export default`
// (this project's tsconfig has neither esModuleInterop nor
// allowSyntheticDefaultImports set), so both need a named/namespace
// import rather than a default import -- a default import of either
// would fail typecheck with "module has no default export".
import { Workbook } from "exceljs"
import { jsPDF } from "jspdf"
import { autoTable } from "jspdf-autotable"
import { unparse } from "papaparse"
import { toast } from "sonner"

export interface ExportColumn<T> {
  header: string
  /** Cell/column value for this row. `null` renders as a blank cell. */
  accessor: (row: T) => string | number | null
  /**
   * Value for this column in the TOTAL footer row. Declared per column so
   * a report describes its totals once and every output path (on-screen
   * table, Excel, PDF, Print) stays in agreement -- previously exports had
   * no totals at all while some screens did.
   *
   * Omit for columns that shouldn't be summed (SKU, product name, dates).
   * The footer row is only emitted when at least one column defines this.
   */
  total?: (rows: T[]) => string | number | null
}

/** True when any column contributes to a TOTAL row. */
export function hasTotals<T>(columns: ExportColumn<T>[]): boolean {
  return columns.some((c) => c.total)
}

/**
 * Builds the TOTAL footer cells for `rows`. The first column is labelled
 * "TOTAL" when it has no `total` of its own, so the row is readable
 * instead of starting with a blank cell.
 */
export function buildTotalsRow<T>(
  columns: ExportColumn<T>[],
  rows: T[]
): string[] {
  return columns.map((column, index) => {
    if (column.total) return String(column.total(rows) ?? "")
    return index === 0 ? "TOTAL" : ""
  })
}

/** Sums a numeric field across rows, tolerating null/undefined values. */
export function sumBy<T>(rows: T[], pick: (row: T) => number | null | undefined): number {
  return rows.reduce((acc, row) => acc + (pick(row) ?? 0), 0)
}

/**
 * Converts whatever byte-buffer-like value exceljs/jspdf hand back
 * (a real `ArrayBuffer`, or a Node/browserify `Buffer` -- itself a
 * `Uint8Array` subclass -- depending on which build gets bundled) into a
 * plain `Uint8Array` that `writeFile` accepts. `new Uint8Array(x)` is
 * safe for both cases: for a real `ArrayBuffer` it creates a view; for
 * an existing typed array it copies the underlying bytes element-by-
 * element (the same mechanism used to clone a typed array) -- so this
 * works correctly regardless of which shape a given bundle produces.
 */
function toUint8Array(data: ArrayBuffer | Uint8Array): Uint8Array {
  return new Uint8Array(data as ArrayBuffer)
}

async function pickSavePath(
  defaultFileName: string,
  extension: string,
  filterName: string
): Promise<string | null> {
  return await save({
    defaultPath: defaultFileName,
    filters: [{ name: filterName, extensions: [extension] }],
  })
}

export async function exportToExcel<T>(
  baseFileName: string,
  sheetTitle: string,
  columns: ExportColumn<T>[],
  rows: T[]
): Promise<void> {
  const path = await pickSavePath(`${baseFileName}.xlsx`, "xlsx", "Excel Workbook")
  if (!path) return

  try {
    const workbook = new Workbook()
    const sheet = workbook.addWorksheet(sheetTitle)
    sheet.columns = columns.map((column) => ({ header: column.header, width: 22 }))
    sheet.getRow(1).font = { bold: true }
    for (const row of rows) {
      sheet.addRow(columns.map((column) => column.accessor(row) ?? ""))
    }
    if (hasTotals(columns)) {
      const totalsRow = sheet.addRow(buildTotalsRow(columns, rows))
      totalsRow.font = { bold: true }
      totalsRow.border = { top: { style: "thin" } }
    }
    const buffer = await workbook.xlsx.writeBuffer()
    await writeFile(path, toUint8Array(buffer))
    toast.success(`Exported ${rows.length} rows to ${path}`)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "Excel export failed")
  }
}

export async function exportToPdf<T>(
  baseFileName: string,
  title: string,
  columns: ExportColumn<T>[],
  rows: T[]
): Promise<void> {
  const path = await pickSavePath(`${baseFileName}.pdf`, "pdf", "PDF Document")
  if (!path) return

  try {
    const doc = new jsPDF({ orientation: columns.length > 5 ? "landscape" : "portrait" })
    doc.setFontSize(14)
    doc.text(title, 14, 15)
    doc.setFontSize(9)
    doc.setTextColor(120)
    doc.text(new Date().toLocaleString(), 14, 21)

    // Totals go in the table's last row (not as free text underneath) so
    // the figures stay aligned under their columns.
    const body: (string | number)[][] = rows.map((row) =>
      columns.map((column) => column.accessor(row) ?? "")
    )
    const showTotals = hasTotals(columns)
    if (showTotals) body.push(buildTotalsRow(columns, rows))

    autoTable(doc, {
      startY: 26,
      head: [columns.map((column) => column.header)],
      body,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [51, 65, 85] },
      didParseCell: (data) => {
        if (
          showTotals &&
          data.section === "body" &&
          data.row.index === body.length - 1
        ) {
          data.cell.styles.fontStyle = "bold"
          data.cell.styles.fillColor = [240, 239, 237]
        }
      },
    })
    const buffer = doc.output("arraybuffer")
    await writeFile(path, toUint8Array(buffer))
    toast.success(`Exported ${rows.length} rows to ${path}`)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "PDF export failed")
  }
}

export async function exportToCsv<T>(
  baseFileName: string,
  columns: ExportColumn<T>[],
  rows: T[]
): Promise<void> {
  const path = await pickSavePath(`${baseFileName}.csv`, "csv", "CSV File")
  if (!path) return

  try {
    const csv = unparse({
      fields: columns.map((column) => column.header),
      data: rows.map((row) => columns.map((column) => column.accessor(row) ?? "")),
    })
    await writeTextFile(path, csv)
    toast.success(`Exported ${rows.length} rows to ${path}`)
  } catch (error) {
    toast.error(error instanceof Error ? error.message : "CSV export failed")
  }
}
