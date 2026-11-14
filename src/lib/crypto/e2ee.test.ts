// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  decryptText,
  encryptText,
  generateFamilyKey,
  generateRecoveryCode,
  generateUserKeys,
  isEncrypted,
  normaliseRecoveryCode,
  rewrapPrivateKey,
  unlockPrivateKey,
  unwrapFamilyKey,
  unwrapWithRecoveryCode,
  wrapFamilyKeyFor,
  wrapWithRecoveryCode,
  WrongPasswordError,
} from './e2ee'

// Fewer PBKDF2 rounds keep the tests fast; the app uses 600,000.
const FAST = 100_000

describe('encrypting text', () => {
  it('round-trips, including emoji and long text', async () => {
    const key = await generateFamilyKey()
    const text = 'Take the 🐶 to the vet — Dr. Jones, 12 High St.\n' + 'x'.repeat(2000)
    const c = await encryptText(key, text, 'tasks.notes')
    expect(isEncrypted(c)).toBe(true)
    expect(c).not.toContain('vet')
    expect(c).toMatch(/^enc:v1:[A-Za-z0-9+/]+={0,2}$/)
    expect(await decryptText(key, c, 'tasks.notes')).toBe(text)
  })

  it('uses a fresh IV every time (same text → different ciphertext)', async () => {
    const key = await generateFamilyKey()
    expect(await encryptText(key, 'same', 'events.notes')).not.toBe(await encryptText(key, 'same', 'events.notes'))
  })

  it('cannot be decrypted with another family’s key', async () => {
    const c = await encryptText(await generateFamilyKey(), 'secret', 'recipes.notes')
    await expect(decryptText(await generateFamilyKey(), c, 'recipes.notes')).rejects.toThrow()
  })

  it('cannot be moved into a different field (bound with associated data)', async () => {
    const key = await generateFamilyKey()
    const c = await encryptText(key, '12 Hidden Lane', 'events.location')
    await expect(decryptText(key, c, 'events.notes')).rejects.toThrow()
  })

  it('detects tampering', async () => {
    const key = await generateFamilyKey()
    const c = await encryptText(key, 'hello', 'tasks.notes')
    const flipped = c.slice(0, -4) + (c.slice(-4, -3) === 'A' ? 'B' : 'A') + c.slice(-3)
    await expect(decryptText(key, flipped, 'tasks.notes')).rejects.toThrow()
  })

  it('leaves plain (old, unencrypted) text alone', async () => {
    expect(await decryptText(await generateFamilyKey(), 'just a note', 'tasks.notes')).toBe('just a note')
  })
})

describe('password-locked personal keys', () => {
  it('unlocks with the right password, not the wrong one', async () => {
    const { wrapped } = await generateUserKeys('correct horse battery', FAST)
    await expect(unlockPrivateKey('correct horse battery', wrapped)).resolves.toBeTruthy()
    await expect(unlockPrivateKey('wrong password', wrapped)).rejects.toBeInstanceOf(WrongPasswordError)
  })

  it('the private key is never stored readable', async () => {
    const { wrapped, publicKey } = await generateUserKeys('pw-123456', FAST)
    expect(wrapped.wrapped_private_key).not.toContain('MII') // a raw PKCS#8 key starts "MII…" in base64
    expect(publicKey.startsWith('MII')).toBe(true) // the public key is fine to share
  })

  it('changing the password re-locks the same key', async () => {
    const { wrapped, publicKey } = await generateUserKeys('old-password', FAST)
    const familyKey = await generateFamilyKey()
    const forMe = await wrapFamilyKeyFor(familyKey, publicKey)
    const rewrapped = await rewrapPrivateKey('old-password', 'new-password', wrapped)
    await expect(unlockPrivateKey('old-password', rewrapped)).rejects.toBeInstanceOf(WrongPasswordError)
    const priv = await unlockPrivateKey('new-password', rewrapped)
    const fk = await unwrapFamilyKey(forMe, priv)
    const c = await encryptText(familyKey, 'still works', 'tasks.notes')
    expect(await decryptText(fk, c, 'tasks.notes')).toBe('still works')
  })
})

describe('sharing the family key', () => {
  it('an admin wraps it for a member; only that member can unwrap it', async () => {
    const familyKey = await generateFamilyKey()
    const kid = await generateUserKeys('kid-password', FAST)
    const stranger = await generateUserKeys('stranger-pw', FAST)
    const forKid = await wrapFamilyKeyFor(familyKey, kid.publicKey)
    const kidKey = await unwrapFamilyKey(forKid, kid.privateKey)
    const c = await encryptText(familyKey, 'Sleepover at Ava’s', 'events.notes')
    expect(await decryptText(kidKey, c, 'events.notes')).toBe('Sleepover at Ava’s')
    await expect(unwrapFamilyKey(forKid, stranger.privateKey)).rejects.toThrow()
  })
})

describe('family recovery code', () => {
  it('looks like XXXX-XXXX-XXXX-XXXX-XXXX-XXXX with no confusable characters', () => {
    const code = generateRecoveryCode()
    expect(code).toMatch(/^([A-HJKMNP-TV-Z2-9]{4}-){5}[A-HJKMNP-TV-Z2-9]{4}$/)
    expect(new Set(Array.from({ length: 20 }, generateRecoveryCode)).size).toBe(20)
  })

  it('recovers the family key (spaces, dashes and case don’t matter); a wrong code fails', async () => {
    const familyKey = await generateFamilyKey()
    const code = generateRecoveryCode()
    const w = await wrapWithRecoveryCode(familyKey, code, FAST)
    const typed = ' ' + code.toLowerCase().replace(/-/g, ' ') + ' '
    expect(normaliseRecoveryCode(typed)).toBe(normaliseRecoveryCode(code))
    const recovered = await unwrapWithRecoveryCode(w, typed)
    const c = await encryptText(familyKey, 'recovered!', 'tasks.notes')
    expect(await decryptText(recovered, c, 'tasks.notes')).toBe('recovered!')
    await expect(unwrapWithRecoveryCode(w, generateRecoveryCode())).rejects.toBeInstanceOf(WrongPasswordError)
  })
})
