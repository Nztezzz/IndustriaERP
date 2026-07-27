import { QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { RouterProvider } from "@tanstack/react-router"
import { TanStackRouterDevtools } from "@tanstack/router-devtools"
import { queryClient } from "@/lib/query-client"
import { router } from "@/router"
import { ThemeProvider } from "@/components/theme-provider"

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
        {import.meta.env.DEV && (
          <>
            <ReactQueryDevtools initialIsOpen={false} />
            <TanStackRouterDevtools router={router} initialIsOpen={false} />
          </>
        )}
      </QueryClientProvider>
    </ThemeProvider>
  )
}

export default App
