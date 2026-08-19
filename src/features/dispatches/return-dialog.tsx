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

  function hasValidItems() {
    if (!returnableItems) return false
    return returnableItems.some((item) => {
      const qty = quantities[item.productId] ?? 0
      return qty > 0 && qty <= item.returnableQty
    })
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
          setQuantities({})
          setRemarks("")
          onOpenChange(false)
        },
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            <Undo2 className="mr-2 inline size-5" />
            Product Return
          </DialogTitle>
          <DialogDescription>
            Return products from dispatch {invoiceNumber}. Enter the quantity to
            return for each product.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : !returnableItems || returnableItems.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No returnable items for this dispatch.
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
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
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
      </DialogContent>
    </Dialog>
  )
}
