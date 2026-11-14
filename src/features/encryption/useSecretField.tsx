import { Lock, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { isEncrypted, type SecretField } from '@/lib/crypto/e2ee'
import { useEncryption } from './EncryptionProvider'

/**
 * For a form field that may hold encrypted text:
 *  - when the form opens, decrypts the saved value into the field,
 *  - `seal()` encrypts what's typed before saving,
 *  - `locked` → this device can't read it yet; the saved value is kept as-is.
 */
export function useSecretField(open: boolean, field: SecretField, saved: string | undefined, setPlain: (v: string) => void) {
  const { decrypt, encrypt, enabled } = useEncryption()
  const [locked, setLocked] = useState(false)

  useEffect(() => {
    if (!open) return
    setLocked(false)
    if (!isEncrypted(saved)) return
    setPlain('')
    let alive = true
    decrypt(field, saved).then((t) => {
      if (!alive) return
      if (t === null) setLocked(true)
      else setPlain(t)
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, saved, field])

  const seal = async (plain: string) => (locked ? (saved ?? '') : encrypt(field, plain))
  return { locked, seal, encrypted: enabled }
}

/** Small note under a private field. */
export function SecretHint({ locked, encrypted }: { locked: boolean; encrypted: boolean }) {
  if (locked)
    return (
      <span className="flex items-center gap-1 text-sm text-ink-3">
        <Lock className="size-4" aria-hidden /> Encrypted. Unlock on this device to read or change it (More → Encryption).
      </span>
    )
  if (encrypted)
    return (
      <span className="flex items-center gap-1 text-sm text-done">
        <ShieldCheck className="size-4" aria-hidden /> End-to-end encrypted
      </span>
    )
  return null
}
