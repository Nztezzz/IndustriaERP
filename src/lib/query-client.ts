import { QueryClient } from "@tanstack/react-query"
import { ApiError } from "@/lib/api/client"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        // Don't retry auth/permission/not-found errors -- retrying won't help.
        if (
          error instanceof ApiError &&
          [401, 403, 404].includes(error.status)
        ) {
          return false
        }
        return failureCount < 2
      },
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
})
