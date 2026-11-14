import { addDays, daysBetween, parts, type ISODate } from '../dates'
import { isNewItem } from '../tasks/model'
import { occurrencesBetween, type Repeat } from '../tasks/recurrence'

export type EventRepeat = Exclude<Repeat, 'weekdays'>

export interface CalEvent {
  id: string
  familyId: string
  title: string
  typeId: string | null
  startDate: ISODate
  endDate: ISODate
  allDay: boolean
  startTime: string | null
  endTime: string | null
  location: string
  notes: string
  colour: string | null
  repeat: EventRepeat
  repeatUntil: ISODate | null
  reminderMinutes: number | null
  createdBy: string | null
  createdAt: string
  attendees: { userId: string; addedBy: string | null; addedAt: string }[]
  /** Dates of a repeating event that were skipped ("delete just this one"). */
  skipped: ISODate[]
}

export interface EventOccurrence {
  key: string
  event: CalEvent
  /** First day of this occurrence */
  start: ISODate
  /** Last day of this occurrence (same as start for one-day events) */
  end: ISODate
}

/** Length of an event in extra days (0 for single-day events). */
export const spanDays = (e: Pick<CalEvent, 'startDate' | 'endDate'>) => Math.max(0, daysBetween(e.startDate, e.endDate))

/** Every occurrence of the events that overlaps [from, to]. */
export function expandEvents(events: CalEvent[], from: ISODate, to: ISODate): EventOccurrence[] {
  const out: EventOccurrence[] = []
  for (const event of events) {
    const span = spanDays(event)
    // An occurrence starting up to `span` days before `from` can still overlap.
    const starts = occurrencesBetween(
      { repeat: event.repeat, repeatDays: [], startDate: event.startDate, repeatUntil: event.repeatUntil },
      addDays(from, -span),
      to,
    )
    for (const start of starts) {
      if (event.skipped.includes(start)) continue
      out.push({ key: `${event.id}:${start}`, event, start, end: addDays(start, span) })
    }
  }
  return out.sort(compareEventOccurrences)
}

/** All-day first, then by start time, then by title. */
export function compareEventOccurrences(a: EventOccurrence, b: EventOccurrence): number {
  if (a.start !== b.start) return a.start < b.start ? -1 : 1
  if (a.event.allDay !== b.event.allDay) return a.event.allDay ? -1 : 1
  const ta = a.event.startTime ?? ''
  const tb = b.event.startTime ?? ''
  if (ta !== tb) return ta < tb ? -1 : 1
  return a.event.title.localeCompare(b.event.title)
}

export const occursOnDay = (o: EventOccurrence, day: ISODate) => o.start <= day && day <= o.end

export function eventsOnDay(occs: EventOccurrence[], day: ISODate): EventOccurrence[] {
  return occs.filter((o) => occursOnDay(o, day))
}

/** For yearly events (birthdays/anniversaries): how many years since the first one. */
export function yearsSince(e: Pick<CalEvent, 'repeat' | 'startDate'>, occurrenceStart: ISODate): number | null {
  if (e.repeat !== 'yearly') return null
  const n = parts(occurrenceStart).y - parts(e.startDate).y
  return n > 0 ? n : null
}

/** A 6-row grid of dates for a month view. */
export function monthGrid(year: number, month1: number, weekStartsOn: number): ISODate[][] {
  const first = `${year}-${String(month1).padStart(2, '0')}-01`
  const firstDow = new Date(Date.UTC(year, month1 - 1, 1)).getUTCDay()
  const start = addDays(first, -((firstDow - weekStartsOn + 7) % 7))
  const weeks: ISODate[][] = []
  for (let w = 0; w < 6; w++) weeks.push(Array.from({ length: 7 }, (_, i) => addDays(start, w * 7 + i)))
  return weeks
}

export function addMonths(iso: ISODate, n: number): ISODate {
  const { y, m, d } = parts(iso)
  const total = y * 12 + (m - 1) + n
  const ny = Math.floor(total / 12)
  const nm = (total % 12) + 1
  const last = new Date(Date.UTC(ny, nm, 0)).getUTCDate()
  return `${ny}-${String(nm).padStart(2, '0')}-${String(Math.min(d, last)).padStart(2, '0')}`
}

/** NEW for an event: someone else created it, or added this person as attending, recently. */
export function isEventNewFor(e: CalEvent, userId: string, seenAt: string | undefined, now: Date = new Date()): boolean {
  const mine = e.attendees.find((a) => a.userId === userId)
  return isNewItem(e.createdBy, e.createdAt, mine ? { by: mine.addedBy, at: mine.addedAt } : null, userId, seenAt, now)
}
