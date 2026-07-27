import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { ArrowDownToLine, Loader2 } from "lucide-react"
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
import { useRecordInward } from "@/lib/api/hooks/use-stock"

// z.coerce.number() splits useForm's input/output generics -- see
// product-form-dialog.tsx for the full explanation. Applied proactively
// here rather than rediscovered.
const inwardSchema = z.object({
  productId: z.string().min(1, "Select a product"),
  quantity: z.coerce.number().positive("Quantity must be greater than zero"),
  referenceNumber: z.string().optional(),
  remarks: z.string().optional(),
})

type InwardInput = z.input<typeof inwardSchema>
type InwardValues = z.output<typeof inwardSchema>

const emptyValues: InwardInput = {
  productId: "",
  quantity: 0,
  referenceNumber: "",
  remarks: "",
}

function InwardEntryForm() {
  const { data: products } = useProducts()
  const recordInward = useRecordInward()

  const form = useForm<InwardInput, unknown, InwardValues>({
    resolver: zodResolver(inwardSchema),
    defaultValues: emptyValues,
  })

  async function onSubmit(values: InwardValues) {
    await recordInward.mutateAsync(
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
                        placeholder="e.g. supplier invoice / PO number"
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

              <Button type="submit" disabled={recordInward.isPending}>
                {recordInward.isPending ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <ArrowDownToLine />
                )}
                Record inward
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}

export function InwardEntryPage() {
  return (
    <>
      <PageHeader title="Inward Entry" description="Record incoming stock." />
      <RequireRole minRole="operator">
        <InwardEntryForm />
      </RequireRole>
    </>
  )
}
