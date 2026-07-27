import { Construction } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

/**
 * Temporary placeholder for module pages that have routing wired up but
 * whose real content lands in a later implementation pass. Keeps the app
 * fully navigable while modules are built out one at a time.
 */
export function ModulePlaceholder({ note }: { note?: string }) {
  return (
    <div className="p-6">
      <Card>
        <CardContent className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
          <Construction className="size-8" />
          <p className="text-sm">
            {note ?? "This module's UI is coming soon."}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
