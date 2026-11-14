import { useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { useFamily } from '@/family/FamilyProvider'
import {
  decryptText,
  encryptText,
  generateFamilyKey,
  generateRecoveryCode,
  generateUserKeys,
  isEncrypted,
  rewrapPrivateKey,
  unwrapFamilyKey,
  unwrapWithRecoveryCode,
  wrapFamilyKeyFor,
  wrapWithRecoveryCode,
  type SecretField,
  type WrappedPrivateKey,
} from '@/lib/crypto/e2ee'
import { deleteKey, familyKeyName, getKey, privateKeyName, putKey } from '@/lib/crypto/keystore'
import { supabase } from '@/lib/supabase'
import { KEYS_CHANGED, prepareKeys } from './keys'

/**
 * off          – the family hasn't turned encryption on
 * needs-unlock – on, but this device needs your password once
 * waiting      – unlocked, but an admin hasn't shared the family key with you yet
 * ready        – everything decrypts
 * checking     – working it out
 */
export type EncryptionStatus = 'off' | 'checking' | 'needs-unlock' | 'waiting' | 'ready'

interface EncryptionState {
  enabled: boolean
  status: EncryptionStatus
  busy: boolean
  /** Encrypt a value for saving (returns it unchanged if encryption is off). */
  encrypt: (field: SecretField, text: string) => Promise<string>
  /** Decrypt a value for showing. null = can't decrypt on this device yet. */
  decrypt: (field: SecretField, value: string) => Promise<string | null>
  unlock: (password: string) => Promise<void>
  /** Admin: turn encryption on. Returns the recovery code to show ONCE. */
  enable: (password: string, onProgress?: (msg: string) => void) => Promise<string>
  /** Admin: decrypt everything and turn encryption off. */
  disable: (onProgress?: (msg: string) => void) => Promise<void>
  /** Admin: share the family key with members who are waiting. Returns how many. */
  shareWithWaiting: () => Promise<number>
  /** Admin: get the key back using the family recovery code. */
  recover: (code: string) => Promise<void>
  /** Admin: replace the recovery code. Returns the new one. */
  newRecoveryCode: () => Promise<string>
  /** Forgot your password? New keys; an admin re-shares the family key. */
  resetMyKeys: (newPassword: string) => Promise<void>
  /** Call when you change your password (keeps access). */
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>
}

const Ctx = createContext<EncryptionState | null>(null)

async function verifyPassword(email: string, password: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw new Error('That isn’t your current password')
}

export function EncryptionProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { family, isAdmin, members } = useFamily()
  const qc = useQueryClient()
  const enabled = !!family?.encryption_enabled
  const [privateKey, setPrivateKey] = useState<CryptoKey | null>(null)
  const [familyKey, setFamilyKey] = useState<CryptoKey | null>(null)
  const [status, setStatus] = useState<EncryptionStatus>('checking')
  const [busy, setBusy] = useState(false)
  const cache = useRef(new Map<string, string>())
  const uid = user?.id ?? ''
  const fid = family?.id ?? ''

  // --- personal keys ---------------------------------------------------------
  const loadPrivateRecord = useCallback(async () => {
    const { data } = await supabase.from('user_private_keys').select('wrapped_private_key, salt, iv, iterations').eq('user_id', uid).maybeSingle()
    return data as WrappedPrivateKey | null
  }, [uid])

  /** Create (first time) or unlock this person's keys with their password. */
  const setupWithPassword = useCallback(
    async (password: string) => {
      const key = await prepareKeys(uid, password)
      setPrivateKey(key)
      return key
    },
    [uid],
  )

  // On load (and whenever sign-in prepares keys): get the private key from this device.
  useEffect(() => {
    if (!uid) return
    let cancelled = false
    const load = () => getKey(privateKeyName(uid)).then((key) => !cancelled && setPrivateKey(key))
    load()
    window.addEventListener(KEYS_CHANGED, load)
    return () => {
      cancelled = true
      window.removeEventListener(KEYS_CHANGED, load)
    }
  }, [uid])

  // --- family key ------------------------------------------------------------
  const loadFamilyKey = useCallback(async () => {
    if (!fid || !uid) return null
    const stored = await getKey(familyKeyName(fid, uid))
    if (stored) return stored
    if (!privateKey) return null
    const { data } = await supabase.from('family_keys').select('wrapped_key').eq('family_id', fid).eq('user_id', uid).maybeSingle()
    if (!data) return null
    const key = await unwrapFamilyKey(data.wrapped_key, privateKey).catch(() => null)
    if (key) await putKey(familyKeyName(fid, uid), key)
    return key
  }, [fid, uid, privateKey])

  useEffect(() => {
    if (!family || !uid) return
    let cancelled = false
    ;(async () => {
      if (!enabled) {
        setFamilyKey(null)
        setStatus('off')
        return
      }
      const key = await loadFamilyKey()
      if (cancelled) return
      setFamilyKey(key)
      setStatus(key ? 'ready' : privateKey ? 'waiting' : 'needs-unlock')
    })()
    return () => {
      cancelled = true
    }
  }, [family, uid, enabled, privateKey, loadFamilyKey])

  // Live: when an admin shares the key with me, pick it up straight away.
  useEffect(() => {
    if (!fid || !uid) return
    const ch = supabase
      .channel(`family-keys:${fid}:${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'family_keys', filter: `user_id=eq.${uid}` }, async () => {
        const key = await loadFamilyKey()
        if (key) {
          setFamilyKey(key)
          setStatus('ready')
          cache.current.clear()
          qc.invalidateQueries()
        }
      })
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [fid, uid, loadFamilyKey, qc])

  // --- admin: share with waiting members --------------------------------------
  const shareWithWaiting = useCallback(async () => {
    if (!familyKey || !isAdmin || !fid) return 0
    const [{ data: have }, { data: pubs }] = await Promise.all([
      supabase.from('family_keys').select('user_id').eq('family_id', fid),
      supabase.from('user_public_keys').select('user_id, public_key').in('user_id', members.map((m) => m.userId)),
    ])
    const haveSet = new Set((have ?? []).map((r) => r.user_id))
    let shared = 0
    for (const p of pubs ?? []) {
      if (haveSet.has(p.user_id)) continue
      const wrapped = await wrapFamilyKeyFor(familyKey, p.public_key)
      const { error } = await supabase.from('family_keys').insert({ family_id: fid, user_id: p.user_id, wrapped_key: wrapped, wrapped_by: uid })
      if (!error) shared++
    }
    if (shared) qc.invalidateQueries({ queryKey: ['encryption-members'] })
    return shared
  }, [familyKey, isAdmin, fid, uid, members, qc])

  // Admins' devices share automatically (new members, people who reset their password).
  useEffect(() => {
    if (status !== 'ready' || !isAdmin) return
    shareWithWaiting().catch(() => {})
    const ch = supabase
      .channel(`public-keys:${fid}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_public_keys' }, () => shareWithWaiting().catch(() => {}))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'family_keys' }, () => shareWithWaiting().catch(() => {}))
      .subscribe()
    return () => {
      supabase.removeChannel(ch)
    }
  }, [status, isAdmin, fid, shareWithWaiting, members.length])

  // --- encrypt / decrypt ------------------------------------------------------
  const encrypt = useCallback(
    async (field: SecretField, text: string) => {
      if (!enabled || !text) return text
      if (!familyKey) throw new Error('Private notes are locked on this device. Unlock them first (More → Encryption).')
      return encryptText(familyKey, text, field)
    },
    [enabled, familyKey],
  )

  const decrypt = useCallback(
    async (field: SecretField, value: string) => {
      if (!isEncrypted(value)) return value
      const hit = cache.current.get(value)
      if (hit !== undefined) return hit
      if (!familyKey) return null
      try {
        const plain = await decryptText(familyKey, value, field)
        cache.current.set(value, plain)
        return plain
      } catch {
        return null
      }
    },
    [familyKey],
  )

  // --- rewrite every secret field of the family -------------------------------
  const rewriteAll = useCallback(
    async (transform: (field: SecretField, value: string) => Promise<string>, onProgress?: (m: string) => void) => {
      const run = async (label: string, field: SecretField, rows: { id: string; v: string }[], save: (id: string, v: string) => PromiseLike<{ error: unknown }>) => {
        onProgress?.(label)
        for (const r of rows) {
          const next = await transform(field, r.v)
          if (next !== r.v) {
            const { error } = await save(r.id, next)
            if (error) throw error
          }
        }
      }
      const tasks = await supabase.from('tasks').select('id, notes').eq('family_id', fid).neq('notes', '')
      if (tasks.error) throw tasks.error
      await run('Chore notes…', 'tasks.notes', tasks.data.map((r) => ({ id: r.id, v: r.notes })), (id, v) => supabase.from('tasks').update({ notes: v }).eq('id', id))
      const events = await supabase.from('events').select('id, notes, location').eq('family_id', fid)
      if (events.error) throw events.error
      await run('Event notes…', 'events.notes', events.data.filter((r) => r.notes).map((r) => ({ id: r.id, v: r.notes })), (id, v) => supabase.from('events').update({ notes: v }).eq('id', id))
      await run('Event locations…', 'events.location', events.data.filter((r) => r.location).map((r) => ({ id: r.id, v: r.location })), (id, v) =>
        supabase.from('events').update({ location: v }).eq('id', id),
      )
      const recipes = await supabase.from('recipes').select('id, notes').eq('family_id', fid).neq('notes', '')
      if (recipes.error) throw recipes.error
      await run('Recipe notes…', 'recipes.notes', recipes.data.map((r) => ({ id: r.id, v: r.notes })), (id, v) => supabase.from('recipes').update({ notes: v }).eq('id', id))
    },
    [fid],
  )

  // --- admin actions -------------------------------------------------------------
  const enable = useCallback(
    async (password: string, onProgress?: (m: string) => void) => {
      if (!isAdmin || !family || !user?.email) throw new Error('Only admins can turn on encryption')
      setBusy(true)
      try {
        onProgress?.('Checking your password…')
        await verifyPassword(user.email, password)
        onProgress?.('Preparing your personal key…')
        if (!privateKey) await setupWithPassword(password)
        onProgress?.('Creating the family key…')
        const fk = await generateFamilyKey()
        const { data: me } = await supabase.from('user_public_keys').select('public_key').eq('user_id', uid).single()
        await supabase.from('family_keys').delete().eq('family_id', fid)
        const { error: e1 } = await supabase.from('family_keys').insert({ family_id: fid, user_id: uid, wrapped_key: await wrapFamilyKeyFor(fk, me!.public_key), wrapped_by: uid })
        if (e1) throw e1
        onProgress?.('Making your recovery code…')
        const code = generateRecoveryCode()
        const { error: e2 } = await supabase.from('family_recovery').upsert({ family_id: fid, created_by: uid, ...(await wrapWithRecoveryCode(fk, code)) })
        if (e2) throw e2
        onProgress?.('Encrypting existing notes…')
        await rewriteAll((field, v) => (isEncrypted(v) ? Promise.resolve(v) : encryptText(fk, v, field)), onProgress)
        const { error: e3 } = await supabase.from('families').update({ encryption_enabled: true }).eq('id', fid)
        if (e3) throw e3
        await putKey(familyKeyName(fid, uid), fk)
        setFamilyKey(fk)
        setStatus('ready')
        onProgress?.('Sharing with your family…')
        await qc.invalidateQueries()
        return code
      } finally {
        setBusy(false)
      }
    },
    [isAdmin, family, user, privateKey, setupWithPassword, uid, fid, rewriteAll, qc],
  )

  const disable = useCallback(
    async (onProgress?: (m: string) => void) => {
      if (!isAdmin || !familyKey) throw new Error('Unlock encryption on this device first')
      setBusy(true)
      try {
        await rewriteAll((field, v) => decryptText(familyKey, v, field), onProgress)
        const { error } = await supabase.from('families').update({ encryption_enabled: false }).eq('id', fid)
        if (error) throw error
        await supabase.from('family_keys').delete().eq('family_id', fid)
        await supabase.from('family_recovery').delete().eq('family_id', fid)
        await deleteKey(familyKeyName(fid, uid))
        setFamilyKey(null)
        setStatus('off')
        cache.current.clear()
        await qc.invalidateQueries()
      } finally {
        setBusy(false)
      }
    },
    [isAdmin, familyKey, rewriteAll, fid, uid, qc],
  )

  const unlock = useCallback(
    async (password: string) => {
      setBusy(true)
      try {
        await setupWithPassword(password)
      } finally {
        setBusy(false)
      }
    },
    [setupWithPassword],
  )

  const recover = useCallback(
    async (code: string) => {
      if (!isAdmin) throw new Error('Only admins can use the recovery code')
      if (!privateKey) throw new Error('Unlock with your password first')
      const { data } = await supabase.from('family_recovery').select('wrapped_key, salt, iv, iterations').eq('family_id', fid).maybeSingle()
      if (!data) throw new Error('No recovery code was saved for this family')
      const fk = await unwrapWithRecoveryCode(data, code)
      const { data: me } = await supabase.from('user_public_keys').select('public_key').eq('user_id', uid).single()
      await supabase.from('family_keys').delete().eq('family_id', fid).eq('user_id', uid)
      const { error } = await supabase.from('family_keys').insert({ family_id: fid, user_id: uid, wrapped_key: await wrapFamilyKeyFor(fk, me!.public_key), wrapped_by: uid })
      if (error) throw error
      await putKey(familyKeyName(fid, uid), fk)
      setFamilyKey(fk)
      setStatus('ready')
      cache.current.clear()
      await qc.invalidateQueries()
    },
    [isAdmin, privateKey, fid, uid, qc],
  )

  const newRecoveryCode = useCallback(async () => {
    if (!isAdmin || !familyKey) throw new Error('Unlock encryption on this device first')
    const code = generateRecoveryCode()
    const { error } = await supabase.from('family_recovery').upsert({ family_id: fid, created_by: uid, ...(await wrapWithRecoveryCode(familyKey, code)) })
    if (error) throw error
    return code
  }, [isAdmin, familyKey, fid, uid])

  const resetMyKeys = useCallback(
    async (newPassword: string) => {
      setBusy(true)
      try {
        const k = await generateUserKeys(newPassword)
        const e1 = await supabase.from('user_private_keys').upsert({ user_id: uid, ...k.wrapped })
        if (e1.error) throw e1.error
        // Remove my old copies of family keys (they were for the old key pair).
        await supabase.from('family_keys').delete().eq('user_id', uid)
        const e2 = await supabase.from('user_public_keys').upsert({ user_id: uid, public_key: k.publicKey })
        if (e2.error) throw e2.error
        await putKey(privateKeyName(uid), k.privateKey)
        if (fid) await deleteKey(familyKeyName(fid, uid))
        setPrivateKey(k.privateKey)
        setFamilyKey(null)
        cache.current.clear()
      } finally {
        setBusy(false)
      }
    },
    [uid, fid],
  )

  const changePassword = useCallback(
    async (oldPassword: string, newPassword: string) => {
      const record = await loadPrivateRecord()
      if (!record) return
      const next = await rewrapPrivateKey(oldPassword, newPassword, record)
      const { error } = await supabase.from('user_private_keys').upsert({ user_id: uid, ...next })
      if (error) throw error
    },
    [loadPrivateRecord, uid],
  )

  const value = useMemo<EncryptionState>(
    () => ({ enabled, status, busy, encrypt, decrypt, unlock, enable, disable, shareWithWaiting, recover, newRecoveryCode, resetMyKeys, changePassword }),
    [enabled, status, busy, encrypt, decrypt, unlock, enable, disable, shareWithWaiting, recover, newRecoveryCode, resetMyKeys, changePassword],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useEncryption(): EncryptionState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useEncryption must be used inside <EncryptionProvider>')
  return ctx
}

/** Decrypt a value for display. Returns { text, locked }. */
export function useSecret(field: SecretField, value: string | null | undefined) {
  const { decrypt } = useEncryption()
  const [state, setState] = useState<{ text: string; locked: boolean }>(() =>
    isEncrypted(value) ? { text: '', locked: true } : { text: value ?? '', locked: false },
  )
  useEffect(() => {
    let alive = true
    if (!isEncrypted(value)) {
      setState({ text: value ?? '', locked: false })
      return
    }
    decrypt(field, value).then((t) => alive && setState(t === null ? { text: '', locked: true } : { text: t, locked: false }))
    return () => {
      alive = false
    }
  }, [field, value, decrypt])
  return state
}
