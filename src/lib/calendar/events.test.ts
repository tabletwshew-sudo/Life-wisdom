import { describe, expect, it } from 'vitest'
import { addMonths, eventsOnDay, expandEvents, isEventNewFor, monthGrid, yearsSince, type CalEvent } from './events'

function ev(e: Partial<CalEvent>): CalEvent {
  return {
    id: 'e1',
    familyId: 'f',
    title: 'Event',
    typeId: null,
    startDate: '2026-11-14',
    endDate: '2026-11-14',
    allDay: true,
    startTime: null,
    endTime: null,
    location: '',
    notes: '',
    colour: null,
    repeat: 'once',
    repeatUntil: null,
    reminderMinutes: null,
    createdBy: null,
    createdAt: '2026-11-01T00:00:00Z',
    attendees: [],
    skipped: [],
    ...e,
  }
}

describe('expandEvents', () => {
  it('yearly birthdays repeat every year and know the age', () => {
    const bday = ev({ title: 'Sam’s birthday', startDate: '2014-03-09', endDate: '2014-03-09', repeat: 'yearly' })
    const occs = expandEvents([bday], '2026-01-01', '2027-12-31')
    expect(occs.map((o) => o.start)).toEqual(['2026-03-09', '2027-03-09'])
    expect(yearsSince(bday, '2026-03-09')).toBe(12)
  })

  it('weekly events (e.g. football) with an end date', () => {
    const f = ev({ startDate: '2026-11-03', endDate: '2026-11-03', repeat: 'weekly', repeatUntil: '2026-11-24', allDay: false, startTime: '17:00' })
    expect(expandEvents([f], '2026-11-01', '2026-12-31').map((o) => o.start)).toEqual(['2026-11-03', '2026-11-10', '2026-11-17', '2026-11-24'])
  })

  it('multi-day trips show on every day they cover, even if they started before the range', () => {
    const trip = ev({ title: 'Holiday', startDate: '2026-10-29', endDate: '2026-11-03' })
    const occs = expandEvents([trip], '2026-11-01', '2026-11-30')
    expect(occs).toHaveLength(1)
    expect(eventsOnDay(occs, '2026-11-02')).toHaveLength(1)
    expect(eventsOnDay(occs, '2026-11-04')).toHaveLength(0)
  })

  it('skipped dates of a repeating event are left out', () => {
    const f = ev({ startDate: '2026-11-03', endDate: '2026-11-03', repeat: 'weekly', skipped: ['2026-11-10'] })
    expect(expandEvents([f], '2026-11-01', '2026-11-20').map((o) => o.start)).toEqual(['2026-11-03', '2026-11-17'])
  })

  it('sorts all-day events first, then by time', () => {
    const a = ev({ id: 'a', title: 'Dentist', allDay: false, startTime: '15:30' })
    const b = ev({ id: 'b', title: 'Inset day' })
    const c = ev({ id: 'c', title: 'Swimming', allDay: false, startTime: '09:00' })
    expect(expandEvents([a, b, c], '2026-11-14', '2026-11-14').map((o) => o.event.title)).toEqual(['Inset day', 'Swimming', 'Dentist'])
  })
})

describe('month helpers', () => {
  it('builds a 6-week grid starting on the family’s week start', () => {
    const g = monthGrid(2026, 11, 1)
    expect(g).toHaveLength(6)
    expect(g[0][0]).toBe('2026-10-26') // Monday before 1 Nov 2026 (a Sunday)
    expect(monthGrid(2026, 11, 0)[0][0]).toBe('2026-11-01')
  })
  it('adds months, clamping to the end of shorter months', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2026-11-14', 2)).toBe('2027-01-14')
    expect(addMonths('2026-01-14', -1)).toBe('2025-12-14')
  })
})

describe('NEW events', () => {
  const now = new Date('2026-11-14T12:00:00Z')
  it('is new when someone else adds you as attending, until you view it', () => {
    const e = ev({ createdBy: 'mum', createdAt: '2026-11-14T08:00:00Z', attendees: [{ userId: 'kid', addedBy: 'mum', addedAt: '2026-11-14T08:00:00Z' }] })
    expect(isEventNewFor(e, 'kid', undefined, now)).toBe(true)
    expect(isEventNewFor(e, 'kid', '2026-11-14T09:00:00Z', now)).toBe(false)
    expect(isEventNewFor(e, 'mum', undefined, now)).toBe(false)
  })
})
