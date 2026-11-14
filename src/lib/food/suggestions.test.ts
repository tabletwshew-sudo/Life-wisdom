import { describe, expect, it } from 'vitest'
import { SUGGESTIONS, suggest } from './suggestions'

describe('suggest', () => {
  it('respects the filter', () => {
    for (let i = 0; i < 30; i++) {
      expect(suggest('vegetarian')!.tags).toContain('vegetarian')
      expect(suggest('drink')!.kind).toBe('drink')
    }
  })
  it('avoids things already shown or already in the recipe book', () => {
    const drinks = SUGGESTIONS.filter((s) => s.kind === 'drink').map((s) => s.title)
    const keep = drinks.pop()!
    expect(suggest('drink', drinks)!.title).toBe(keep)
  })
  it('starts again when everything has been shown', () => {
    const all = SUGGESTIONS.map((s) => s.title)
    expect(suggest('dessert', all)).not.toBeNull()
  })
  it('has unique titles', () => {
    expect(new Set(SUGGESTIONS.map((s) => s.title)).size).toBe(SUGGESTIONS.length)
  })
})
