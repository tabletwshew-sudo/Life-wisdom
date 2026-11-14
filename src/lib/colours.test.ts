import { describe, expect, it } from 'vitest'
import { PALETTE, readableTextOn } from './colours'

describe('colours', () => {
  it('picks readable text colours', () => {
    expect(readableTextOn('#F0C808')).toBe('#000000') // yellow → black text
    expect(readableTextOn('#0072B2')).toBe('#ffffff') // blue → white text
  })
  it('has unique palette colours', () => {
    expect(new Set(PALETTE.map((c) => c.hex)).size).toBe(PALETTE.length)
  })
})
