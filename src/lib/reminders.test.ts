import { describe, expect, it } from 'vitest'
import type { CalEvent } from './calendar/events'
import { dueReminders, wallMinutes } from './reminders'
import type { Task } from './tasks/model'

const ME = 'me'
const task = (t: Partial<Task>): Task => ({
  id: 't', familyId: 'f', title: 'Feed the fish', notes: '', emoji: '🐟', categoryId: null, colour: null,
  startDate: '2026-11-01', dueTime: '07:30', repeat: 'daily', repeatDays: [], repeatUntil: null, completionMode: 'each',
  points: 1, reminderMinutes: 10, archivedAt: null, createdBy: 'mum', createdAt: '2026-11-01T00:00:00Z',
  assignees: [{ userId: ME, assignedBy: 'mum', assignedAt: '2026-11-01T00:00:00Z' }], ...t,
})
const event = (e: Partial<CalEvent>): CalEvent => ({
  id: 'e', familyId: 'f', title: 'Dentist', typeId: null, startDate: '2026-11-15', endDate: '2026-11-15', allDay: false,
  startTime: '15:30', endTime: null, location: '', notes: '', colour: null, repeat: 'once', repeatUntil: null,
  reminderMinutes: 1440, createdBy: 'mum', createdAt: '2026-11-01T00:00:00Z', attendees: [], skipped: [], ...e,
})

const at = (date: string, time: string) => wallMinutes(date, time)
const run = (now: number, extra: Partial<Parameters<typeof dueReminders>[0]> = {}) =>
  dueReminders({ userId: ME, tasks: [task({})], completions: [], events: [], today: '2026-11-14', fromMin: now - 1, toMin: now, ...extra })

describe('in-app reminders', () => {
  it('fires a task reminder N minutes before the due time', () => {
    expect(run(at('2026-11-14', '07:20'))).toEqual([
      { key: 'task:t:2026-11-14:me', title: '⏰ 🐟 Feed the fish', body: 'Due today at 7:30am', link: '/tasks?view=day&date=2026-11-14' },
    ])
    expect(run(at('2026-11-14', '07:21'))).toEqual([])
  })

  it('does not remind about a task that is already done', () => {
    const done = [{ id: 'c', taskId: 't', occurrenceDate: '2026-11-14', forUser: ME, completedBy: ME, completedAt: '', points: 1 }]
    expect(run(at('2026-11-14', '07:20'), { completions: done })).toEqual([])
  })

  it('does not remind people who are not assigned', () => {
    expect(run(at('2026-11-14', '07:20'), { userId: 'sibling' })).toEqual([])
  })

  it('untimed tasks remind relative to 8am', () => {
    expect(run(at('2026-11-14', '08:00'), { tasks: [task({ dueTime: null, reminderMinutes: 0 })] })).toHaveLength(1)
  })

  it('event reminders a day before, for everyone when nobody is invited', () => {
    const r = run(at('2026-11-14', '15:30'), { tasks: [], events: [event({})] })
    expect(r).toEqual([{ key: 'event:e:2026-11-15:me', title: '📅 Dentist', body: 'Tomorrow at 3:30pm', link: '/calendar?view=day&date=2026-11-15' }])
  })

  it('skips events you are not going to', () => {
    const r = run(at('2026-11-14', '15:30'), { tasks: [], events: [event({ attendees: [{ userId: 'mum', addedBy: 'mum', addedAt: '' }] })] })
    expect(r).toEqual([])
  })
})
