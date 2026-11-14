import type { ISODate } from '../dates'
import { addDays } from '../dates'
import { occurrencesBetween, type Repeat, type RecurrenceRule } from './recurrence'

export interface Assignee {
  userId: string
  assignedBy: string | null
  assignedAt: string
}

export interface Task {
  id: string
  familyId: string
  title: string
  notes: string
  emoji: string
  categoryId: string | null
  colour: string | null
  startDate: ISODate
  dueTime: string | null
  repeat: Repeat
  repeatDays: number[]
  repeatUntil: ISODate | null
  completionMode: 'any' | 'each'
  points: number
  reminderMinutes: number | null
  archivedAt: string | null
  createdBy: string | null
  createdAt: string
  assignees: Assignee[]
}

export interface Completion {
  id: string
  taskId: string
  occurrenceDate: ISODate
  forUser: string | null
  completedBy: string | null
  completedAt: string
  points: number
}

/**
 * done     – ticked (green tick)
 * missed   – the day has ended and it wasn't done (red cross, kept in history)
 * due      – today, not done yet
 * upcoming – a future day
 */
export type OccurrenceStatus = 'done' | 'missed' | 'due' | 'upcoming'

export interface Occurrence {
  key: string
  task: Task
  date: ISODate
  /** The person this occurrence belongs to ('each' mode), or null ('any' mode / unassigned). */
  forUser: string | null
  completion: Completion | null
  status: OccurrenceStatus
}

export const ruleOf = (t: Pick<Task, 'repeat' | 'repeatDays' | 'startDate' | 'repeatUntil'>): RecurrenceRule => ({
  repeat: t.repeat,
  repeatDays: t.repeatDays,
  startDate: t.startDate,
  repeatUntil: t.repeatUntil,
})

export function statusFor(date: ISODate, today: ISODate, completed: boolean): OccurrenceStatus {
  if (completed) return 'done'
  if (date < today) return 'missed'
  if (date === today) return 'due'
  return 'upcoming'
}

const completionKey = (taskId: string, date: string, forUser: string | null) => `${taskId}:${date}:${forUser ?? 'any'}`

/** Expand tasks into individual occurrences between two dates, with their status. */
export function buildOccurrences(tasks: Task[], completions: Completion[], from: ISODate, to: ISODate, today: ISODate): Occurrence[] {
  const done = new Map<string, Completion>()
  for (const c of completions) done.set(completionKey(c.taskId, c.occurrenceDate, c.forUser), c)

  const out: Occurrence[] = []
  for (const task of tasks) {
    const owners: (string | null)[] =
      task.completionMode === 'each' && task.assignees.length > 0 ? task.assignees.map((a) => a.userId) : [null]
    for (const date of occurrencesBetween(ruleOf(task), from, to)) {
      for (const forUser of owners) {
        const key = completionKey(task.id, date, forUser)
        const completion = done.get(key) ?? null
        out.push({ key, task, date, forUser, completion, status: statusFor(date, today, !!completion) })
      }
    }
  }
  return out.sort(compareOccurrences)
}

/** Untimed tasks first, then by time, then title. */
export function compareOccurrences(a: Occurrence, b: Occurrence): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1
  const ta = a.task.dueTime ?? ''
  const tb = b.task.dueTime ?? ''
  if (ta !== tb) return ta < tb ? -1 : 1
  return a.task.title.localeCompare(b.task.title)
}

/** Does this occurrence count for a given person? */
export function belongsTo(o: Occurrence, userId: string): boolean {
  if (o.forUser) return o.forUser === userId
  return o.task.assignees.length === 0 || o.task.assignees.some((a) => a.userId === userId)
}

/** Can `userId` tick (or untick) this occurrence? Mirrors public.can_complete(). */
export function canComplete(o: Occurrence, userId: string, isAdmin: boolean, today: ISODate): boolean {
  if (o.date > today) return false
  if (isAdmin) return true
  if (o.forUser) return o.forUser === userId
  // 'any' mode or nobody assigned: any assignee (or anyone, if unassigned)
  return o.task.assignees.length === 0 || o.task.assignees.some((a) => a.userId === userId)
}

export function progress(occs: Occurrence[]): { done: number; total: number; ratio: number } {
  const total = occs.length
  const done = occs.filter((o) => o.status === 'done').length
  return { done, total, ratio: total ? done / total : 0 }
}

export const NEW_WINDOW_DAYS = 7

/**
 * Is this task "NEW" for this person?
 * Yes if, in the last 7 days, someone else created it or assigned it to them,
 * and they haven't viewed it since.
 */
export function isNewFor(task: Task, userId: string, seenAt: string | undefined, now: Date = new Date()): boolean {
  const triggers: string[] = []
  if (task.createdBy && task.createdBy !== userId) triggers.push(task.createdAt)
  const mine = task.assignees.find((a) => a.userId === userId)
  if (mine && mine.assignedBy !== userId) triggers.push(mine.assignedAt)
  if (!triggers.length) return false
  const latest = triggers.sort().at(-1)!
  if (now.getTime() - new Date(latest).getTime() > NEW_WINDOW_DAYS * 86_400_000) return false
  return !seenAt || new Date(seenAt).getTime() < new Date(latest).getTime()
}

/**
 * Streak = consecutive days (up to today) where the person finished all of their tasks.
 * Days with nothing assigned don't break the streak. An unfinished today doesn't break it either.
 */
export function streak(occs: Occurrence[], userId: string, today: ISODate, maxDays = 60): number {
  const byDay = new Map<string, { done: number; total: number }>()
  for (const o of occs) {
    if (!belongsTo(o, userId)) continue
    const d = byDay.get(o.date) ?? { done: 0, total: 0 }
    d.total++
    if (o.status === 'done') d.done++
    byDay.set(o.date, d)
  }
  let count = 0
  for (let i = 0; i <= maxDays; i++) {
    const date = addDays(today, -i)
    const d = byDay.get(date)
    if (!d || d.total === 0) continue
    if (d.done === d.total) count++
    else if (date === today) continue
    else break
  }
  return count
}

/** Points earned by a person in a date range. */
export function pointsFor(completions: Completion[], userId: string, from: ISODate, to: ISODate): number {
  return completions
    .filter((c) => (c.forUser ?? c.completedBy) === userId && c.occurrenceDate >= from && c.occurrenceDate <= to)
    .reduce((s, c) => s + c.points, 0)
}

export function isOverdueToday(o: Occurrence, today: ISODate, nowTime: string): boolean {
  return o.status === 'due' && o.date === today && !!o.task.dueTime && o.task.dueTime.slice(0, 5) < nowTime
}
