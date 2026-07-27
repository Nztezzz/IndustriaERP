/**
 * The Rust backend deserializes request-body `NaiveDateTime` fields (e.g.
 * `dispatchDate`) using chrono's default format: "YYYY-MM-DDTHH:MM:SS"
 * (a "T" separator, no timezone offset, no milliseconds). This is
 * different from what it *sends back* in responses, which uses
 * `NaiveDateTime::to_string()` -> "YYYY-MM-DD HH:MM:SS" (space separator).
 *
 * Always send request dates through this helper rather than
 * `date.toISOString()` (which includes milliseconds and a trailing "Z"
 * that the backend will reject with a 422 deserialize error).
 */
export function toRequestDateTime(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0")
  const yyyy = date.getFullYear()
  const mm = pad(date.getMonth() + 1)
  const dd = pad(date.getDate())
  const hh = pad(date.getHours())
  const min = pad(date.getMinutes())
  const ss = pad(date.getSeconds())
  return `${yyyy}-${mm}-${dd}T${hh}:${min}:${ss}`
}

/**
 * Parses a response timestamp into a `Date`. Treats the value as local
 * time, matching how the backend stores it (naive, no timezone -- this is
 * a single-machine offline app, so the machine's local clock is the only
 * clock that matters).
 *
 * The backend's `NaiveDateTime::to_string()` usually produces
 * "YYYY-MM-DD HH:MM:SS", but timestamps captured via `Utc::now()` (e.g.
 * `stock_movements.created_at`) carry real sub-second precision and come
 * through as "YYYY-MM-DD HH:MM:SS.fffffffff" (up to 9 fractional digits --
 * chrono only omits the fraction when it's exactly zero). `new Date()` in
 * V8/Chromium tolerates fractional seconds longer than 3 digits by
 * truncating, so this works for both shapes -- but don't swap this for a
 * stricter parser (e.g. a fixed-format regex) without accounting for that.
 */
export function parseResponseDateTime(value: string): Date {
  return new Date(value.replace(" ", "T"))
}
