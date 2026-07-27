import type { ReactNode } from "react"
import { FileBarChart } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

/**
 * Shared loading/empty/table shell for every report tab -- same
 * Card+skeleton-array+empty-state convention already used inline in
 * dispatch-list-page.tsx and reel-list-page.tsx, pulled into one
 * component here since 5 report tabs would otherwise repeat it
 * verbatim (mirrors the ResultSection<T> precedent from task 21's
 * global-search-page.tsx, built for the same "several near-identical
 * sections" reason).
 */
export function ReportTableCard({
  isLoading,
  isEmpty,
  emptyLabel,
  children,
}: {
  isLoading: boolean
  isEmpty: boolean
  emptyLabel: string
  children: ReactNode
}) {
  return (
    <Card>
      <CardContent className="px-0">
        {isLoading ? (
          <div className="flex flex-col gap-3 px-4 py-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-full" />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center text-muted-foreground">
            <FileBarChart className="size-8" />
            <p className="text-sm">{emptyLabel}</p>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}
