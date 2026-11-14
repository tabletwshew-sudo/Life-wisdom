import { describe, expect, it } from 'vitest'
import { addDays, dayOfWeek, formatTime, relativeDay, startOfWeek, todayIn } from './dates'

describe('dates', () => {
  it('adds days across month and year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('knows the weekday', () => {
    expect(dayOfWeek('2026-11-14')).toBe(6) // Saturday
  })
  it('finds the start of the week (Monday or Sunday)', () => {
    expect(startOfWeek('2026-11-14', 1)).toBe('2026-11-09')
    expect(startOfWeek('2026-11-14', 0)).toBe('2026-11-08')
  })
  it('uses the family time zone for "today"', () => {
    const lateUtc = new Date('2026-11-14T23:30:00Z')
    expect(todayIn('Europe/London', lateUtc)).toBe('2026-11-14')
    expect(todayIn('Australia/Sydney', lateUtc)).toBe('2026-11-15')
    expect(todayIn('America/Los_Angeles', lateUtc)).toBe('2026-11-14')
  })
  it('formats friendly labels', () => {
    expect(relativeDay('2026-11-15', '2026-11-14')).toBe('Tomorrow')
    expect(formatTime('08:30:00')).toBe('8:30am')
    expect(formatTime('18:00:00')).toBe('6pm')
  })
})
