/**
 * Calendar-date helpers using plain 'YYYY-MM-DD' strings.
 * All maths is done in UTC so daylight-saving changes can never shift a day.
 */
export type ISODate = string

const DAY = 86_400_000

export function toISO(d: Date): ISODate {
  return d.toISOString().slice(0, 10)
}

export function fromISO(iso: ISODate): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export function addDays(iso: ISODate, n: number): ISODate {
  return toISO(new Date(fromISO(iso).getTime() + n * DAY))
}

export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((fromISO(b).getTime() - fromISO(a).getTime()) / DAY)
}

/** 0 = Sunday … 6 = Saturday */
export function dayOfWeek(iso: ISODate): number {
  return fromISO(iso).getUTCDay()
}

export function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate()
}

export function parts(iso: ISODate) {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d }
}

/** Today's date in a given IANA time zone (e.g. the family's). */
export function todayIn(timeZone: string, now: Date = new Date()): ISODate {
  try {
    const f = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    return f.format(now) // en-CA formats as YYYY-MM-DD
  } catch {
    return toISO(new Date(now.getTime() - now.getTimezoneOffset() * 60_000))
  }
}

/** Start of the week containing `iso`. weekStartsOn: 0 Sun, 1 Mon, 6 Sat. */
export function startOfWeek(iso: ISODate, weekStartsOn: number): ISODate {
  const diff = (dayOfWeek(iso) - weekStartsOn + 7) % 7
  return addDays(iso, -diff)
}

export function range(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = []
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d)
  return out
}

const fmtCache = new Map<string, Intl.DateTimeFormat>()
/** Format a calendar date for display (en-GB), e.g. { weekday: 'short', day: 'numeric' } */
export function formatDate(iso: ISODate, opts: Intl.DateTimeFormatOptions): string {
  const key = JSON.stringify(opts)
  let f = fmtCache.get(key)
  if (!f) {
    f = new Intl.DateTimeFormat('en-GB', { ...opts, timeZone: 'UTC' })
    fmtCache.set(key, f)
  }
  return f.format(fromISO(iso))
}

/** "Today", "Yesterday", "Tomorrow" or e.g. "Mon 16 Nov" */
export function relativeDay(iso: ISODate, today: ISODate): string {
  const diff = daysBetween(today, iso)
  if (diff === 0) return 'Today'
  if (diff === -1) return 'Yesterday'
  if (diff === 1) return 'Tomorrow'
  return formatDate(iso, { weekday: 'short', day: 'numeric', month: 'short' })
}

/** '08:30:00' → '8:30am' */
export function formatTime(t: string | null | undefined): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const suffix = h < 12 ? 'am' : 'pm'
  const h12 = h % 12 === 0 ? 12 : h % 12
  return m === 0 ? `${h12}${suffix}` : `${h12}:${String(m).padStart(2, '0')}${suffix}`
}
