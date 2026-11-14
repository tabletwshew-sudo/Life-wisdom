import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { useEncryption } from '@/features/encryption/EncryptionProvider'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { friendlyError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { passwordSchema } from '@/lib/validation'
import { AuthLayout, FormError } from './AuthLayout'

export default function ResetPassword() {
  const { session, clearRecovering } = useAuth()
  const { resetMyKeys } = useEncryption()
  const navigate = useNavigate()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = passwordSchema.safeParse(password)
    if (!parsed.success) return setError(parsed.error.issues[0].message)
    setBusy(true)
    const { error: err } = await supabase.auth.updateUser({ password: parsed.data })
    if (err) {
      setBusy(false)
      return setError(friendlyError(err))
    }
    // The old password locked this person's encryption key, so make a fresh one.
    // An admin's device shares the family key again automatically.
    const { count } = await supabase.from('user_private_keys').select('user_id', { count: 'exact', head: true })
    if (count) await resetMyKeys(parsed.data).catch(() => {})
    setBusy(false)
    clearRecovering()
    toast(count ? 'Password updated. Private notes unlock again once an admin’s app is opened.' : 'Password updated')
    navigate('/', { replace: true })
  }

  if (!session) {
    return (
      <AuthLayout title="Link expired" subtitle="Reset links only work once and for a short time">
        <Button full onClick={() => navigate('/forgot-password')}>
          Send a new link
        </Button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="New password">
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        <FormError message={error} />
        <Button type="submit" loading={busy} full>
          Save password
        </Button>
      </form>
    </AuthLayout>
  )
}
