import { addDays, type ISODate } from './dates'
import { expandEvents, type CalEvent } from './calendar/events'
import { buildOccurrences, belongsTo, type Completion, type Task } from './tasks/model'
import { formatTime } from './dates'

/** Minutes since 1970 for a wall-clock date + time (no time zone maths needed). */
export function wallMinutes(date: ISODate, time: string): number {
  const [y, m, d] = date.split('-').map(Number)
  const [hh, mm] = time.split(':').map(Number)
  return Date.UTC(y, m - 1, d, hh, mm) / 60_000
}

export interface DueReminder {
  /** Same format the server uses, so a reminder is never shown twice. */
  key: string
  title: string
  body: string
  link: string
}

/**
 * Reminders for one person that "fire" in (fromMin, toMin] — wall-clock
 * minutes in the family time zone. Mirrors generate_due_notifications() in SQL.
 */
export function dueReminders(opts: {
  userId: string
  tasks: Task[]
  completions: Completion[]
  events: CalEvent[]
  today: ISODate
  fromMin: number
  toMin: number
}): DueReminder[] {
  const { userId, tasks, completions, events, today, fromMin, toMin } = opts
  const out: DueReminder[] = []

  const occs = buildOccurrences(tasks.filter((t) => t.reminderMinutes !== null && !t.archivedAt), completions, today, addDays(today, 7), today)
  for (const o of occs) {
    if (!belongsTo(o, userId) || o.status === 'done') continue
    const fire = wallMinutes(o.date, o.task.dueTime ?? '08:00') - (o.task.reminderMinutes ?? 0)
    if (fire <= fromMin || fire > toMin) continue
    out.push({
      key: `task:${o.task.id}:${o.date}:${userId}`,
      title: `⏰ ${o.task.emoji} ${o.task.title}`,
      body: `${o.date === today ? 'Due today' : 'Due soon'}${o.task.dueTime ? ` at ${formatTime(o.task.dueTime)}` : ''}`,
      link: `/tasks?view=day&date=${o.date}`,
    })
  }

  for (const e of expandEvents(events.filter((x) => x.reminderMinutes !== null), today, addDays(today, 14))) {
    const ev = e.event
    if (ev.attendees.length && !ev.attendees.some((a) => a.userId === userId)) continue
    if (e.start < today) continue
    const fire = wallMinutes(e.start, ev.startTime ?? '09:00') - (ev.reminderMinutes ?? 0)
    if (fire <= fromMin || fire > toMin) continue
    out.push({
      key: `event:${ev.id}:${e.start}:${userId}`,
      title: `📅 ${ev.title}`,
      body: `${e.start === today ? 'Today' : e.start === addDays(today, 1) ? 'Tomorrow' : e.start}${ev.allDay ? '' : ` at ${formatTime(ev.startTime)}`}`,
      link: `/calendar?view=day&date=${e.start}`,
    })
  }
  return out
}
