import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Crown, RefreshCw, Share2, UserMinus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card, SectionTitle } from '@/components/ui/Card'
import { Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { useCurrentFamily, type Member } from '@/family/FamilyProvider'
import { friendlyError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

export default function FamilyMembers() {
  const { family, members, me, isAdmin } = useCurrentFamily()
  const [selected, setSelected] = useState<Member | null>(null)

  return (
    <>
      <PageHeader title="Members" subtitle={family.name} />
      {isAdmin && <InviteCard familyId={family.id} />}

      <SectionTitle>{members.length} {members.length === 1 ? 'person' : 'people'}</SectionTitle>
      <Card className="divide-y divide-line overflow-hidden">
        {members.map((m) => (
          <button
            key={m.userId}
            onClick={() => setSelected(m)}
            disabled={!isAdmin && m.userId !== me.userId}
            className="flex min-h-16 w-full items-center gap-3 px-4 py-2 text-left transition enabled:hover:bg-card-2"
          >
            <Avatar emoji={m.emoji} colour={m.colour} />
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">
                {m.displayName} {m.userId === me.userId && <span className="text-ink-3">(you)</span>}
              </p>
              <p className="flex items-center gap-1 text-sm text-ink-3">
                {m.role === 'admin' ? (
                  <>
                    <Crown className="size-3.5" aria-hidden /> Admin
                  </>
                ) : (
                  'Member'
                )}
              </p>
            </div>
            <span className="size-4 rounded-full" style={{ background: m.colour }} aria-hidden />
          </button>
        ))}
      </Card>
      {!isAdmin && <p className="mt-3 px-1 text-sm text-ink-3">Only admins can invite or remove people. Ask a parent if someone needs to join.</p>}

      <MemberSheet member={selected} onClose={() => setSelected(null)} />
    </>
  )
}

function InviteCard({ familyId }: { familyId: string }) {
  const toast = useToast()
  const qc = useQueryClient()
  const [busy, setBusy] = useState(false)
  const q = useQuery({
    queryKey: ['invite', familyId],
    queryFn: async () => {
      const { data, error } = await supabase.from('family_invites').select('code').eq('family_id', familyId).single()
      if (error) throw error
      return data.code
    },
  })
  const code = q.data
  const link = code ? `${window.location.origin}/join/${code}` : ''
  const pretty = code ? `${code.slice(0, 4)}-${code.slice(4)}` : '········'

  async function copy() {
    try {
      await navigator.clipboard.writeText(link)
      toast('Invite link copied')
    } catch {
      toast('Couldn’t copy — long-press the code instead', 'error')
    }
  }
  async function share() {
    if (navigator.share) {
      await navigator.share({ title: 'Join our family on Family Hub', text: `Join our family on Family Hub with code ${code}`, url: link }).catch(() => {})
    } else copy()
  }
  async function regenerate() {
    if (!confirm('Make a new code? The old code and link will stop working.')) return
    setBusy(true)
    const { error } = await supabase.rpc('regenerate_invite_code', { p_family: familyId })
    setBusy(false)
    if (error) return toast(friendlyError(error), 'error')
    qc.invalidateQueries({ queryKey: ['invite', familyId] })
    toast('New invite code made')
  }

  return (
    <Card className="mb-5 p-5">
      <h2 className="text-lg font-bold">Invite someone</h2>
      <p className="mb-4 text-ink-3">Share the link, or let them type the code after signing up. New people join as members.</p>
      <p className="mb-4 rounded-2xl bg-card-2 py-4 text-center font-mono text-3xl font-bold tracking-[0.2em] select-all" aria-label={`Invite code ${code ?? ''}`}>
        {pretty}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={share} icon={<Share2 className="size-5" />} disabled={!code}>
          Share
        </Button>
        <Button variant="secondary" onClick={copy} icon={<Copy className="size-5" />} disabled={!code}>
          Copy link
        </Button>
      </div>
      <Button variant="ghost" size="md" onClick={regenerate} loading={busy} icon={<RefreshCw className="size-4" />} className="mt-2 w-full">
        Make a new code
      </Button>
    </Card>
  )
}

function MemberSheet({ member, onClose }: { member: Member | null; onClose: () => void }) {
  const { family, me, isAdmin, members, refresh } = useCurrentFamily()
  const toast = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const isMe = member?.userId === me.userId
  const adminCount = members.filter((m) => m.role === 'admin').length

  async function run(fn: () => PromiseLike<{ error: unknown }>, success: string) {
    setBusy(true)
    const { error } = await fn()
    setBusy(false)
    if (error) return toast(friendlyError(error), 'error')
    toast(success)
    await refresh()
    onClose()
  }

  return (
    <Sheet open={!!member} onClose={onClose} title={member ? member.displayName : ''}>
      {member && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3 py-2">
            <Avatar emoji={member.emoji} colour={member.colour} size="lg" />
            <p className="text-ink-3">
              {member.role === 'admin' ? 'Admin — can manage the family and assign anything.' : 'Member — can tick off their own tasks.'}
            </p>
          </div>
          {isAdmin && member.role === 'member' && (
            <Button
              variant="secondary"
              loading={busy}
              icon={<Crown className="size-5" />}
              onClick={() => run(() => supabase.rpc('update_member', { p_family: family.id, p_user: member.userId, p_role: 'admin' }), `${member.displayName} is now an admin`)}
            >
              Make admin
            </Button>
          )}
          {isAdmin && member.role === 'admin' && adminCount > 1 && (
            <Button
              variant="secondary"
              loading={busy}
              onClick={() => run(() => supabase.rpc('update_member', { p_family: family.id, p_user: member.userId, p_role: 'member' }), `${member.displayName} is now a member`)}
            >
              Change to member
            </Button>
          )}
          {isAdmin && !isMe && (
            <Button
              variant="danger"
              loading={busy}
              icon={<UserMinus className="size-5" />}
              onClick={() => {
                if (confirm(`Remove ${member.displayName} from ${family.name}?`))
                  run(() => supabase.rpc('remove_member', { p_family: family.id, p_user: member.userId }), `${member.displayName} was removed`)
              }}
            >
              Remove from family
            </Button>
          )}
          {isMe && (
            <>
              <Button variant="secondary" onClick={() => navigate('/more/profile')}>
                Edit my profile
              </Button>
              <Button
                variant="danger"
                loading={busy}
                onClick={() => {
                  const last = members.length === 1
                  const msg = last
                    ? `You’re the only person in ${family.name}. Leaving will delete the family and all its data. Continue?`
                    : `Leave ${family.name}? You’ll need a new invite to come back.`
                  if (confirm(msg))
                    run(() => supabase.rpc('remove_member', { p_family: family.id, p_user: me.userId }), `You left ${family.name}`).then(() =>
                      navigate('/welcome', { replace: true }),
                    )
                }}
              >
                Leave family
              </Button>
            </>
          )}
        </div>
      )}
    </Sheet>
  )
}
