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
import { useRegisterReel } from "@/lib/api/hooks/use-reels"
import { optionalNumberField } from "@/lib/zod-helpers"

// weightKg is coerced -- see product-form-dialog.tsx (task 16) for why
// this needs the z.input/z.output useForm generic split. Uses
// optionalNumberField rather than a bare z.coerce.number().optional() so a
// blanked-out input round-trips as "not provided" instead of silently
// becoming 0 -- see lib/zod-helpers.ts for the full explanation.
const registerReelSchema = z.object({
  reelNumber: z.string().min(1, "Reel number is required"),
  productId: z.string().min(1, "Select a product"),
  weightKg: optionalNumberField(),
})

type RegisterReelInput = z.input<typeof registerReelSchema>
type RegisterReelValues = z.output<typeof registerReelSchema>

const emptyValues: RegisterReelInput = {
  reelNumber: "",
  productId: "",
  weightKg: undefined,
}

export function RegisterReelDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { data: products } = useProducts()
  const registerReel = useRegisterReel()

  const form = useForm<RegisterReelInput, unknown, RegisterReelValues>({
    resolver: zodResolver(registerReelSchema),
    defaultValues: emptyValues,
  })

  useEffect(() => {
    if (open) {
      form.reset(emptyValues)
    }
  }, [open, form])

  async function onSubmit(values: RegisterReelValues) {
    await registerReel.mutateAsync(
      {
        reelNumber: values.reelNumber,
        productId: values.productId,
        weightKg: values.weightKg ?? null,
      },
      { onSuccess: () => onOpenChange(false) }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Register reel</DialogTitle>
          <DialogDescription>
            Adds a new physical reel to inventory with status &quot;in
            stock&quot;.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={form.control}
              name="reelNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reel number</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. 4521" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
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
              name="weightKg"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Weight (kg)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="Optional"
                      {...field}
                      // Falls back to "" rather than leaving this
                      // undefined -- the field is optional (undefined is
                      // a valid value once coerced), but an <input> must
                      // stay consistently controlled across renders or
                      // React warns about the uncontrolled->controlled
                      // switch the moment the user types a first digit.
                      value={(field.value as number | string | undefined) ?? ""}
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
              <Button type="submit" disabled={registerReel.isPending}>
                {registerReel.isPending && <Loader2 className="animate-spin" />}
                Register reel
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
