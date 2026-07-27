import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowUpFromLine, Loader2 } from "lucide-react"
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
import { useStockBalances, useRecordOutward } from "@/lib/api/hooks/use-stock"

const outwardSchema = z.object({
  productId: z.string().min(1, "Select a product"),
  quantity: z.coerce.number().positive("Quantity must be greater than zero"),
  referenceNumber: z.string().optional(),
  remarks: z.string().optional(),
})

type OutwardInput = z.input<typeof outwardSchema>
type OutwardValues = z.output<typeof outwardSchema>

const emptyValues: OutwardInput = {
  productId: "",
  quantity: 0,
  referenceNumber: "",
  remarks: "",
}

function OutwardEntryForm() {
  const { data: products } = useProducts()
  const { data: balances } = useStockBalances()
  const recordOutward = useRecordOutward()

  const form = useForm<OutwardInput, unknown, OutwardValues>({
    resolver: zodResolver(outwardSchema),
    defaultValues: emptyValues,
  })

  const selectedProductId = form.watch("productId")
  const selectedBalance = balances?.find((b) => b.productId === selectedProductId)

  async function onSubmit(values: OutwardValues) {
    await recordOutward.mutateAsync(
      {
        productId: values.productId,
        quantity: values.quantity,
        referenceNumber: values.referenceNumber?.trim()
          ? values.referenceNumber
          : null,
        remarks: values.remarks?.trim() ? values.remarks : null,
      },
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

              <FormField
                control={form.control}
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
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

              <FormField
                control={form.control}
                name="referenceNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reference number</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. requisition / job number"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="remarks"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Remarks</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Optional notes" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={recordOutward.isPending}>
                {recordOutward.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <ArrowUpFromLine />
                )}
                Record outward
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}

export function OutwardEntryPage() {
  return (
    <>
      <PageHeader title="Outward Entry" description="Record outgoing stock." />
      <RequireRole minRole="operator">
        <OutwardEntryForm />
      </RequireRole>
    </>
  )
}
