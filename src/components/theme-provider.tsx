import { ThemeProvider as NextThemesProvider } from "next-themes"

/**
 * Wraps `next-themes`'s provider so the rest of the app just imports from
 * here. `next-themes` is framework-agnostic despite the name -- it's a
 * plain context provider that toggles a class on `<html>` and persists the
 * choice to localStorage, nothing Next.js-specific about its runtime
 * behavior. `shadcn/ui`'s `sonner.tsx` (toast icons) already calls its
 * `useTheme()` hook, so this provider has to be mounted for that to work
 * correctly instead of silently defaulting to "system".
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>
      {children}
    </NextThemesProvider>
  )
}
