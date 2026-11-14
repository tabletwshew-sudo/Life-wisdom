import { describe, expect, it } from 'vitest'
import { describeRule, nextOccurrence, occurrencesBetween, occursOn, type RecurrenceRule } from './recurrence'

const rule = (r: Partial<RecurrenceRule>): RecurrenceRule => ({
  repeat: 'daily',
  repeatDays: [],
  startDate: '2026-11-02', // a Monday
  repeatUntil: null,
  ...r,
})

describe('occursOn', () => {
  it('never occurs before the start date or after the until date', () => {
    const r = rule({ repeat: 'daily', repeatUntil: '2026-11-05' })
    expect(occursOn(r, '2026-11-01')).toBe(false)
    expect(occursOn(r, '2026-11-02')).toBe(true)
    expect(occursOn(r, '2026-11-05')).toBe(true)
    expect(occursOn(r, '2026-11-06')).toBe(false)
  })

  it('once: only the start date', () => {
    const r = rule({ repeat: 'once' })
    expect(occurrencesBetween(r, '2026-10-01', '2026-12-31')).toEqual(['2026-11-02'])
  })

  it('daily: every day', () => {
    expect(occurrencesBetween(rule({ repeat: 'daily' }), '2026-11-02', '2026-11-08')).toHaveLength(7)
  })

  it('weekdays: only the chosen days (Mon, Wed, Fri)', () => {
    const r = rule({ repeat: 'weekdays', repeatDays: [1, 3, 5] })
    expect(occurrencesBetween(r, '2026-11-02', '2026-11-15')).toEqual([
      '2026-11-02', '2026-11-04', '2026-11-06', '2026-11-09', '2026-11-11', '2026-11-13',
    ])
  })

  it('weekly: same weekday as the start', () => {
    expect(occurrencesBetween(rule({ repeat: 'weekly' }), '2026-11-01', '2026-11-30')).toEqual([
      '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30',
    ])
  })

  it('fortnightly: every other week from the start (bins!)', () => {
    expect(occurrencesBetween(rule({ repeat: 'fortnightly' }), '2026-11-01', '2026-12-31')).toEqual([
      '2026-11-02', '2026-11-16', '2026-11-30', '2026-12-14', '2026-12-28',
    ])
  })

  it('monthly: same day each month; the 31st falls back to the last day', () => {
    const r = rule({ repeat: 'monthly', startDate: '2026-01-31' })
    expect(occurrencesBetween(r, '2026-01-01', '2026-05-31')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31'])
  })

  it('yearly: birthdays, including 29 February in non-leap years', () => {
    const r = rule({ repeat: 'yearly', startDate: '2024-02-29' })
    expect(occursOn(r, '2025-02-28')).toBe(true)
    expect(occursOn(r, '2028-02-29')).toBe(true)
    expect(occursOn(r, '2028-02-28')).toBe(false)
    expect(occursOn(r, '2025-03-01')).toBe(false)
  })

  it('crosses daylight-saving changes without drifting', () => {
    // UK clocks change on 29 Mar and 25 Oct 2026
    const r = rule({ repeat: 'weekly', startDate: '2026-03-23' })
    expect(occursOn(r, '2026-03-30')).toBe(true)
    expect(occursOn(r, '2026-10-26')).toBe(true)
  })
})

describe('nextOccurrence', () => {
  it('finds the next date on or after a day', () => {
    expect(nextOccurrence(rule({ repeat: 'weekly' }), '2026-11-03')).toBe('2026-11-09')
    expect(nextOccurrence(rule({ repeat: 'once' }), '2026-11-03')).toBeNull()
  })
})

describe('describeRule', () => {
  it('describes rules in plain English', () => {
    expect(describeRule(rule({ repeat: 'daily' }))).toBe('Every day')
    expect(describeRule(rule({ repeat: 'weekdays', repeatDays: [1, 2, 3, 4, 5] }))).toBe('Weekdays')
    expect(describeRule(rule({ repeat: 'weekdays', repeatDays: [5, 1, 3] }))).toBe('Every Mon, Wed, Fri')
    expect(describeRule(rule({ repeat: 'fortnightly' }))).toBe('Every other Monday')
    expect(describeRule(rule({ repeat: 'monthly', startDate: '2026-11-03' }))).toBe('Monthly on the 3rd')
  })
})
