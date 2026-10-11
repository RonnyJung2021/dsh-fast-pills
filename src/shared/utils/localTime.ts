/**
 * What a "day" is to the ledger, and how the statistics are cut into periods.
 *
 * Every boundary here is the reading page's own local one: a day starts
 * at that machine's local midnight, a week on its Monday, a month on the first
 * of its calendar month. Ledger rows carry an instant and nothing else, so
 * which bucket a row belongs to is decided when it is read — never when it is
 * written. The keys the calendar blocks colour by are the local calendar date,
 * so a row and a day cell agree on the same string.
 */

/** One calendar day, `YYYY-M-D` in the reader's own local zone. */
export type DayKey = string

/** Which stretch of the ledger a range view shows. */
export type Period = 'day' | 'week' | 'month'

/** How many milliseconds one local day holds; only used to close a day. */
const DAY_MS = 24 * 60 * 60 * 1000

/** How many days a week holds. */
const WEEK_DAYS = 7

/**
 * Two digits, as a local date label.
 * @param value - the number to pad.
 * @returns the number with a leading zero below ten.
 */
function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * The local calendar day an instant falls in.
 * @param at - the instant.
 * @returns the day's key, comparable as a string because it is zero-padded.
 */
export function dayKeyOf(at: Date): DayKey {
  return `${String(at.getFullYear())}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
}

/**
 * The local midnight that starts a day.
 * @param at - the instant to cut; today when omitted.
 * @returns a new date at that day's local zero.
 */
export function startOfLocalDay(at: Date = new Date()): Date {
  return new Date(at.getFullYear(), at.getMonth(), at.getDate())
}

/**
 * An instant inside the local day one key names.
 *
 * The key is read as a local calendar date: parsing it as an instant would put
 * the noon of a UTC day into some other local day for a reader east or west of
 * Greenwich, and a ledger is always cut by the reader's own midnight.
 * @param key - a day key, `YYYY-M-D`; only the first three numbers are read.
 * @returns noon of that local day, or the epoch when the key is not a date.
 */
export function dateOfDayKey(key: string): Date {
  const parts = key.split('-').map(Number)
  const [year, month, date] = parts
  if (year === undefined || month === undefined || date === undefined) return new Date(Number.NaN)
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(date)) return new Date(Number.NaN)
  return new Date(year, month - 1, date, 12)
}

/**
 * The last millisecond of a local day.
 * @param at - the instant whose day to close; today when omitted.
 * @returns a new date at `23:59:59.999` local.
 */
export function endOfLocalDay(at: Date = new Date()): Date {
  return new Date(startOfLocalDay(at).getTime() + DAY_MS - 1)
}

/**
 * Shift an instant by whole local days.
 * @param at - the instant to move.
 * @param days - how many days to add, negative to go back.
 * @returns a new date the same local time, `days` days away.
 */
export function stepLocalDay(at: Date, days: number): Date {
  return new Date(at.getFullYear(), at.getMonth(), at.getDate() + days, at.getHours(), at.getMinutes(), at.getSeconds(), at.getMilliseconds())
}

/**
 * Shift an instant by whole local months, without the end-of-month rollover.
 *
 * `new Date(y, m + 1, 31)` lands in the month after next when the target month
 * is short, so the arithmetic starts from the first of the month and the day is
 * clamped to the last day the target month holds.
 * @param at - the instant to move.
 * @param months - how many months to add, negative to go back.
 * @returns a new date the same time of day, `months` months away.
 */
export function stepLocalMonth(at: Date, months: number): Date {
  const firstOfTarget = new Date(at.getFullYear(), at.getMonth() + months, 1)
  const lastDay = new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth() + 1, 0).getDate()
  return new Date(firstOfTarget.getFullYear(), firstOfTarget.getMonth(), Math.min(at.getDate(), lastDay), at.getHours(), at.getMinutes())
}

/**
 * The Monday that starts the local week an instant falls in.
 * @param at - the instant inside the week.
 * @returns a new date at that week's local Monday zero.
 */
export function startOfLocalWeek(at: Date): Date {
  const day = startOfLocalDay(at)
  // `getDay()` calls Sunday 0; a Monday-first week is five days back from it.
  const back = (day.getDay() + WEEK_DAYS - 1) % WEEK_DAYS
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() - back)
}

/**
 * The local midnight that starts the month an instant falls in.
 * @param at - the instant inside the month.
 * @returns a new date at that month's first day, local zero.
 */
export function startOfLocalMonth(at: Date): Date {
  return new Date(at.getFullYear(), at.getMonth(), 1)
}

/**
 * Move one whole period forward or back.
 * @param at - an instant inside the current period.
 * @param period - which kind of period is being paged.
 * @param direction - `1` for the next period, `-1` for the previous one.
 * @returns a new date inside the neighbouring period.
 */
export function stepPeriod(at: Date, period: Period, direction: number): Date {
  if (period === 'day') return stepLocalDay(at, direction)
  if (period === 'week') return stepLocalDay(at, direction * WEEK_DAYS)
  return stepLocalMonth(at, direction)
}

/**
 * The two closed ends of the local period an instant falls in.
 * @param at - an instant inside the period.
 * @param period - which period to cut.
 * @returns the first instant and the last instant of that period.
 */
export function periodRange(at: Date, period: Period): { readonly start: Date; readonly end: Date } {
  if (period === 'day') return { start: startOfLocalDay(at), end: endOfLocalDay(at) }
  if (period === 'week') {
    const start = startOfLocalWeek(at)
    return { start, end: endOfLocalDay(stepLocalDay(start, WEEK_DAYS - 1)) }
  }
  const start = startOfLocalMonth(at)
  // A month plus a few days always lands in the next month, whose first day is
  // the exclusive end of this one.
  const nextMonth = new Date(start.getFullYear(), start.getMonth(), 1 + 32)
  return { start, end: new Date(new Date(nextMonth.getFullYear(), nextMonth.getMonth(), 1).getTime() - 1) }
}

/**
 * Every local day from one instant to another, in order.
 *
 * The step is a local calendar day rather than 24 hours, so a day on which the
 * zone shifts is still one cell.
 * @param from - the first day's instant.
 * @param to - the last day's instant.
 * @returns one instant per day, at local midnight.
 */
export function daysInRange(from: Date, to: Date): Date[] {
  const days: Date[] = []
  let cursor = startOfLocalDay(from)
  const last = startOfLocalDay(to).getTime()
  while (cursor.getTime() <= last) {
    days.push(cursor)
    cursor = stepLocalDay(cursor, 1)
  }
  return days
}

/**
 * Count the ledger's rows by the local day they fall in.
 *
 * A row whose instant cannot be parsed is skipped; a row outside every cell the
 * caller asks about is not part of the answer.
 * @param rows - the ledger rows to bucket.
 * @param days - the days to count, each an instant inside the day it names.
 * @returns one count per entry of `days`, same order.
 */
export function countByDay(rows: readonly { readonly at: string }[], days: readonly Date[]): number[] {
  const index = new Map<DayKey, number>()
  days.forEach((day, position) => { index.set(dayKeyOf(day), position) })
  const counts = new Map<number, number>()
  for (const row of rows) {
    const at = Date.parse(row.at)
    if (Number.isNaN(at)) continue
    const position = index.get(dayKeyOf(new Date(at)))
    if (position === undefined) continue
    counts.set(position, (counts.get(position) ?? 0) + 1)
  }
  return days.map((day, position) => counts.get(position) ?? 0)
}

/**
 * The `YYYY-MM-DD` label of a local day.
 * @param at - an instant inside the day.
 * @returns the day in short numeric form.
 */
export function formatDay(at: Date): string {
  return `${String(at.getFullYear())}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
}

/**
 * The `MM-DD` label of a local day.
 * @param at - an instant inside the day.
 * @returns the day without its year, for dense axes.
 */
export function formatDayShort(at: Date): string {
  return `${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
}

/**
 * The `HH:MM` label of a local instant.
 * @param at - the instant.
 * @returns the local clock time, zero-padded.
 */
export function formatTime(at: Date): string {
  return `${pad(at.getHours())}:${pad(at.getMinutes())}`
}

/**
 * A readable name for the period a range view is showing.
 * @param at - an instant inside the period.
 * @param period - which period to name.
 * @returns the label to draw beside the paging controls.
 */
export function periodLabel(at: Date, period: Period): string {
  if (period === 'day') return formatDay(at)
  if (period === 'week') {
    const start = startOfLocalWeek(at)
    const end = stepLocalDay(start, WEEK_DAYS - 1)
    // A week that spans the new year keeps the year on its second day.
    const last = start.getFullYear() === end.getFullYear() ? formatDayShort(end) : formatDay(end)
    return `${formatDayShort(start)} – ${last}`
  }
  return `${String(at.getFullYear())}-${pad(at.getMonth() + 1)}`
}

