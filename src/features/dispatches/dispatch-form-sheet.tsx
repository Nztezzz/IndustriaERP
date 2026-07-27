import { useEffect } from "react"
import { useFieldArray, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Plus, Trash2, X } from "lucide-react"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
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
import { useCustomers } from "@/lib/api/hooks/use-customers"
import { useProducts } from "@/lib/api/hooks/use-products"
import { useCreateDispatch } from "@/lib/api/hooks/use-dispatches"
import { toRequestDateTime } from "@/lib/api/datetime"
import { optionalNumberField } from "@/lib/zod-helpers"
import { CalendarIcon } from "lucide-react"

// z.coerce.number() for quantity/weightKg needs the input/output generic
// split -- see product-form-dialog.tsx (task 16) for the full explanation.
// weightKg specifically uses optionalNumberField (not a bare
// z.coerce.number().optional()) so blanking the field round-trips as "not
// provided" rather than silently becoming 0 -- see lib/zod-helpers.ts.
const itemSchema = z.object({
  productId: z.string().min(1, "Select a product"),
  quantity: z.coerce.number().positive("Quantity must be greater than zero"),
  weightKg: optionalNumberField(),
})

const dispatchSchema = z
  .object({
    invoiceNumber: z.string().min(1, "Invoice number is required"),
    customerId: z.string().min(1, "Select a customer"),
    dispatchDate: z.date(),
    vehicleNumber: z.string().optional(),
    driverName: z.string().optional(),
    driverPhone: z.string().optional(),
    remarks: z.string().optional(),
    items: z.array(itemSchema),
    reelNumbers: z.array(z.object({ value: z.string().min(1, "Reel number required") })),
  })
  // Mirrors dispatch_service::create's own validation ("a dispatch must
  // include at least one product line item or reel") so the error shows
  // up in the form before a round trip to the backend.
  .refine((data) => data.items.length > 0 || data.reelNumbers.length > 0, {
    message: "Add at least one product line item or reel",
    path: ["items"],
  })

type DispatchFormInput = z.input<typeof dispatchSchema>
type DispatchFormValues = z.output<typeof dispatchSchema>

function emptyValues(): DispatchFormInput {
  return {
    invoiceNumber: "",
    customerId: "",
    dispatchDate: new Date(),
    vehicleNumber: "",
    driverName: "",
    driverPhone: "",
    remarks: "",
    items: [],
    reelNumbers: [],
  }
}

export function DispatchFormSheet({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: customers } = useCustomers()
  const { data: products } = useProducts()
  const createDispatch = useCreateDispatch()

  const form = useForm<DispatchFormInput, unknown, DispatchFormValues>({
    resolver: zodResolver(dispatchSchema),
    defaultValues: emptyValues(),
  })

  const itemFields = useFieldArray({ control: form.control, name: "items" })
  const reelFields = useFieldArray({ control: form.control, name: "reelNumbers" })

  useEffect(() => {
    if (open) {
      form.reset(emptyValues())
    }
  }, [open, form])

  async function onSubmit(values: DispatchFormValues) {
    await createDispatch.mutateAsync(
      {
        invoiceNumber: values.invoiceNumber,
        customerId: values.customerId,
        dispatchDate: toRequestDateTime(values.dispatchDate),
        vehicleNumber: values.vehicleNumber?.trim() ? values.vehicleNumber : null,
        driverName: values.driverName?.trim() ? values.driverName : null,
        driverPhone: values.driverPhone?.trim() ? values.driverPhone : null,
        remarks: values.remarks?.trim() ? values.remarks : null,
        items: values.items.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          weightKg: item.weightKg ?? null,
        })),
        reelNumbers: values.reelNumbers.map((r) => r.value),
      },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>New dispatch</SheetTitle>
          <SheetDescription>
            Records outward stock for each line item and marks any attached
            reels as dispatched, all in one transaction.
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="invoiceNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Invoice number</FormLabel>
                    <FormControl>
                      <Input placeholder="INV-1001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers?.map((customer) => (
                          <SelectItem key={customer.id} value={customer.id}>
                            {customer.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="dispatchDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dispatch date</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full justify-start font-normal"
                        >
                          <CalendarIcon />
                          {field.value.toLocaleString()}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={(date) => date && field.onChange(date)}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="vehicleNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle number</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="driverName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Driver name</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="driverPhone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Driver phone</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>Line items</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    itemFields.append({ productId: "", quantity: 0, weightKg: undefined })
                  }
                >
                  <Plus />
                  Add item
                </Button>
              </div>
              {itemFields.fields.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No line items added. Add a product, or attach reels below.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {itemFields.fields.map((field, index) => (
                    <div
                      key={field.id}
                      className="grid grid-cols-[1fr_5rem_5rem_auto] items-start gap-2"
                    >
                      <Select
                        value={form.watch(`items.${index}.productId`)}
                        onValueChange={(value) =>
                          form.setValue(`items.${index}.productId`, value)
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Product" />
                        </SelectTrigger>
                        <SelectContent>
                          {products?.map((product) => (
                            <SelectItem key={product.id} value={product.id}>
                              {product.name} ({product.sku})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="Qty"
                        {...form.register(`items.${index}.quantity`)}
                      />
                      <Input
                        type="number"
                        step="any"
                        min="0"
                        placeholder="Weight kg"
                        {...form.register(`items.${index}.weightKg`)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => itemFields.remove(index)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>Reel numbers</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => reelFields.append({ value: "" })}
                >
                  <Plus />
                  Add reel
                </Button>
              </div>
              {reelFields.fields.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No reels attached. Each reel must currently be in stock --
                  invalid reel numbers will reject the whole dispatch.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {reelFields.fields.map((field, index) => (
                    <div key={field.id} className="flex items-center gap-2">
                      <Input
                        placeholder="Reel number"
                        {...form.register(`reelNumbers.${index}.value`)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => reelFields.remove(index)}
                      >
                        <X />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {form.formState.errors.items?.root?.message && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.items.root.message}
                </p>
              )}
            </div>

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

            <SheetFooter className="px-0">
              <Button type="submit" disabled={createDispatch.isPending}>
                {createDispatch.isPending && <Loader2 className="animate-spin" />}
                Create dispatch
              </Button>
            </SheetFooter>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}
