import { apiRequest } from "@/lib/api/client"
import type { SearchResultsDto } from "@/lib/api/types"

export function search(query: string) {
  return apiRequest<SearchResultsDto>("/search", { query: { q: query } })
}
