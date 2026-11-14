import { addDays, dayOfWeek, daysBetween, daysInMonth, formatDate, parts, type ISODate } from '../dates'

export type Repeat = 'once' | 'daily' | 'weekdays' | 'weekly' | 'fortnightly' | 'monthly' | 'yearly'

export const REPEAT_OPTIONS: { value: Repeat; label: string }[] = [
  { value: 'once', label: 'Once' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekdays', label: 'Some days' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

export interface RecurrenceRule {
  repeat: Repeat
  /** For 'weekdays': 0 = Sunday … 6 = Saturday */
  repeatDays: number[]
  startDate: ISODate
  repeatUntil: ISODate | null
}

/**
 * Does the rule produce an occurrence on `date`?
 * Must stay identical to public.occurs_on() in the database (an integration test checks this).
 */
export function occursOn(rule: RecurrenceRule, date: ISODate): boolean {
  const { repeat, repeatDays, startDate, repeatUntil } = rule
  if (date < startDate) return false
  if (repeatUntil && date > repeatUntil) return false
  switch (repeat) {
    case 'once':
      return date === startDate
    case 'daily':
      return true
    case 'weekdays':
      return repeatDays.includes(dayOfWeek(date))
    case 'weekly':
      return daysBetween(startDate, date) % 7 === 0
    case 'fortnightly':
      return daysBetween(startDate, date) % 14 === 0
    case 'monthly': {
      const s = parts(startDate)
      const d = parts(date)
      return d.d === Math.min(s.d, daysInMonth(d.y, d.m))
    }
    case 'yearly': {
      const s = parts(startDate)
      const d = parts(date)
      return d.m === s.m && d.d === Math.min(s.d, daysInMonth(d.y, d.m))
    }
    default:
      return false
  }
}

/** All occurrence dates between from and to (inclusive). */
export function occurrencesBetween(rule: RecurrenceRule, from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = []
  const start = from > rule.startDate ? from : rule.startDate
  const end = rule.repeatUntil && rule.repeatUntil < to ? rule.repeatUntil : to
  if (rule.repeat === 'once') return rule.startDate >= from && rule.startDate <= to ? [rule.startDate] : []
  for (let d = start; d <= end; d = addDays(d, 1)) if (occursOn(rule, d)) out.push(d)
  return out
}

/** The next occurrence on or after `from` (searches up to ~2 years ahead). */
export function nextOccurrence(rule: RecurrenceRule, from: ISODate): ISODate | null {
  const start = from > rule.startDate ? from : rule.startDate
  for (let i = 0, d = start; i < 800; i++, d = addDays(d, 1)) {
    if (rule.repeatUntil && d > rule.repeatUntil) return null
    if (occursOn(rule, d)) return d
  }
  return null
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Human description, e.g. "Every Mon, Wed, Fri" or "Monthly on the 3rd". */
export function describeRule(rule: RecurrenceRule, weekStartsOn = 1): string {
  const { repeat, repeatDays, startDate } = rule
  const until = rule.repeatUntil ? ` until ${formatDate(rule.repeatUntil, { day: 'numeric', month: 'short' })}` : ''
  switch (repeat) {
    case 'once':
      return formatDate(startDate, { weekday: 'short', day: 'numeric', month: 'short' })
    case 'daily':
      return 'Every day' + until
    case 'weekdays': {
      const sorted = [...repeatDays].sort((a, b) => ((a - weekStartsOn + 7) % 7) - ((b - weekStartsOn + 7) % 7))
      const key = [...repeatDays].sort().join('')
      if (key === '12345') return 'Weekdays' + until
      if (key === '06') return 'Weekends' + until
      return 'Every ' + sorted.map((d) => DAY_NAMES[d]).join(', ') + until
    }
    case 'weekly':
      return `Every ${formatDate(startDate, { weekday: 'long' })}` + until
    case 'fortnightly':
      return `Every other ${formatDate(startDate, { weekday: 'long' })}` + until
    case 'monthly':
      return `Monthly on the ${ordinal(parts(startDate).d)}` + until
    case 'yearly':
      return `Every year on ${formatDate(startDate, { day: 'numeric', month: 'long' })}` + until
  }
}

export function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd']
  const v = n % 100
  return n + (s[(v - 20) % 10] || s[v] || s[0])
}
