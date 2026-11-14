import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { friendlyError } from '@/lib/errors'
import { prepareKeys } from '@/features/encryption/keys'
import { supabase } from '@/lib/supabase'
import { fieldErrors, signInSchema } from '@/lib/validation'
import { AuthLayout, FormError, getPendingInvite } from './AuthLayout'

export default function SignIn() {
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const invite = getPendingInvite()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const parsed = signInSchema.safeParse({ email, password })
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    setErrors({})
    setBusy(true)
    const { data, error } = await supabase.auth.signInWithPassword(parsed.data)
    if (error) {
      setBusy(false)
      return setFormError(friendlyError(error))
    }
    // Unlock (or create) this person's encryption key on this device. The
    // password is used here once and never stored.
    await prepareKeys(data.user.id, parsed.data.password).catch((e) => console.warn('Could not prepare encryption keys:', e))
    setBusy(false)
    const next = (location.state as { from?: string } | null)?.from
    navigate(next && next.startsWith('/') ? next : '/', { replace: true })
  }

  return (
    <AuthLayout title="Welcome back" subtitle={invite ? 'Sign in to join your family' : 'Sign in to Family Hub'}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="Email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
        />
        <FormError message={formError} />
        <Button type="submit" loading={busy} full>
          Sign in
        </Button>
        <div className="flex flex-col items-center gap-3 pt-1 text-[15px]">
          <Link to="/forgot-password" className="font-semibold text-brand-600 dark:text-brand-400">
            Forgot password?
          </Link>
          <p className="text-ink-3">
            New here?{' '}
            <Link to="/signup" className="font-semibold text-brand-600 dark:text-brand-400">
              Create an account
            </Link>
          </p>
        </div>
      </form>
    </AuthLayout>
  )
}
