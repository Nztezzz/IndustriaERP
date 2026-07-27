import { useState } from "react"
import { useNavigate } from "@tanstack/react-router"
import {
  Building2,
  Disc3,
  Package,
  Search,
  Truck,
  type LucideIcon,
} from "lucide-react"
import { PageHeader } from "@/components/layout/page-header"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useSearch } from "@/lib/api/hooks/use-search"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import type {
  CustomerSearchHit,
  DispatchSearchHit,
  ProductSearchHit,
  ReelSearchHit,
} from "@/lib/api/types"
import type { ReelStatus } from "@/lib/constants"

const REEL_STATUS_VARIANT: Record<
  ReelStatus,
  "outline" | "secondary" | "default" | "destructive"
> = {
  in_stock: "outline",
  dispatched: "default",
  returned: "secondary",
  lost: "destructive",
  damaged: "destructive",
}

function ResultSection<T>({
  title,
  icon: Icon,
  hits,
  isLoading,
  emptyLabel,
  renderHit,
}: {
  title: string
  icon: LucideIcon
  hits: T[] | undefined
  isLoading: boolean
  emptyLabel: string
  renderHit: (hit: T) => React.ReactNode
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <Icon className="size-4 text-muted-foreground" />
        <CardTitle className="text-sm">{title}</CardTitle>
        {hits && hits.length > 0 && (
          <Badge variant="outline" className="ml-auto">
            {hits.length}
          </Badge>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-1 px-2 pb-2">
        {isLoading ? (
          <>
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </>
        ) : !hits || hits.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          hits.map((hit, i) => <div key={i}>{renderHit(hit)}</div>)
        )}
      </CardContent>
    </Card>
  )
}

function HitRow({
  onClick,
  primary,
  secondary,
  trailing,
}: {
  onClick: () => void
  primary: string
  secondary?: string
  trailing?: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
    >
      <span className="flex min-w-0 flex-col">
        <span className="truncate font-medium">{primary}</span>
        {secondary && (
          <span className="truncate text-xs text-muted-foreground">{secondary}</span>
        )}
      </span>
      {trailing}
    </button>
  )
}

export function GlobalSearchPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState("")
  const debouncedQuery = useDebouncedValue(query, 300)
  const { data, isFetching } = useSearch(debouncedQuery)

  const hasQuery = debouncedQuery.trim().length > 0
  const totalHits = data
    ? data.products.length +
      data.customers.length +
      data.reels.length +
      data.dispatches.length
    : 0

  return (
    <>
      <PageHeader
        title="Search"
        description="Search across customers, products, reels, invoices, and dates."
      />

      <div className="flex flex-col gap-4 p-6">
        <div className="relative max-w-xl">
          <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Search products, customers, reel numbers, invoice numbers..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
        </div>

        {!hasQuery ? (
          <p className="text-sm text-muted-foreground">
            Start typing to search across every module at once. Each list
            page (Products, Customers, Inventory History, Dispatches, Reel
            Tracking) also has its own filters for narrower, module-specific
            searches.
          </p>
        ) : (
          <>
            {!isFetching && totalHits === 0 && (
              <p className="text-sm text-muted-foreground">
                No results for &quot;{debouncedQuery}&quot;.
              </p>
            )}

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <ResultSection<ProductSearchHit>
                title="Products"
                icon={Package}
                hits={data?.products}
                isLoading={isFetching}
                emptyLabel="No matching products."
                renderHit={(hit) => (
                  <HitRow
                    onClick={() =>
                      navigate({ to: "/products", search: { q: hit.sku } })
                    }
                    primary={hit.name}
                    secondary={hit.sku}
                  />
                )}
              />

              <ResultSection<CustomerSearchHit>
                title="Customers"
                icon={Building2}
                hits={data?.customers}
                isLoading={isFetching}
                emptyLabel="No matching customers."
                renderHit={(hit) => (
                  <HitRow
                    onClick={() =>
                      navigate({
                        to: "/customers/$customerId",
                        params: { customerId: hit.id },
                      })
                    }
                    primary={hit.name}
                    secondary={hit.phone ?? undefined}
                  />
                )}
              />

              <ResultSection<ReelSearchHit>
                title="Reels"
                icon={Disc3}
                hits={data?.reels}
                isLoading={isFetching}
                emptyLabel="No matching reels."
                renderHit={(hit) => (
                  <HitRow
                    onClick={() =>
                      navigate({
                        to: "/reels/$reelNumber",
                        params: { reelNumber: hit.reelNumber },
                      })
                    }
                    primary={`Reel #${hit.reelNumber}`}
                    trailing={
                      <Badge
                        variant={REEL_STATUS_VARIANT[hit.status]}
                        className="shrink-0 capitalize"
                      >
                        {hit.status.replace("_", " ")}
                      </Badge>
                    }
                  />
                )}
              />

              <ResultSection<DispatchSearchHit>
                title="Dispatches"
                icon={Truck}
                hits={data?.dispatches}
                isLoading={isFetching}
                emptyLabel="No matching dispatches."
                renderHit={(hit) => (
                  <HitRow
                    onClick={() =>
                      navigate({
                        to: "/dispatches/$dispatchId",
                        params: { dispatchId: hit.id },
                      })
                    }
                    primary={hit.invoiceNumber}
                  />
                )}
              />
            </div>
          </>
        )}
      </div>
    </>
  )
}
