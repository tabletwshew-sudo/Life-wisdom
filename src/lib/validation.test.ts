import { describe, expect, it } from 'vitest'
import { cleanText, inviteCodeSchema, signUpSchema } from './validation'

describe('cleanText', () => {
  it('trims, strips control characters and caps length', () => {
    expect(cleanText('  hi\u0000there\u0007  ', 40)).toBe('hithere')
    expect(cleanText('a'.repeat(100), 10)).toHaveLength(10)
  })
  it('keeps emoji and accents', () => {
    expect(cleanText('Zoë 🦄', 40)).toBe('Zoë 🦄')
  })
})

describe('inviteCodeSchema', () => {
  it('normalises case, spaces and dashes', () => {
    expect(inviteCodeSchema.parse(' abcd-2345 ')).toBe('ABCD2345')
  })
  it('rejects confusable characters and wrong lengths', () => {
    expect(inviteCodeSchema.safeParse('ABCD0123').success).toBe(false) // 0 and 1 are never used
    expect(inviteCodeSchema.safeParse('ABC').success).toBe(false)
  })
})

describe('signUpSchema', () => {
  it('requires a name, valid email and 8+ character password', () => {
    expect(signUpSchema.safeParse({ displayName: ' ', email: 'x@y.com', password: '12345678' }).success).toBe(false)
    expect(signUpSchema.safeParse({ displayName: 'Sam', email: 'nope', password: '12345678' }).success).toBe(false)
    expect(signUpSchema.safeParse({ displayName: 'Sam', email: 'sam@x.com', password: 'short' }).success).toBe(false)
    expect(signUpSchema.parse({ displayName: ' Sam ', email: 'SAM@X.com ', password: '12345678' })).toEqual({
      displayName: 'Sam',
      email: 'sam@x.com',
      password: '12345678',
    })
  })
})
