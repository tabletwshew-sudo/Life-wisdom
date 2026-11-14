import { useQueryClient } from '@tanstack/react-query'
import { useState, type FormEvent } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ColourPicker } from '@/components/ui/ColourPicker'
import { EmojiPicker } from '@/components/ui/EmojiPicker'
import { Field } from '@/components/ui/Field'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/auth/AuthProvider'
import { useCurrentFamily } from '@/family/FamilyProvider'
import { friendlyError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { passwordSchema, profileSchema } from '@/lib/validation'
import { FormError } from '../auth/AuthLayout'

export default function Profile() {
  const { me, family, members } = useCurrentFamily()
  const { user } = useAuth()
  const qc = useQueryClient()
  const toast = useToast()
  const [displayName, setDisplayName] = useState(me.displayName)
  const [emoji, setEmoji] = useState(me.emoji)
  const [colour, setColour] = useState(me.colour)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const parsed = profileSchema.safeParse({ displayName, emoji })
    if (!parsed.success) return setError(parsed.error.issues[0].message)
    setBusy(true)
    try {
      const { error: e1 } = await supabase
        .from('profiles')
        .update({ display_name: parsed.data.displayName, emoji: parsed.data.emoji })
        .eq('id', me.userId)
      if (e1) throw e1
      if (colour !== me.colour) {
        const { error: e2 } = await supabase.rpc('update_member', { p_family: family.id, p_user: me.userId, p_colour: colour })
        if (e2) throw e2
      }
      await qc.invalidateQueries({ queryKey: ['members', family.id] })
      toast('Profile saved')
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Your profile" subtitle={user?.email} />
      <form onSubmit={save} noValidate>
        <Card className="flex flex-col gap-5 p-5">
          <div className="flex justify-center">
            <Avatar emoji={emoji} colour={colour} size="xl" />
          </div>
          <Field label="Name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} />
          <EmojiPicker value={emoji} onChange={setEmoji} />
          <ColourPicker value={colour} onChange={setColour} taken={members.filter((m) => m.userId !== me.userId).map((m) => m.colour)} />
          <FormError message={error} />
          <Button type="submit" loading={busy} full>
            Save
          </Button>
        </Card>
      </form>
      <ChangePassword />
    </>
  )
}

function ChangePassword() {
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const parsed = passwordSchema.safeParse(password)
    if (!parsed.success) return setError(parsed.error.issues[0].message)
    setBusy(true)
    const { error: err } = await supabase.auth.updateUser({ password: parsed.data })
    setBusy(false)
    if (err) return setError(friendlyError(err))
    setError(null)
    setPassword('')
    toast('Password changed')
  }

  return (
    <form onSubmit={submit} noValidate className="mt-5">
      <Card className="flex flex-col gap-4 p-5">
        <h2 className="text-lg font-bold">Change password</h2>
        <Field label="New password" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={error} />
        <Button type="submit" variant="secondary" loading={busy}>
          Change password
        </Button>
      </Card>
    </form>
  )
}
