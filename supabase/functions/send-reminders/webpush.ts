/**
 * Minimal, dependency-free Web Push sender using only the Web Crypto API.
 * Works in Supabase Edge Functions (Deno), browsers and Node 20+.
 *
 *   - Payload encryption: RFC 8291 (Message Encryption for Web Push, "aes128gcm")
 *   - Authentication:     RFC 8292 (VAPID, ES256-signed JWT)
 */

export interface PushSubscriptionKeys {
  endpoint: string
  p256dh: string // base64url, 65-byte uncompressed P-256 public key
  auth: string // base64url, 16 bytes
}

export interface VapidKeys {
  publicKey: string // base64url, 65-byte uncompressed P-256 public key
  privateKey: string // base64url, 32-byte private scalar "d"
  subject: string // "mailto:you@example.com" or "https://your-site"
}

const enc = new TextEncoder()

export function b64urlEncode(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function b64urlDecode(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

function concat(...parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let o = 0
  for (const p of parts) {
    out.set(p, o)
    o += p.length
  }
  return out
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: info as BufferSource }, key, length * 8)
  return new Uint8Array(bits)
}

/** Encrypt a payload for one subscription (RFC 8291). Returns the HTTP body. */
export async function encryptPayload(sub: Pick<PushSubscriptionKeys, 'p256dh' | 'auth'>, plaintext: Uint8Array, salt?: Uint8Array): Promise<Uint8Array> {
  const uaPublic = b64urlDecode(sub.p256dh)
  const authSecret = b64urlDecode(sub.auth)
  if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error('Invalid p256dh key')
  if (authSecret.length < 16) throw new Error('Invalid auth secret')

  // 1. Ephemeral sender key pair + ECDH shared secret
  const as = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', as.publicKey))
  const uaKey = await crypto.subtle.importKey('raw', uaPublic as BufferSource, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, as.privateKey, 256))

  // 2. Key derivation
  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic)
  const ikm = await hkdf(authSecret, ecdhSecret, keyInfo, 32)
  const s = salt ?? crypto.getRandomValues(new Uint8Array(16))
  const cek = await hkdf(s, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(s, ikm, enc.encode('Content-Encoding: nonce\0'), 12)

  // 3. Encrypt a single record: plaintext + 0x02 delimiter
  const padded = concat(plaintext, new Uint8Array([2]))
  const aesKey = await crypto.subtle.importKey('raw', cek as BufferSource, 'AES-GCM', false, ['encrypt'])
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce as BufferSource }, aesKey, padded as BufferSource))

  // 4. Header: salt | record size | key id length | key id (sender public key)
  const header = new Uint8Array(16 + 4 + 1 + 65)
  header.set(s, 0)
  new DataView(header.buffer).setUint32(16, 4096)
  header[20] = 65
  header.set(asPublic, 21)
  return concat(header, ciphertext)
}

/** VAPID Authorization header value for an endpoint (RFC 8292). */
export async function vapidAuthHeader(endpoint: string, vapid: VapidKeys, nowSeconds = Math.floor(Date.now() / 1000)): Promise<string> {
  const pub = b64urlDecode(vapid.publicKey)
  if (pub.length !== 65) throw new Error('Invalid VAPID public key')
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: b64urlEncode(pub.slice(1, 33)),
    y: b64urlEncode(pub.slice(33, 65)),
    d: vapid.privateKey,
    ext: true,
  }
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const header = b64urlEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = b64urlEncode(
    enc.encode(JSON.stringify({ aud: new URL(endpoint).origin, exp: nowSeconds + 12 * 3600, sub: vapid.subject })),
  )
  const unsigned = `${header}.${claims}`
  const sig = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, enc.encode(unsigned) as BufferSource))
  return `vapid t=${unsigned}.${b64urlEncode(sig)}, k=${vapid.publicKey}`
}

export interface SendResult {
  ok: boolean
  status: number
  /** true → the subscription is dead (uninstalled / permission revoked); delete it */
  gone: boolean
}

/** Send one push message. `payload` is JSON-serialised. */
export async function sendPush(sub: PushSubscriptionKeys, payload: unknown, vapid: VapidKeys, opts: { ttl?: number; urgency?: 'normal' | 'high' } = {}): Promise<SendResult> {
  const body = await encryptPayload(sub, enc.encode(JSON.stringify(payload)))
  const res = await fetch(sub.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuthHeader(sub.endpoint, vapid),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(opts.ttl ?? 24 * 3600),
      Urgency: opts.urgency ?? 'normal',
    },
    body: body as BodyInit,
  })
  await res.body?.cancel()
  return { ok: res.ok, status: res.status, gone: res.status === 404 || res.status === 410 }
}

/** Create a new VAPID key pair (used once, during setup). */
export async function generateVapidKeys(): Promise<{ publicKey: string; privateKey: string }> {
  const kp = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  const raw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey))
  const jwk = await crypto.subtle.exportKey('jwk', kp.privateKey)
  return { publicKey: b64urlEncode(raw), privateKey: jwk.d! }
}
