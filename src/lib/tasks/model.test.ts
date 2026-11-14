import { describe, expect, it } from 'vitest'
import { buildOccurrences, canComplete, isNewFor, progress, statusFor, streak, type Completion, type Task } from './model'

const KID = 'kid-1'
const KID2 = 'kid-2'
const MUM = 'mum'

function task(t: Partial<Task> = {}): Task {
  return {
    id: 't1',
    familyId: 'f',
    title: 'Make the bed',
    notes: '',
    emoji: '🛏️',
    categoryId: null,
    colour: null,
    startDate: '2026-11-01',
    dueTime: null,
    repeat: 'daily',
    repeatDays: [],
    repeatUntil: null,
    completionMode: 'each',
    points: 1,
    reminderMinutes: null,
    archivedAt: null,
    createdBy: MUM,
    createdAt: '2026-11-01T08:00:00Z',
    assignees: [{ userId: KID, assignedBy: MUM, assignedAt: '2026-11-01T08:00:00Z' }],
    ...t,
  }
}

const done = (date: string, forUser: string | null = KID, taskId = 't1'): Completion => ({
  id: `${taskId}-${date}-${forUser}`,
  taskId,
  occurrenceDate: date,
  forUser,
  completedBy: forUser ?? MUM,
  completedAt: `${date}T09:00:00Z`,
  points: 1,
})

describe('status rules', () => {
  it('done = ticked, missed = past day not done, due = today, upcoming = future', () => {
    expect(statusFor('2026-11-10', '2026-11-14', true)).toBe('done')
    expect(statusFor('2026-11-13', '2026-11-14', false)).toBe('missed')
    expect(statusFor('2026-11-14', '2026-11-14', false)).toBe('due')
    expect(statusFor('2026-11-15', '2026-11-14', false)).toBe('upcoming')
  })

  it('missed days stay in history as crosses', () => {
    const occs = buildOccurrences([task()], [done('2026-11-12')], '2026-11-11', '2026-11-15', '2026-11-14')
    expect(occs.map((o) => [o.date, o.status])).toEqual([
      ['2026-11-11', 'missed'],
      ['2026-11-12', 'done'],
      ['2026-11-13', 'missed'],
      ['2026-11-14', 'due'],
      ['2026-11-15', 'upcoming'],
    ])
  })
})

describe('recurring instances are independent', () => {
  it('ticking today does not tick tomorrow', () => {
    const occs = buildOccurrences([task()], [done('2026-11-14')], '2026-11-14', '2026-11-15', '2026-11-14')
    expect(occs[0].status).toBe('done')
    expect(occs[1].status).toBe('upcoming')
  })

  it("'each' mode gives every assignee their own tick", () => {
    const t = task({
      assignees: [
        { userId: KID, assignedBy: MUM, assignedAt: '2026-11-01T08:00:00Z' },
        { userId: KID2, assignedBy: MUM, assignedAt: '2026-11-01T08:00:00Z' },
      ],
    })
    const occs = buildOccurrences([t], [done('2026-11-14', KID)], '2026-11-14', '2026-11-14', '2026-11-14')
    expect(occs.map((o) => [o.forUser, o.status])).toEqual([
      [KID, 'done'],
      [KID2, 'due'],
    ])
  })

  it("'any' mode is a single shared tick", () => {
    const t = task({ completionMode: 'any', title: 'Take out the bins' })
    const occs = buildOccurrences([t], [done('2026-11-14', null)], '2026-11-14', '2026-11-14', '2026-11-14')
    expect(occs).toHaveLength(1)
    expect(occs[0].status).toBe('done')
    expect(progress(occs)).toEqual({ done: 1, total: 1, ratio: 1 })
  })
})

describe('who can tick', () => {
  const [occ] = buildOccurrences([task()], [], '2026-11-14', '2026-11-14', '2026-11-14')
  it('kids can tick their own, not other people’s', () => {
    expect(canComplete(occ, KID, false, '2026-11-14')).toBe(true)
    expect(canComplete(occ, KID2, false, '2026-11-14')).toBe(false)
  })
  it('admins can tick anyone’s', () => {
    expect(canComplete(occ, MUM, true, '2026-11-14')).toBe(true)
  })
  it('anyone can tick a task assigned to nobody', () => {
    const [shared] = buildOccurrences([task({ assignees: [] })], [], '2026-11-14', '2026-11-14', '2026-11-14')
    expect(shared.forUser).toBeNull()
    expect(canComplete(shared, KID2, false, '2026-11-14')).toBe(true)
  })
  it('nobody can tick a future day', () => {
    const [future] = buildOccurrences([task()], [], '2026-11-15', '2026-11-15', '2026-11-14')
    expect(canComplete(future, MUM, true, '2026-11-14')).toBe(false)
  })
})

describe('NEW badge', () => {
  const now = new Date('2026-11-14T12:00:00Z')
  const fresh = task({ createdAt: '2026-11-14T08:00:00Z', assignees: [{ userId: KID, assignedBy: MUM, assignedAt: '2026-11-14T08:00:00Z' }] })

  it('shows for a task someone else created or assigned recently', () => {
    expect(isNewFor(fresh, KID, undefined, now)).toBe(true)
  })
  it('goes away once viewed', () => {
    expect(isNewFor(fresh, KID, '2026-11-14T09:00:00Z', now)).toBe(false)
  })
  it('comes back if re-assigned after being viewed', () => {
    const reassigned = task({ ...fresh, assignees: [{ userId: KID, assignedBy: MUM, assignedAt: '2026-11-14T10:00:00Z' }] })
    expect(isNewFor(reassigned, KID, '2026-11-14T09:00:00Z', now)).toBe(true)
  })
  it('never shows for your own tasks', () => {
    expect(isNewFor(fresh, MUM, undefined, now)).toBe(false)
  })
  it('expires after 7 days', () => {
    expect(isNewFor(task(), KID, undefined, now)).toBe(false) // created 1 Nov
  })
})

describe('streaks', () => {
  it('counts consecutive fully-done days; an unfinished today does not break it', () => {
    const comps = ['2026-11-11', '2026-11-12', '2026-11-13'].map((d) => done(d))
    const occs = buildOccurrences([task()], comps, '2026-11-01', '2026-11-14', '2026-11-14')
    expect(streak(occs, KID, '2026-11-14')).toBe(3)
  })
  it('a missed day breaks the streak', () => {
    const comps = ['2026-11-11', '2026-11-13'].map((d) => done(d))
    const occs = buildOccurrences([task()], comps, '2026-11-01', '2026-11-14', '2026-11-14')
    expect(streak(occs, KID, '2026-11-14')).toBe(1)
  })
  it('days with nothing assigned are skipped', () => {
    const t = task({ repeat: 'weekdays', repeatDays: [1, 3, 5] }) // Mon/Wed/Fri
    const comps = ['2026-11-09', '2026-11-11', '2026-11-13'].map((d) => done(d))
    const occs = buildOccurrences([t], comps, '2026-11-01', '2026-11-14', '2026-11-14')
    expect(streak(occs, KID, '2026-11-14')).toBe(3)
  })
})
