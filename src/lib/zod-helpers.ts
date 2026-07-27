import { z } from "zod"

/**
 * An optional numeric form field that correctly treats a blank text input
 * as "not provided".
 *
 * The naive `z.coerce.number().optional()` does NOT do this: `.optional()`
 * only lets `undefined` skip validation, but an empty `<input>`'s value is
 * `""`, and `Number("")` coerces to `0` -- a perfectly valid number that
 * sails straight through. The practical effect: a user backspaces a
 * weight/quantity field back to empty, and the form silently submits `0`
 * instead of leaving the field unset, which is a real (if easy to miss)
 * data-quality bug for anything where "not provided" and "explicitly
 * zero" mean different things (e.g. a reel's weight).
 *
 * This normalizes `""` to `undefined` *before* coercion runs, so a blank
 * field actually round-trips as `undefined` (and from there, callers
 * typically do `value ?? null` when building the request body).
 */
export function optionalNumberField(min = 0) {
  return z.preprocess(
    (val) => (val === "" || val === undefined ? undefined : val),
    z.coerce.number().min(min).optional()
  )
}
