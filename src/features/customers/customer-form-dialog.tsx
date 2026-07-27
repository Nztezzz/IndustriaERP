import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2 } from "lucide-react"
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
import { Switch } from "@/components/ui/switch"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { useCreateCustomer, useUpdateCustomer } from "@/lib/api/hooks/use-customers"
import type { CustomerDto } from "@/lib/api/types"

// No z.coerce fields here (no numeric inputs), so a single generic is
// fine -- see unit-form-dialog.tsx / product-form-dialog.tsx for why that
// wouldn't be true if a coerced number field were added later.
const customerSchema = z.object({
  name: z.string().min(1, "Customer name is required"),
  contactPerson: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Enter a valid email").optional().or(z.literal("")),
  address: z.string().optional(),
  gstNumber: z.string().optional(),
  isActive: z.boolean(),
})

type CustomerFormValues = z.infer<typeof customerSchema>

const emptyValues: CustomerFormValues = {
  name: "",
  contactPerson: "",
  phone: "",
  email: "",
  address: "",
  gstNumber: "",
  isActive: true,
}

/** Shared create/edit form for customers. */
export function CustomerFormDialog({
  open,
  onOpenChange,
  customer,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  customer?: CustomerDto | null
}) {
  const isEditing = !!customer
  const createCustomer = useCreateCustomer()
  const updateCustomer = useUpdateCustomer()
  const isSubmitting = createCustomer.isPending || updateCustomer.isPending

  const form = useForm<CustomerFormValues>({
    resolver: zodResolver(customerSchema),
    defaultValues: emptyValues,
  })

  useEffect(() => {
    if (open) {
      form.reset(
        customer
          ? {
              name: customer.name,
              contactPerson: customer.contactPerson ?? "",
              phone: customer.phone ?? "",
              email: customer.email ?? "",
              address: customer.address ?? "",
              gstNumber: customer.gstNumber ?? "",
              isActive: customer.isActive,
            }
          : emptyValues
      )
    }
  }, [open, customer, form])

  async function onSubmit(values: CustomerFormValues) {
    const input = {
      name: values.name,
      contactPerson: values.contactPerson?.trim() ? values.contactPerson : null,
      phone: values.phone?.trim() ? values.phone : null,
      email: values.email?.trim() ? values.email : null,
      address: values.address?.trim() ? values.address : null,
      gstNumber: values.gstNumber?.trim() ? values.gstNumber : null,
      isActive: values.isActive,
    }

    if (isEditing) {
      await updateCustomer.mutateAsync(
        { id: customer.id, input },
        { onSuccess: () => onOpenChange(false) }
      )
    } else {
      await createCustomer.mutateAsync(input, {
        onSuccess: () => onOpenChange(false),
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit customer" : "New customer"}</DialogTitle>
          <DialogDescription>
            Customers receive dispatches and are tracked for outstanding
            reels.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Acme Packaging Co." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contactPerson"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact person</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
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
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Optional" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="gstNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>GST number</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {isEditing && (
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Active</FormLabel>
                      <FormControl>
                        <div className="flex h-8 items-center">
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </div>
                      </FormControl>
                    </FormItem>
                  )}
                />
              )}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="animate-spin" />}
                {isEditing ? "Save changes" : "Create customer"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
