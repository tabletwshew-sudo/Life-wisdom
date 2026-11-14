/**
 * Family Hub end-to-end encryption, using only the browser's Web Crypto API.
 *
 *   Login password ──PBKDF2-SHA-256 (600k)──▶ key-encryption key
 *        │                                        │ unlocks
 *        ▼                                        ▼
 *   (never stored)                     your RSA-OAEP private key ──unwraps──▶ family AES-256-GCM key
 *                                                                               │
 *   Family recovery code ──PBKDF2──▶ unwraps a spare copy of the family key ─────┘
 *
 * Private text is stored as "enc:v1:<base64(iv | ciphertext)>". The server only
 * ever sees public keys, wrapped (encrypted) keys and ciphertext.
 */

export const PBKDF2_ITERATIONS = 600_000
export const ENC_PREFIX = 'enc:v1:'

const enc = new TextEncoder()
const dec = new TextDecoder()

export class WrongPasswordError extends Error {
  constructor(message = 'That password didn’t unlock the key') {
    super(message)
    this.name = 'WrongPasswordError'
  }
}

export function toB64(bytes: ArrayBuffer | Uint8Array): string {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let s = ''
  for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000))
  return btoa(s)
}

export function fromB64(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

const random = (n: number) => crypto.getRandomValues(new Uint8Array(n))

// ---------------------------------------------------------------------------
// Password → key-encryption key
// ---------------------------------------------------------------------------
export async function deriveKek(secret: string, salt: Uint8Array<ArrayBuffer>, iterations = PBKDF2_ITERATIONS): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(secret.normalize('NFKC')), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, base, { name: 'AES-GCM', length: 256 }, false, ['wrapKey', 'unwrapKey'])
}

// ---------------------------------------------------------------------------
// Personal key pair (RSA-OAEP 3072), private half locked by the password
// ---------------------------------------------------------------------------
export interface WrappedPrivateKey {
  wrapped_private_key: string
  salt: string
  iv: string
  iterations: number
}

const RSA = { name: 'RSA-OAEP', hash: 'SHA-256' } as const

export async function generateUserKeys(password: string, iterations = PBKDF2_ITERATIONS) {
  const pair = await crypto.subtle.generateKey({ ...RSA, modulusLength: 3072, publicExponent: new Uint8Array([1, 0, 1]) }, true, ['wrapKey', 'unwrapKey'])
  const publicKey = toB64(await crypto.subtle.exportKey('spki', pair.publicKey))
  const wrapped = await wrapPrivateKey(pair.privateKey, password, iterations)
  // Keep a non-extractable copy for day-to-day use on this device.
  const privateKey = await unlockPrivateKey(password, wrapped)
  return { publicKey, wrapped, privateKey }
}

export async function wrapPrivateKey(privateKey: CryptoKey, password: string, iterations = PBKDF2_ITERATIONS): Promise<WrappedPrivateKey> {
  const salt = random(16)
  const iv = random(12)
  const kek = await deriveKek(password, salt, iterations)
  const wrapped = await crypto.subtle.wrapKey('pkcs8', privateKey, kek, { name: 'AES-GCM', iv })
  return { wrapped_private_key: toB64(wrapped), salt: toB64(salt), iv: toB64(iv), iterations }
}

/** Unlock your private key with your password. Throws WrongPasswordError. */
export async function unlockPrivateKey(password: string, w: WrappedPrivateKey, extractable = false): Promise<CryptoKey> {
  const kek = await deriveKek(password, fromB64(w.salt), w.iterations)
  try {
    return await crypto.subtle.unwrapKey('pkcs8', fromB64(w.wrapped_private_key), kek, { name: 'AES-GCM', iv: fromB64(w.iv) }, RSA, extractable, ['unwrapKey'])
  } catch {
    throw new WrongPasswordError()
  }
}

/** New password → re-lock the same private key (needs the old password). */
export async function rewrapPrivateKey(oldPassword: string, newPassword: string, w: WrappedPrivateKey): Promise<WrappedPrivateKey> {
  const key = await unlockPrivateKey(oldPassword, w, true)
  return wrapPrivateKey(key, newPassword, w.iterations)
}

