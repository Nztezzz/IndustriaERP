import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, SlidersHorizontal } from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { RequireRole } from "@/components/layout/require-role"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { useProducts } from "@/lib/api/hooks/use-products"
import { useStockBalances, useRecordAdjustment } from "@/lib/api/hooks/use-stock"

// Direction + magnitude, rather than asking for a signed number directly --
// a stock clerk reasoning about "the physical count was 5 more/less than
// the system" shouldn't have to remember whether that's +5 or -5. The
// signed `delta` the backend actually wants is derived at submit time.
const adjustmentSchema = z.object({
  productId: z.string().min(1, "Select a product"),
  direction: z.enum(["increase", "decrease"]),
  magnitude: z.coerce.number().positive("Amount must be greater than zero"),
  // Backend requires non-empty remarks for every adjustment (it's the
  // audit trail, not optional bookkeeping) -- min(1) mirrors that here so
  // the error surfaces before a round trip instead of after.
  remarks: z.string().min(1, "A reason is required for stock adjustments"),
})

type AdjustmentInput = z.input<typeof adjustmentSchema>
type AdjustmentValues = z.output<typeof adjustmentSchema>

const emptyValues: AdjustmentInput = {
  productId: "",
  direction: "increase",
  magnitude: 0,
  remarks: "",
}

function StockAdjustmentForm() {
  const { data: products } = useProducts()
  const { data: balances } = useStockBalances()
  const recordAdjustment = useRecordAdjustment()

  const form = useForm<AdjustmentInput, unknown, AdjustmentValues>({
    resolver: zodResolver(adjustmentSchema),
    defaultValues: emptyValues,
  })

  const selectedProductId = form.watch("productId")
  const selectedBalance = balances?.find((b) => b.productId === selectedProductId)

  async function onSubmit(values: AdjustmentValues) {
    const delta =
      values.direction === "increase" ? values.magnitude : -values.magnitude
    await recordAdjustment.mutateAsync(
      { productId: values.productId, delta, remarks: values.remarks },
      { onSuccess: () => form.reset(emptyValues) }
    )
  }

  return (
    <div className="p-6">
      <Card className="mx-auto max-w-lg">
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-4"
            >
              <FormField
                control={form.control}
                name="productId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Product</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a product" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {products?.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} ({product.sku})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedBalance && (
                      <p className="text-sm text-muted-foreground">
                        {selectedBalance.quantityOnHand} {selectedBalance.unitSymbol}{" "}
                        currently on hand
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="direction"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Direction</FormLabel>
                      <Select value={field.value} onValueChange={field.onChange}>
                        <FormControl>
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="increase">Increase (+)</SelectItem>
                          <SelectItem value="decrease">Decrease (-)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="magnitude"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Amount</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          {...field}
                          value={field.value as number | string}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={recordAdjustment.isPending}>
                {recordAdjustment.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <SlidersHorizontal />
                )}
                Record adjustment
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}

export function StockAdjustmentsPage() {
  return (
    <>
      <PageHeader
        title="Manual Adjustments"
        description="Correct stock levels with a full audit trail."
      />
      <RequireRole minRole="operator">
        <StockAdjustmentForm />
      </RequireRole>
    </>
  )
}
