import { useEffect } from "react"
import { useFieldArray, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { CalendarIcon, Loader2, Package, Plus, Trash2, Truck } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
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

const dispatchSchema = z.object({
  invoiceNumber: z.string().min(1, "Invoice number is required"),
  customerId: z.string().min(1, "Select a customer"),
  dispatchDate: z.date(),
  vehicleNumber: z.string().optional(),
  driverName: z.string().optional(),
  driverPhone: z.string().optional(),
  remarks: z.string().optional(),
  // Reel attachment was removed from this form, so line items are now the
  // only way to satisfy the backend's "must contain at least one line item
  // or reel" rule -- hence required here rather than validated via .refine().
  items: z.array(itemSchema).min(1, "Add at least one product line item"),
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
  }
}

/** Small section heading so the form reads as grouped steps, not one long list. */
function SectionHeading({
  icon: Icon,
  children,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="size-4 text-muted-foreground" />}
        <h3 className="font-heading text-sm font-semibold">{children}</h3>
      </div>
      {action}
    </div>
  )
}

export function DispatchFormDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: customers } = useCustomers()
  // Active-only on purpose: you shouldn't be able to dispatch a product that
  // has been deactivated.
  const { data: products } = useProducts()
  const createDispatch = useCreateDispatch()

  const form = useForm<DispatchFormInput, unknown, DispatchFormValues>({
    resolver: zodResolver(dispatchSchema),
    defaultValues: emptyValues(),
  })

  const itemFields = useFieldArray({ control: form.control, name: "items" })

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
        // reelNumbers deliberately omitted -- it's optional on the API type
        // and reels are no longer attached from this form.
      },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/*
       * Centered dialog rather than a side sheet: this form has ~9 fields plus
       * two repeatable lists, and the narrow drawer forced everything into a
       * single cramped column. `flex flex-col` + a scrolling middle section
       * keeps the header and the submit button always visible.
       */}
      <DialogContent className="flex max-h-[90vh] flex-col gap-0 p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border px-6 py-4 text-left">
          <DialogTitle>New dispatch</DialogTitle>
          <DialogDescription>
            Records outward stock for each line item, all in one transaction.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex min-h-0 flex-1 flex-col"
          >
            <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-6 py-5">
              {/* ---------- Dispatch details ---------- */}
              <div className="flex flex-col gap-4">
                <SectionHeading icon={Truck}>Dispatch details</SectionHeading>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="invoiceNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Invoice number</FormLabel>
                        <FormControl>
                          <Input placeholder="INV-1001" autoFocus {...field} />
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
                                {field.value.toLocaleDateString()}
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
                </div>
              </div>

              <Separator />

              {/* ---------- Transport (all optional) ---------- */}
              <div className="flex flex-col gap-4">
                <SectionHeading>
                  Transport{" "}
                  <span className="font-normal text-muted-foreground">
                    (optional)
                  </span>
                </SectionHeading>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <FormField
                    control={form.control}
                    name="vehicleNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vehicle number</FormLabel>
                        <FormControl>
                          <Input placeholder="GJ07TU4875" {...field} />
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
                          <Input placeholder="Driver name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="driverPhone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Driver phone</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Phone number"
                            type="tel"
                            inputMode="numeric"
                            {...field}
                            onChange={(e) => {
                              const digits = e.target.value.replace(/\D/g, "")
                              field.onChange(digits)
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Separator />

              {/* ---------- Line items ---------- */}
              <div className="flex flex-col gap-3">
                <SectionHeading
                  icon={Package}
                  action={
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        itemFields.append({
                          productId: "",
                          quantity: 0,
                          weightKg: undefined,
                        })
                      }
                    >
                      <Plus />
                      Add item
                    </Button>
                  }
                >
                  Line items
                </SectionHeading>

                {itemFields.fields.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
                    No line items yet. Add at least one product to dispatch.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {/* Column labels -- there's room for them now. */}
                    <div className="grid grid-cols-[1fr_7rem_7rem_2.25rem] gap-2 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      <span>Product</span>
                      <span>Quantity</span>
                      <span>Weight (kg)</span>
                      <span />
                    </div>
                    {itemFields.fields.map((field, index) => (
                      <div
                        key={field.id}
                        className="grid grid-cols-[1fr_7rem_7rem_2.25rem] items-start gap-2"
                      >
                        <Select
                          value={form.watch(`items.${index}.productId`)}
                          onValueChange={(value) =>
                            form.setValue(`items.${index}.productId`, value)
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Select product" />
                          </SelectTrigger>
                          <SelectContent>
                            {products?.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="0"
                          {...form.register(`items.${index}.quantity`)}
                        />
                        <Input
                          type="number"
                          step="any"
                          min="0"
                          placeholder="Optional"
                          {...form.register(`items.${index}.weightKg`)}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="text-destructive"
                          onClick={() => itemFields.remove(index)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {/* Array-level "at least one line item" error. */}
                {form.formState.errors.items?.message && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.items.message}
                  </p>
                )}
              </div>

              <Separator />

              {/* ---------- Remarks ---------- */}
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
            </div>

            {/* Footer stays pinned so the primary action is always reachable. */}
            <DialogFooter className="border-t border-border px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createDispatch.isPending}>
                {createDispatch.isPending && <Loader2 className="animate-spin" />}
                Create dispatch
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
