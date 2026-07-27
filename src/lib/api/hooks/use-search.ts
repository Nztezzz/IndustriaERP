import { useQuery } from "@tanstack/react-query"
import * as searchApi from "@/lib/api/search"
import { queryKeys } from "@/lib/api/query-keys"

export function useSearch(query: string) {
  const trimmed = query.trim()
  return useQuery({
    queryKey: queryKeys.search.results(trimmed),
    queryFn: () => searchApi.search(trimmed),
    enabled: trimmed.length > 0,
  })
}
