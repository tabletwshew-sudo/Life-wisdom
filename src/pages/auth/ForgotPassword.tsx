import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { friendlyError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { emailSchema } from '@/lib/validation'
import { AuthLayout, FormError } from './AuthLayout'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    const parsed = emailSchema.safeParse(email)
    if (!parsed.success) return setError(parsed.error.issues[0].message)
    setBusy(true)
    const { error: err } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setBusy(false)
    if (err) return setError(friendlyError(err))
    setSent(true)
  }

  return (
    <AuthLayout title="Reset password" subtitle="We’ll email you a link">
      {sent ? (
        <div className="flex flex-col gap-4">
          <p className="text-ink-2">If there’s an account for {email}, a reset link is on its way. Check your inbox (and spam).</p>
          <Link to="/signin" className="text-center font-semibold text-brand-600">
            Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
          <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          <FormError message={error} />
          <Button type="submit" loading={busy} full>
            Send reset link
          </Button>
          <p className="text-sm text-ink-3">
            Tip: an admin in your family can’t see your password, but if email isn’t set up for your Family Hub, ask whoever set it up to reset it in Supabase.
          </p>
          <Link to="/signin" className="text-center font-semibold text-brand-600 dark:text-brand-400">
            Back to sign in
          </Link>
        </form>
      )}
    </AuthLayout>
  )
}
