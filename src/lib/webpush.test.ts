// @vitest-environment node
import { createECDH, randomBytes } from 'node:crypto'
// The reference implementation of RFC 8188/8291, used here to decrypt like a browser would.
import ece from 'http_ece'
import { describe, expect, it } from 'vitest'
import { b64urlDecode, b64urlEncode, encryptPayload, generateVapidKeys, vapidAuthHeader } from '../../supabase/functions/send-reminders/webpush'

function fakeBrowserSubscription() {
  const ecdh = createECDH('prime256v1')
  ecdh.generateKeys()
  const auth = randomBytes(16)
  return { ecdh, auth, p256dh: b64urlEncode(ecdh.getPublicKey()), authB64: b64urlEncode(auth) }
}

describe('Web Push encryption (RFC 8291)', () => {
  it('a browser can decrypt what we send', async () => {
    const sub = fakeBrowserSubscription()
    const message = JSON.stringify({ title: '⏰ 🛏️ Make the bed', body: 'Due today at 8am', url: '/tasks' })
    const body = await encryptPayload({ p256dh: sub.p256dh, auth: sub.authB64 }, new TextEncoder().encode(message))
    const plain = ece.decrypt(Buffer.from(body), { version: 'aes128gcm', privateKey: sub.ecdh, authSecret: sub.authB64 })
    expect(plain.toString('utf8')).toBe(message)
  })

  it('uses a fresh key and salt every time', async () => {
    const sub = fakeBrowserSubscription()
    const a = await encryptPayload({ p256dh: sub.p256dh, auth: sub.authB64 }, new Uint8Array([1, 2, 3]))
    const b = await encryptPayload({ p256dh: sub.p256dh, auth: sub.authB64 }, new Uint8Array([1, 2, 3]))
    expect(b64urlEncode(a)).not.toBe(b64urlEncode(b))
  })

  it('rejects a bad subscription key', async () => {
    await expect(encryptPayload({ p256dh: 'AAAA', auth: b64urlEncode(randomBytes(16)) }, new Uint8Array(1))).rejects.toThrow()
  })
})

describe('VAPID (RFC 8292)', () => {
  it('signs a JWT for the push service that verifies with our public key', async () => {
    const keys = await generateVapidKeys()
    expect(b64urlDecode(keys.publicKey)).toHaveLength(65)
    expect(b64urlDecode(keys.privateKey)).toHaveLength(32)
    const header = await vapidAuthHeader('https://web.push.apple.com/abc123', { ...keys, subject: 'https://family.example' }, 1_800_000_000)
    const m = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header)!
    expect(m[4]).toBe(keys.publicKey)
    const claims = JSON.parse(Buffer.from(b64urlDecode(m[2])).toString())
    expect(claims).toEqual({ aud: 'https://web.push.apple.com', exp: 1_800_000_000 + 12 * 3600, sub: 'https://family.example' })
    const pub = await crypto.subtle.importKey('raw', b64urlDecode(keys.publicKey) as BufferSource, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify'])
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pub, b64urlDecode(m[3]) as BufferSource, new TextEncoder().encode(`${m[1]}.${m[2]}`))
    expect(ok).toBe(true)
  })
})
