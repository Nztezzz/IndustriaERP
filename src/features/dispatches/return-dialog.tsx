import { useState } from "react"
import { jsPDF } from "jspdf"
import { autoTable } from "jspdf-autotable"
import { addLogoToPdf } from "@/lib/logo-data"
import { Loader2, Printer, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useReturnableItems, useCreateReturn } from "@/lib/api/hooks/use-returns"
import { useProducts } from "@/lib/api/hooks/use-products"

interface ReturnDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  dispatchId: string
  invoiceNumber: string
  customerName?: string
}

export function ReturnDialog({
  open,
  onOpenChange,
  dispatchId,
  invoiceNumber,
  customerName,
}: ReturnDialogProps) {
  const { data: returnableItems, isLoading } = useReturnableItems(
    open ? dispatchId : undefined
  )
  const { data: products } = useProducts(true)
  const createReturn = useCreateReturn()

  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [remarks, setRemarks] = useState("")
  // After successful return, store what was returned for printing
  const [returnedItems, setReturnedItems] = useState<
    { name: string; quantity: number }[] | null
  >(null)

  function getProductName(productId: string) {
    return products?.find((p) => p.id === productId)?.name ?? productId
  }

  function handleQuantityChange(productId: string, value: string) {
    const num = parseFloat(value)
    setQuantities((prev) => ({
      ...prev,
      [productId]: isNaN(num) ? 0 : num,
    }))
  }

  function hasValidItems() {
    if (!returnableItems) return false
    return returnableItems.some((item) => {
      const qty = quantities[item.productId] ?? 0
      return qty > 0 && qty <= item.returnableQty
    })
  }

  function handleClose() {
    setQuantities({})
    setRemarks("")
    setReturnedItems(null)
    onOpenChange(false)
  }

  async function handleSubmit() {
    if (!returnableItems) return

    const items = returnableItems
      .filter((item) => {
        const qty = quantities[item.productId] ?? 0
        return qty > 0
      })
      .map((item) => ({
        productId: item.productId,
        quantity: quantities[item.productId],
      }))

    if (items.length === 0) return

    await createReturn.mutateAsync(
      {
        dispatchId,
        items,
        remarks: remarks.trim() || null,
      },
      {
        onSuccess: () => {
          // Store what was returned for print
          setReturnedItems(
            items.map((i) => ({
              name: getProductName(i.productId),
              quantity: i.quantity,
            }))
          )
        },
      }
    )
  }

  async function handlePrint() {
    if (!returnedItems || returnedItems.length === 0) return

    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
    const pageWidth = doc.internal.pageSize.getWidth()

    // Logo
    await addLogoToPdf(doc, 8, 3, 22, 12)
    await addLogoToPdf(doc, pageWidth - 30, 3, 22, 12)

    // Header
    doc.setFontSize(14)
    doc.setFont("helvetica", "bold")
    doc.text("PREYANSH METAL INDUSTRIES LLP", pageWidth / 2, 12, { align: "center" })
    doc.setFontSize(10)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(80)
    doc.text("Product Return Receipt", pageWidth / 2, 18, { align: "center" })

    // Details
    doc.setTextColor(30)
    doc.setFontSize(9)
    let y = 28
    doc.text(`Invoice: ${invoiceNumber}`, 14, y)
    if (customerName) {
      doc.text(`Customer: ${customerName}`, 14, y + 5)
      y += 5
    }
    doc.text(`Date: ${new Date().toLocaleDateString()}`, pageWidth - 60, 28)
    if (remarks.trim()) {
      doc.text(`Remarks: ${remarks.trim()}`, 14, y + 5)
      y += 5
    }

    // Table
    const heads = ["#", "Product", "Qty Returned"]
    const bodyData = returnedItems.map((item, i) => [
      String(i + 1),
      item.name,
      String(item.quantity),
    ])

    autoTable(doc, {
      startY: y + 8,
      head: [heads],
      body: bodyData,
      theme: "grid",
      headStyles: {
        fillColor: [245, 130, 13],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 9,
      },
      bodyStyles: { fontSize: 9 },
      columnStyles: {
        0: { cellWidth: 12, halign: "center" },
        2: { cellWidth: 30, halign: "center" },
      },
    })

    // Print via hidden iframe
    const pdfBlob = doc.output("blob")
    const url = URL.createObjectURL(pdfBlob)
    const iframe = document.createElement("iframe")
    iframe.style.position = "fixed"
    iframe.style.top = "-10000px"
    iframe.style.left = "-10000px"
    iframe.style.width = "0"
    iframe.style.height = "0"
    iframe.style.border = "none"
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
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            <Undo2 className="mr-2 inline size-5" />
            Product Return
          </DialogTitle>
          <DialogDescription>
            {returnedItems
              ? "Return recorded successfully."
              : `Return products from dispatch ${invoiceNumber}.`}
          </DialogDescription>
        </DialogHeader>

        {returnedItems ? (
          /* Success state — show what was returned + Print button */
          <div className="flex flex-col gap-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Product</TableHead>
                  <TableHead className="text-center">Qty Returned</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returnedItems.map((item, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="text-center tabular-nums">
                      {item.quantity}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
              <Button onClick={handlePrint}>
                <Printer />
                Print Receipt
              </Button>
            </DialogFooter>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : !returnableItems || returnableItems.length === 0 ? (
          <div className="flex flex-col gap-4">
            <p className="py-8 text-center text-sm text-muted-foreground">
              All items from this dispatch have been fully returned.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Close
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="max-h-64 overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-center">Dispatched</TableHead>
                    <TableHead className="text-center">Returned</TableHead>
                    <TableHead className="text-center">Available</TableHead>
                    <TableHead className="text-center">Return Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {returnableItems.map((item) => (
                    <TableRow key={item.productId}>
                      <TableCell className="font-medium">
                        {getProductName(item.productId)}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {item.dispatchedQty}
                      </TableCell>
                      <TableCell className="text-center tabular-nums">
                        {item.alreadyReturnedQty}
                      </TableCell>
                      <TableCell className="text-center tabular-nums font-medium">
                        {item.returnableQty}
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min={0}
                          max={item.returnableQty}
                          step="any"
                          className="h-8 w-24 text-center"
                          value={quantities[item.productId] ?? ""}
                          onChange={(e) =>
                            handleQuantityChange(item.productId, e.target.value)
                          }
                          disabled={item.returnableQty <= 0}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label>Remarks</Label>
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!hasValidItems() || createReturn.isPending}
              >
                {createReturn.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Undo2 />
                )}
                Record Return
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
