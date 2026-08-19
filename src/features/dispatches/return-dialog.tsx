import { useState } from "react"
import { Loader2, Undo2 } from "lucide-react"
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
}

/**
 * Records a customer return against a dispatch.
 *
 * Each row shows what was dispatched, what has already come back, and what
 * is therefore still returnable -- the quantity input is capped at that
 * remaining figure so the balance can never be driven below zero. The
 * backend re-validates the same rule, since a `max` attribute is only a
 * hint.
 *
 * There's deliberately no print/receipt step here: the return is recorded
 * and the dialog closes. Returns show up with their date in Stock History
 * and in the Reports tabs, which is where printing belongs.
 */
export function ReturnDialog({
  open,
  onOpenChange,
  dispatchId,
  invoiceNumber,
}: ReturnDialogProps) {
  const { data: returnableItems, isLoading } = useReturnableItems(
    open ? dispatchId : undefined
  )
  const { data: products } = useProducts(true)
  const createReturn = useCreateReturn()

  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [remarks, setRemarks] = useState("")

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

  /** Rows the operator has actually entered a valid quantity for. */
  function enteredItems() {
    return (returnableItems ?? [])
      .map((item) => ({ item, qty: quantities[item.productId] ?? 0 }))
      .filter(({ item, qty }) => qty > 0 && qty <= item.returnableQty)
      .map(({ item, qty }) => ({ productId: item.productId, quantity: qty }))
  }

  /** True when some entry exceeds what's left to return. */
  const hasOverLimit = (returnableItems ?? []).some(
    (item) => (quantities[item.productId] ?? 0) > item.returnableQty
  )

  function handleClose() {
    setQuantities({})
    setRemarks("")
    onOpenChange(false)
  }

  async function handleSubmit() {
    const items = enteredItems()
    if (items.length === 0) return

    await createReturn.mutateAsync(
      {
        dispatchId,
        items,
        remarks: remarks.trim() || null,
      },
      { onSuccess: handleClose }
    )
  }

  const nothingLeft =
    !isLoading &&
    (returnableItems ?? []).length > 0 &&
    (returnableItems ?? []).every((i) => i.returnableQty <= 0)

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            <Undo2 className="mr-2 inline size-5" />
            Product Return
          </DialogTitle>
          <DialogDescription>
            Return products from dispatch {invoiceNumber}.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : !returnableItems || returnableItems.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            This dispatch has no product line items to return.
          </p>
        ) : nothingLeft ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Everything from this dispatch has already been returned.
          </p>
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
                  {returnableItems.map((item) => {
                    const entered = quantities[item.productId] ?? 0
                    const overLimit = entered > item.returnableQty
                    return (
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
                        <TableCell className="text-center font-medium tabular-nums">
                          {item.returnableQty}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={item.returnableQty}
                            step="any"
                            aria-invalid={overLimit}
                            aria-label={`Return quantity for ${getProductName(item.productId)}`}
                            className={`h-8 w-24 text-center ${
                              overLimit ? "border-destructive" : ""
                            }`}
                            value={quantities[item.productId] ?? ""}
                            onChange={(e) =>
                              handleQuantityChange(item.productId, e.target.value)
                            }
                            disabled={item.returnableQty <= 0}
                          />
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>

            {hasOverLimit && (
              <p className="text-sm text-destructive">
                A return quantity is higher than the available balance.
              </p>
            )}

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="return-remarks">Remarks</Label>
              <Textarea
                id="return-remarks"
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={
              enteredItems().length === 0 ||
              hasOverLimit ||
              createReturn.isPending
            }
          >
            {createReturn.isPending ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Undo2 />
            )}
            Record Return
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
