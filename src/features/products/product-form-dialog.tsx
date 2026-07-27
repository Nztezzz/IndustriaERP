import { useEffect } from "react"
import { useFieldArray, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Plus, X } from "lucide-react"
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
import { Label } from "@/components/ui/label"
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
import { useUnits } from "@/lib/api/hooks/use-units"
import { useCreateProduct, useUpdateProduct } from "@/lib/api/hooks/use-products"
import type { ProductDto } from "@/lib/api/types"

const productSchema = z.object({
  sku: z.string().min(1, "SKU is required"),
  name: z.string().min(1, "Product name is required"),
  description: z.string().optional(),
  baseUnitId: z.string().min(1, "Base unit is required"),
  reorderLevel: z.coerce.number().min(0, "Reorder level cannot be negative"),
  isActive: z.boolean(),
  specifications: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
    })
  ),
})

// See the comment in unit-form-dialog.tsx: `z.coerce.number()` needs
// useForm's input/output generics split, since the resolver's declared
// input type for a coerced field is `unknown` while the output is `number`.
type ProductFormInput = z.input<typeof productSchema>
type ProductFormValues = z.output<typeof productSchema>

function specsToEntries(
  specs: Record<string, string> | null | undefined
): { key: string; value: string }[] {
  if (!specs) return []
  return Object.entries(specs).map(([key, value]) => ({ key, value }))
}

function entriesToSpecs(
  entries: { key: string; value: string }[]
): Record<string, string> | null {
  const filled = entries.filter((e) => e.key.trim().length > 0)
  if (filled.length === 0) return null
  return Object.fromEntries(filled.map((e) => [e.key.trim(), e.value]))
}

/**
 * Shared create/edit form for products. Specifications are modelled as a
 * free-form key/value list rather than a fixed schema -- spec sheets vary
 * a lot by product category (GSM/width for paper reels vs. dimensions for
 * something else), and the backend already stores them as opaque JSON.
 */
export function ProductFormDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  product?: ProductDto | null
}) {
  const isEditing = !!product
  const { data: units } = useUnits()
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()
  const isSubmitting = createProduct.isPending || updateProduct.isPending

  const form = useForm<ProductFormInput, unknown, ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      sku: "",
      name: "",
      description: "",
      baseUnitId: "",
      reorderLevel: 0,
      isActive: true,
      specifications: [],
    },
  })

  const specFields = useFieldArray({ control: form.control, name: "specifications" })

  useEffect(() => {
    if (open) {
      form.reset(
        product
          ? {
              sku: product.sku,
              name: product.name,
              description: product.description ?? "",
              baseUnitId: product.baseUnitId,
              reorderLevel: product.reorderLevel,
              isActive: product.isActive,
              specifications: specsToEntries(product.specifications),
            }
          : {
              sku: "",
              name: "",
              description: "",
              baseUnitId: "",
              reorderLevel: 0,
              isActive: true,
              specifications: [],
            }
      )
    }
  }, [open, product, form])

  async function onSubmit(values: ProductFormValues) {
    const input = {
      sku: values.sku,
      name: values.name,
      description: values.description?.trim() ? values.description : null,
      baseUnitId: values.baseUnitId,
      reorderLevel: values.reorderLevel,
      isActive: values.isActive,
      specifications: entriesToSpecs(values.specifications),
    }

    if (isEditing) {
      await updateProduct.mutateAsync(
        { id: product.id, input },
        { onSuccess: () => onOpenChange(false) }
      )
    } else {
      await createProduct.mutateAsync(input, {
        onSuccess: () => onOpenChange(false),
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit product" : "New product"}</DialogTitle>
          <DialogDescription>
            Products are the items tracked in inventory, dispatches, and
            reels.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1"
          >
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="sku"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SKU</FormLabel>
                    <FormControl>
                      <Input placeholder="PPR-001" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="baseUnitId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Base unit</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a unit" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {units?.map((unit) => (
                          <SelectItem key={unit.id} value={unit.id}>
                            {unit.name} ({unit.symbol})
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
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Kraft Paper Reel 80GSM" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional notes about this product"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="reorderLevel"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reorder level</FormLabel>
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

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label>Specifications</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => specFields.append({ key: "", value: "" })}
                >
                  <Plus />
                  Add spec
                </Button>
              </div>
              {specFields.fields.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No specifications added yet.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {specFields.fields.map((field, index) => (
                    <div key={field.id} className="flex items-center gap-2">
                      <Input
                        placeholder="GSM"
                        {...form.register(`specifications.${index}.key`)}
                      />
                      <Input
                        placeholder="80"
                        {...form.register(`specifications.${index}.value`)}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => specFields.remove(index)}
                      >
                        <X />
                      </Button>
                    </div>
                  ))}
                </div>
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
                {isEditing ? "Save changes" : "Create product"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
