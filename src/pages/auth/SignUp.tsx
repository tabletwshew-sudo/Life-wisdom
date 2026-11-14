import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { friendlyError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { fieldErrors, signUpSchema } from '@/lib/validation'
import { AuthLayout, FormError, getPendingInvite } from './AuthLayout'

export default function SignUp() {
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [checkEmail, setCheckEmail] = useState(false)
  const [busy, setBusy] = useState(false)
  const invite = getPendingInvite()

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setFormError(null)
    const parsed = signUpSchema.safeParse({ displayName, email, password })
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    setErrors({})
    setBusy(true)
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        data: { display_name: parsed.data.displayName },
        emailRedirectTo: `${window.location.origin}/welcome`,
      },
    })
    setBusy(false)
    if (error) return setFormError(friendlyError(error))
    // If "Confirm email" is switched on in Supabase there is no session yet.
    if (!data.session) return setCheckEmail(true)
    navigate('/welcome', { replace: true })
  }

  if (checkEmail) {
    return (
      <AuthLayout title="Check your email 📬" subtitle={`We sent a link to ${email}`}>
        <p className="text-ink-2">Tap the link in the email to finish creating your account, then come back here and sign in.</p>
        <Link to="/signin" className="mt-4 block text-center font-semibold text-brand-600">
          Back to sign in
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Create account" subtitle={invite ? 'Then you’ll join your family' : 'It’s free for the whole family'}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="Your first name" autoComplete="given-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} error={errors.displayName} maxLength={40} />
        <Field label="Email" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <Field
          label="Password"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint="At least 8 characters. Write it down somewhere safe."
        />
        <FormError message={formError} />
        <Button type="submit" loading={busy} full>
          Create account
        </Button>
        <p className="pt-1 text-center text-[15px] text-ink-3">
          Already have an account?{' '}
          <Link to="/signin" className="font-semibold text-brand-600 dark:text-brand-400">
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