// ---------------------------------------------------------------------------
// Family key (AES-256-GCM), shared by wrapping it for each member
// ---------------------------------------------------------------------------
export function generateFamilyKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

export async function wrapFamilyKeyFor(familyKey: CryptoKey, publicKeySpki: string): Promise<string> {
  const pub = await crypto.subtle.importKey('spki', fromB64(publicKeySpki), RSA, false, ['wrapKey'])
  return toB64(await crypto.subtle.wrapKey('raw', familyKey, pub, RSA))
}

export async function unwrapFamilyKey(wrapped: string, privateKey: CryptoKey): Promise<CryptoKey> {
  // Extractable so an admin's device can share it with new members.
  return crypto.subtle.unwrapKey('raw', fromB64(wrapped), privateKey, RSA, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

// ---------------------------------------------------------------------------
// Family recovery code
// ---------------------------------------------------------------------------
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789' // 30 easy-to-read characters

/** 24 characters ≈ 118 bits, shown as XXXX-XXXX-XXXX-XXXX-XXXX-XXXX. */
export function generateRecoveryCode(): string {
  const chars: string[] = []
  while (chars.length < 24) {
    const b = random(1)[0]
    if (b < 240) chars.push(CODE_ALPHABET[b % 30]) // avoid modulo bias
  }
  return chars.join('').replace(/(.{4})(?!$)/g, '$1-')
}

export const normaliseRecoveryCode = (code: string) => code.toUpperCase().replace(/[^A-Z0-9]/g, '')

export interface WrappedWithCode {
  wrapped_key: string
  salt: string
  iv: string
  iterations: number
}

export async function wrapWithRecoveryCode(familyKey: CryptoKey, code: string, iterations = PBKDF2_ITERATIONS): Promise<WrappedWithCode> {
  const salt = random(16)
  const iv = random(12)
  const kek = await deriveKek(normaliseRecoveryCode(code), salt, iterations)
  const wrapped = await crypto.subtle.wrapKey('raw', familyKey, kek, { name: 'AES-GCM', iv })
  return { wrapped_key: toB64(wrapped), salt: toB64(salt), iv: toB64(iv), iterations }
}

export async function unwrapWithRecoveryCode(w: WrappedWithCode, code: string): Promise<CryptoKey> {
  const kek = await deriveKek(normaliseRecoveryCode(code), fromB64(w.salt), w.iterations)
  try {
    return await crypto.subtle.unwrapKey('raw', fromB64(w.wrapped_key), kek, { name: 'AES-GCM', iv: fromB64(w.iv) }, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
  } catch {
    throw new WrongPasswordError('That recovery code didn’t work')
  }
}

// ---------------------------------------------------------------------------
// Encrypting text fields
// ---------------------------------------------------------------------------
/** Which column a value belongs to — bound into the ciphertext so values can't be swapped between fields. */
export type SecretField = 'tasks.notes' | 'events.notes' | 'events.location' | 'recipes.notes'

export const isEncrypted = (v: string | null | undefined): v is string => !!v && v.startsWith(ENC_PREFIX)

export async function encryptText(familyKey: CryptoKey, plaintext: string, field: SecretField): Promise<string> {
  if (!plaintext) return ''
  const iv = random(12)
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: enc.encode(field) }, familyKey, enc.encode(plaintext))
  const out = new Uint8Array(12 + ct.byteLength)
  out.set(iv)
  out.set(new Uint8Array(ct), 12)
  return ENC_PREFIX + toB64(out)
}

export async function decryptText(familyKey: CryptoKey, value: string, field: SecretField): Promise<string> {
  if (!isEncrypted(value)) return value
  const raw = fromB64(value.slice(ENC_PREFIX.length))
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.subarray(0, 12), additionalData: enc.encode(field) }, familyKey, raw.subarray(12))
  return dec.decode(pt)
}
