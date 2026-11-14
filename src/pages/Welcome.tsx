import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { Home, KeyRound, LogOut } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { ColourPicker } from '@/components/ui/ColourPicker'
import { EmojiPicker } from '@/components/ui/EmojiPicker'
import { Field } from '@/components/ui/Field'
import { FullScreenSpinner } from '@/components/ui/Spinner'
import { useFamily } from '@/family/FamilyProvider'
import { PALETTE } from '@/lib/colours'
import { friendlyError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { familyNameSchema, inviteCodeSchema, profileSchema } from '@/lib/validation'
import { AuthLayout, FormError, getPendingInvite, setPendingInvite } from './auth/AuthLayout'

type Mode = 'create' | 'join'

export default function Welcome() {
  const { user } = useAuth()
  const { families, loading, switchFamily } = useFamily()
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const pending = params.get('code') || getPendingInvite()
  const adding = params.get('add') === '1'

  const [step, setStep] = useState<1 | 2>(1)
  const [mode, setMode] = useState<Mode>(pending ? 'join' : 'create')
  const [displayName, setDisplayName] = useState('')
  const [emoji, setEmoji] = useState('😀')
  const [colour, setColour] = useState<string>(PALETTE[0].hex)
  const [familyName, setFamilyName] = useState('')
  const [code, setCode] = useState(pending ?? '')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [profileLoaded, setProfileLoaded] = useState(false)

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('display_name, emoji')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setDisplayName(data.display_name)
          if (data.emoji && data.emoji !== '🙂') setEmoji(data.emoji)
        }
        setProfileLoaded(true)
      })
  }, [user])

  if (loading || !profileLoaded) return <FullScreenSpinner />
  // Already in a family and not joining another one → go home.
  if (families.length > 0 && !pending && !adding) return <Navigate to="/" replace />

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const parsed = profileSchema.safeParse({ displayName, emoji })
    if (!parsed.success) return setError(parsed.error.issues[0].message)
    setBusy(true)
    const { error: err } = await supabase
      .from('profiles')
      .update({ display_name: parsed.data.displayName, emoji: parsed.data.emoji })
      .eq('id', user!.id)
    setBusy(false)
    if (err) return setError(friendlyError(err))
    setStep(2)
  }

  async function finish(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      let familyId: string | null
      if (mode === 'create') {
        const parsed = familyNameSchema.safeParse(familyName)
        if (!parsed.success) throw new Error(parsed.error.issues[0].message)
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/London'
        const { data, error: err } = await supabase.rpc('create_family', { p_name: parsed.data, p_colour: colour, p_timezone: tz })
        if (err) throw err
        familyId = data
      } else {
        const parsed = inviteCodeSchema.safeParse(code)
        if (!parsed.success) throw new Error(parsed.error.issues[0].message)
        const { data, error: err } = await supabase.rpc('join_family', { p_code: parsed.data, p_colour: colour })
        if (err) throw err
        if (!data) throw new Error('We couldn’t find a family with that code. Check it with whoever invited you.')
        familyId = data
      }
      setPendingInvite(null)
      if (familyId) switchFamily(familyId)
      await qc.invalidateQueries({ queryKey: ['families'] })
      navigate('/', { replace: true })
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  if (step === 1) {
    return (
      <AuthLayout title="Welcome! 👋" subtitle="First, how should your family see you?">
        <form onSubmit={saveProfile} className="flex flex-col gap-5" noValidate>
          <div className="flex justify-center">
            <Avatar emoji={emoji} colour={colour} size="xl" />
          </div>
          <Field label="Your name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} autoComplete="given-name" />
          <EmojiPicker value={emoji} onChange={setEmoji} label="Pick your emoji" />
          <ColourPicker value={colour} onChange={setColour} label="Pick your colour" />
          <FormError message={error} />
          <Button type="submit" loading={busy} full>
            Next
          </Button>
        </form>
        <SignOutLink />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Your family" subtitle="Start a new family, or join one you’ve been invited to">
      <div role="tablist" aria-label="Create or join" className="mb-5 grid grid-cols-2 gap-1 rounded-2xl bg-card-2 p-1">
        {(
          [
            ['create', 'Start new', Home],
            ['join', 'Join with code', KeyRound],
          ] as const
        ).map(([m, label, Icon]) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => {
              setMode(m)
              setError(null)
            }}
            className={clsx(
              'flex min-h-11 items-center justify-center gap-2 rounded-xl text-[15px] font-semibold transition',
              mode === m ? 'bg-card shadow-sm' : 'text-ink-3',
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        ))}
      </div>
      <form onSubmit={finish} className="flex flex-col gap-4" noValidate>
        {mode === 'create' ? (
          <Field
            label="Family name"
            placeholder="e.g. The Smiths"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
            maxLength={60}
            hint="You’ll be an admin and get an invite code to share."
          />
        ) : (
          <Field
            label="Invite code"
            placeholder="ABCD2345"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            maxLength={12}
            className="[&_input]:font-mono [&_input]:text-xl [&_input]:tracking-[0.3em]"
            hint="Ask a parent (admin) for the 8-character code."
          />
        )}
        <FormError message={error} />
        <Button type="submit" loading={busy} full>
          {mode === 'create' ? 'Create family' : 'Join family'}
        </Button>
        <button type="button" onClick={() => setStep(1)} className="min-h-11 font-semibold text-ink-3">
          Back
        </button>
      </form>
    </AuthLayout>
  )
}

function SignOutLink() {
  return (
    <button
      onClick={() => supabase.auth.signOut()}
      className="mx-auto mt-4 flex min-h-11 items-center gap-2 font-semibold text-ink-3"
    >
      <LogOut className="size-4" aria-hidden /> Sign out
    </button>
  )
}
