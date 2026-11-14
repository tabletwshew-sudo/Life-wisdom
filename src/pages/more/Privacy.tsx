import { Download, Lock, Server, ShieldCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { useCurrentFamily } from '@/family/FamilyProvider'
import { deleteFamilyPhotos, exportFamilyData } from '@/lib/exportData'
import { friendlyError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

export default function Privacy() {
  const { family, isAdmin, refresh } = useCurrentFamily()
  const toast = useToast()
  const navigate = useNavigate()
  const [busy, setBusy] = useState<'export' | 'delete' | null>(null)

  async function doExport() {
    setBusy('export')
    try {
      const data = await exportFamilyData(family.id)
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `family-hub-${family.name.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      setTimeout(() => URL.revokeObjectURL(url), 5000)
    } catch (e) {
      toast(friendlyError(e), 'error')
    } finally {
      setBusy(null)
    }
  }

  async function doDelete() {
    const typed = prompt(`This permanently deletes ${family.name} and everything in it for everyone.\n\nType DELETE to confirm.`)
    if (typed?.trim() !== 'DELETE') return
    setBusy('delete')
    await deleteFamilyPhotos(family.id)
    const { error } = await supabase.from('families').delete().eq('id', family.id)
    setBusy(null)
    if (error) return toast(friendlyError(error), 'error')
    toast('Family deleted')
    await refresh()
    navigate('/welcome', { replace: true })
  }

  return (
    <>
      <PageHeader title="Privacy & your data" />
      <div className="flex flex-col gap-4">
        <Info icon={<Server className="size-6" />} title="What we store">
          Your name, emoji, colour and email; your family’s name and settings; and the chores, events, recipes (and recipe photos), meal plans and
          shopping items your family adds. Passwords are never stored in readable form (Supabase stores a one-way bcrypt hash).
        </Info>
        <Info icon={<ShieldCheck className="size-6" />} title="Who can see it">
          Only signed-in members of your family. Every database table uses Row Level Security, so the server itself refuses to hand one family’s data
          to anyone else. Automated tests check this.
        </Info>
        <Info icon={<Lock className="size-6" />} title="How it’s protected">
          All traffic uses HTTPS (encrypted in transit). Supabase encrypts the database and backups on disk with AES-256 (encrypted at rest). In
          Phase 6 you can also turn on end-to-end encryption for notes and locations, so not even the server can read them.
        </Info>
        <Info icon={<Server className="size-6" />} title="Where it lives">
          In your own free Supabase project, in the region you chose when creating it. Nothing is sold or shared, and there are no ads or trackers.
        </Info>

        <Card className="flex flex-col gap-3 p-5">
          <h2 className="text-lg font-bold">Your data</h2>
          <Button variant="secondary" onClick={doExport} loading={busy === 'export'} icon={<Download className="size-5" />}>
            Export family data (JSON)
          </Button>
          {isAdmin ? (
            <Button variant="danger" onClick={doDelete} loading={busy === 'delete'} icon={<Trash2 className="size-5" />}>
              Delete all family data
            </Button>
          ) : (
            <p className="text-sm text-ink-3">Only an admin can delete the whole family. You can leave the family from Members.</p>
          )}
        </Card>
      </div>
    </>
  )
}

function Info({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <Card className="flex gap-4 p-5">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-600 dark:bg-brand-700/40 dark:text-brand-200" aria-hidden>
        {icon}
      </span>
      <div>
        <h2 className="font-bold">{title}</h2>
        <p className="text-ink-2">{children}</p>
      </div>
    </Card>
  )
}
