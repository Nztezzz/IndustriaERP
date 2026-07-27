import { useState } from "react"
import { CalendarIcon, X } from "lucide-react"
import type { DateRange as DayPickerRange } from "react-day-picker"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { toRequestDateTime } from "@/lib/api/datetime"
import type { ReportRangeQuery } from "@/lib/api/reports"

export interface ReportDateRange {
  from?: Date
  to?: Date
}

function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 0)
  return d
}

function daysAgo(n: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d
}

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString()
}

/**
 * Converts a UI-facing date range into the `{from, to}` query-string
 * shape the report endpoints expect -- widened to the start/end of each
 * boundary day so picking "today" for both ends covers the whole day
 * rather than a single instant. Reuses `toRequestDateTime` (task 12) so
 * the format matches exactly what the backend's chrono NaiveDateTime
 * deserializer accepts for request bodies AND query strings alike (both
 * go through the same Deserialize impl).
 */
export function toReportRangeQuery(range: ReportDateRange): ReportRangeQuery {
  return {
    from: range.from ? toRequestDateTime(startOfDay(range.from)) : undefined,
    to: range.to ? toRequestDateTime(endOfDay(range.to)) : undefined,
  }
}

const PRESETS: { label: string; range: () => ReportDateRange }[] = [
  { label: "Today", range: () => ({ from: new Date(), to: new Date() }) },
  { label: "Last 7 days", range: () => ({ from: daysAgo(6), to: new Date() }) },
  { label: "Last 30 days", range: () => ({ from: daysAgo(29), to: new Date() }) },
  {
    label: "This month",
    range: () => {
      const now = new Date()
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to: now }
    },
  },
]

/**
 * Popover + range-mode Calendar date filter shared by every report tab.
 * Reuses the exact Calendar+Popover pairing first established for
 * `dispatchDate` in task 19's dispatch form (single-select mode there;
 * this is the app's first use of the Calendar's range mode).
 */
export function DateRangeFilter({
  value,
  onChange,
}: {
  value: ReportDateRange
  onChange: (range: ReportDateRange) => void
}) {
  const [open, setOpen] = useState(false)

  const dayPickerValue: DayPickerRange | undefined = value.from
    ? { from: value.from, to: value.to ?? value.from }
    : undefined

  function label() {
    if (!value.from) return "All time"
    if (!value.to || isSameDay(value.from, value.to)) {
      return value.from.toLocaleDateString()
    }
    return `${value.from.toLocaleDateString()} - ${value.to.toLocaleDateString()}`
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="font-normal">
            <CalendarIcon />
            {label()}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex flex-col sm:flex-row">
            <div className="flex flex-col gap-1 border-b p-2 sm:border-r sm:border-b-0">
              {PRESETS.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className="justify-start"
                  onClick={() => {
                    onChange(preset.range())
                    setOpen(false)
                  }}
                >
                  {preset.label}
                </Button>
              ))}
              <Button
                variant="ghost"
                size="sm"
                className="justify-start"
                onClick={() => {
                  onChange({})
                  setOpen(false)
                }}
              >
                All time
              </Button>
            </div>
            <Calendar
              mode="range"
              numberOfMonths={2}
              selected={dayPickerValue}
              onSelect={(range) => onChange({ from: range?.from, to: range?.to })}
            />
          </div>
        </PopoverContent>
      </Popover>
      {value.from && (
        <Button variant="ghost" size="sm" onClick={() => onChange({})}>
          <X />
          Clear
        </Button>
      )}
    </div>
  )
}
