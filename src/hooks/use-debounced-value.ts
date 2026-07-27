import { useEffect, useState } from "react"

/**
 * Returns a debounced copy of `value` that only updates after `delayMs` of
 * no further changes. Used to avoid firing a search request on every
 * keystroke -- the query only actually re-runs once the user pauses
 * typing.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs)
    return () => window.clearTimeout(timer)
  }, [value, delayMs])

  return debounced
}
