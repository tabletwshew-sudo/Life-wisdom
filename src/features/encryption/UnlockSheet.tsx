import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { WrongPasswordError } from '@/lib/crypto/e2ee'
import { friendlyError } from '@/lib/errors'
import { useEncryption } from './EncryptionProvider'

export function UnlockSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { unlock, busy } = useEncryption()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      await unlock(password)
      setPassword('')
      toast('Unlocked on this device')
      onClose()
    } catch (err) {
      setError(err instanceof WrongPasswordError ? 'That’s not your current Family Hub password.' : friendlyError(err))
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Unlock private notes">
      <form onSubmit={submit} className="flex flex-col gap-4 pb-2" noValidate>
        <p className="text-ink-2">Your family’s notes and locations are end-to-end encrypted. Enter your Family Hub password once to read them on this device.</p>
        <Field label="Your password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={error} data-autofocus />
        <Button type="submit" loading={busy} disabled={!password}>
          Unlock
        </Button>
      </form>
    </Sheet>
  )
}
