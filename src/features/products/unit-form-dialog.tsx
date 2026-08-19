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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { useCreateUnit, useUpdateUnit } from "@/lib/api/hooks/use-units"
import type { UnitDto } from "@/lib/api/types"

const unitSchema = z.object({
  name: z.string().min(1, "Name is required"),
  symbol: z.string().min(1, "Symbol is required"),
  conversionFactor: z.coerce
    .number()
    .positive("Conversion factor must be greater than 0"),
})

// react-hook-form's resolver typing needs the *pre-coercion* input shape
// and the *post-coercion* output shape as separate generics whenever a
// schema uses `z.coerce`, since the input type for a coerced field is
// `unknown` (anything is accepted and coerced) while the output is the
// coerced type (`number`). A single generic (`z.infer<typeof schema>`)
// only describes the output shape, which is what `useForm` needs for
// `defaultValues`/reading values, but doesn't match what `zodResolver`
// reports as its input type -- hence the explicit input/output split here.
type UnitFormInput = z.input<typeof unitSchema>
type UnitFormValues = z.output<typeof unitSchema>

/**
 * Shared create/edit form for units. `unit` being present switches the
 * dialog into edit mode -- same fields, different mutation + copy.
 */
export function UnitFormDialog({
  open,
  onOpenChange,
  unit,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  unit?: UnitDto | null
}) {
  const isEditing = !!unit
  const createUnit = useCreateUnit()
  const updateUnit = useUpdateUnit()
  const isSubmitting = createUnit.isPending || updateUnit.isPending

  const form = useForm<UnitFormInput, unknown, UnitFormValues>({
    resolver: zodResolver(unitSchema),
    defaultValues: { name: "", symbol: "", conversionFactor: 1 },
  })

  // Re-seed the form whenever the dialog opens for a (possibly different)
  // unit, rather than keeping whatever was left over from the last time it
  // was open -- this dialog instance is reused across every row's "edit".
  useEffect(() => {
    if (open) {
      form.reset(
        unit
          ? {
              name: unit.name,
              symbol: unit.symbol,
              conversionFactor: unit.conversionFactor,
            }
          : { name: "", symbol: "", conversionFactor: 1 }
      )
    }
  }, [open, unit, form])

  async function onSubmit(values: UnitFormValues) {
    if (isEditing) {
      await updateUnit.mutateAsync(
        { id: unit.id, input: values },
        { onSuccess: () => onOpenChange(false) }
      )
    } else {
      await createUnit.mutateAsync(values, {
        onSuccess: () => onOpenChange(false),
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit unit" : "New unit"}</DialogTitle>
          <DialogDescription>
            Units define how stock quantities are measured (e.g. Kilogram,
            Reel, Box).
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="symbol"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Symbol</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="conversionFactor"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Conversion factor</FormLabel>
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
                {isEditing ? "Save changes" : "Create unit"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
