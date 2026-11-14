import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Copy, Download, Hourglass, KeyRound, Lock, LockOpen, ShieldCheck, UserX } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/auth/AuthProvider'
import { useCurrentFamily } from '@/family/FamilyProvider'
import { friendlyError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { SettingsGroup } from '@/pages/more/SettingsList'
import { useEncryption } from './EncryptionProvider'
import { UnlockSheet } from './UnlockSheet'

export default function EncryptionPage() {
  const { family, isAdmin, members } = useCurrentFamily()
  const { user } = useAuth()
  const enc = useEncryption()
  const toast = useToast()
  const [sheet, setSheet] = useState<null | 'enable' | 'unlock' | 'recover' | 'reset' | 'disable'>(null)
  const [code, setCode] = useState<string | null>(null)
  const [progress, setProgress] = useState('')

  // Who has the family key (admins can see this).
  const keysQ = useQuery({
    queryKey: ['encryption-members', family.id, enc.status],
    enabled: enc.enabled && isAdmin,
    queryFn: async () => {
      const [{ data: have }, { data: pubs }] = await Promise.all([
        supabase.from('family_keys').select('user_id').eq('family_id', family.id),
        supabase.from('user_public_keys').select('user_id').in('user_id', members.map((m) => m.userId)),
      ])
      // Plain arrays (not Sets) so this survives the offline cache.
      return { have: (have ?? []).map((r) => r.user_id), pubs: (pubs ?? []).map((r) => r.user_id) }
    },
  })

  const statusCard = {
    off: { icon: <LockOpen className="size-6" />, title: 'Encryption is off', body: 'Notes and locations are protected by your family’s login and the database rules, and stored encrypted on Supabase’s disks — but the server could read them.' },
    checking: { icon: <Lock className="size-6" />, title: 'Checking…', body: '' },
    'needs-unlock': { icon: <Lock className="size-6" />, title: 'Locked on this device', body: 'Enter your password once to read private notes here.' },
    waiting: { icon: <Hourglass className="size-6" />, title: 'Waiting for the family key', body: 'An admin’s Family Hub shares it automatically next time they open the app. Nothing to do!' },
    ready: { icon: <ShieldCheck className="size-6" />, title: 'End-to-end encryption is on', body: 'Notes and locations are encrypted on your device before they leave it. Not even the server can read them.' },
  }[enc.status]

  return (
    <>
      <PageHeader title="Encryption" />

      <Card className="mb-5 flex gap-3 p-5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-600 dark:bg-brand-700/40 dark:text-brand-200" aria-hidden>
          {statusCard.icon}
        </span>
        <div className="flex-1">
          <h2 className="text-lg font-bold">{statusCard.title}</h2>
          <p className="text-ink-2">{statusCard.body}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {enc.status === 'off' && isAdmin && (
              <Button onClick={() => setSheet('enable')} icon={<Lock className="size-5" />}>
                Turn on encryption
              </Button>
            )}
            {enc.status === 'off' && !isAdmin && <p className="text-sm text-ink-3">Only an admin can turn it on.</p>}
            {enc.status === 'needs-unlock' && <Button onClick={() => setSheet('unlock')}>Unlock</Button>}
            {(enc.status === 'waiting' || enc.status === 'needs-unlock') && isAdmin && (
              <Button variant="secondary" onClick={() => setSheet('recover')} icon={<KeyRound className="size-5" />}>
                Use recovery code
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="mb-5 p-5 text-ink-2">
        <h2 className="mb-2 font-bold text-ink">How it works, and the trade-offs</h2>
        <ul className="list-disc space-y-1.5 pl-5 text-[15px]">
          <li>
            <strong>Encrypted:</strong> chore notes, event notes, event locations and recipe notes. Titles, dates and times are not, so the calendar, reminders
            and search keep working.
          </li>
          <li>
            <strong>Your password is the key.</strong> Each person’s key is locked with their Family Hub password. You type it once per device.
          </li>
          <li>
            <strong>Forgotten password?</strong> Reset it as usual — then an admin’s app automatically shares the key with you again. Until then your notes show 🔒.
          </li>
          <li>
            <strong>If every admin loses access</strong> and nobody has the <strong>recovery code</strong>, encrypted notes are gone for good. Nobody — not Supabase,
            not us — can recover them. Keep the code somewhere safe.
          </li>
          <li>
            <strong>Push reminders</strong> still work (titles and times aren’t encrypted) but never include notes or locations.
          </li>
          <li>Someone removed from the family loses their copy of the key, but anything they already saw on their device may still be there.</li>
        </ul>
      </Card>

      {enc.enabled && isAdmin && keysQ.data && (
        <SettingsGroup title="Who can read private notes">
          {members.map((m) => {
            const has = keysQ.data.have.includes(m.userId)
            const pub = keysQ.data.pubs.includes(m.userId)
            return (
              <div key={m.userId} className="flex min-h-14 items-center gap-3 px-4 py-2">
                <Avatar emoji={m.emoji} colour={m.colour} size="sm" />
                <span className="flex-1 font-medium">{m.displayName}</span>
                {has ? (
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-done">
                    <CheckCircle2 className="size-4" aria-hidden /> Has the key
                  </span>
                ) : pub ? (
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-new">
                    <Hourglass className="size-4" aria-hidden /> Waiting
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-sm text-ink-3">
                    <UserX className="size-4" aria-hidden /> Needs to sign in once
                  </span>
                )}
              </div>
            )
          })}
          {enc.status === 'ready' && (
            <div className="p-3">
              <Button
                size="md"
                variant="secondary"
                onClick={async () => {
                  const n = await enc.shareWithWaiting()
                  keysQ.refetch()
                  toast(n ? `Shared with ${n} ${n === 1 ? 'person' : 'people'}` : 'Everyone who can has the key')
                }}
              >
                Share now
              </Button>
            </div>
          )}
        </SettingsGroup>
      )}

      {enc.enabled && (
        <SettingsGroup title="Keys">
          {isAdmin && enc.status === 'ready' && (
            <button
              className="flex min-h-14 w-full items-center gap-3 px-4 text-left hover:bg-card-2"
              onClick={async () => {
                if (!confirm('Make a new recovery code? The old one will stop working.')) return
                try {
                  setCode(await enc.newRecoveryCode())
                } catch (e) {
                  toast(friendlyError(e), 'error')
                }
              }}
            >
              <KeyRound className="size-5 text-ink-3" aria-hidden />
              <span className="flex-1 font-medium">Make a new recovery code</span>
            </button>
          )}
          <button className="flex min-h-14 w-full items-center gap-3 px-4 text-left hover:bg-card-2" onClick={() => setSheet('reset')}>
            <AlertTriangle className="size-5 text-ink-3" aria-hidden />
            <span className="flex-1">
              <span className="block font-medium">Reset my keys</span>
              <span className="text-sm text-ink-3">If your key won’t unlock. An admin then re-shares the family key.</span>
            </span>
          </button>
          {isAdmin && enc.status === 'ready' && (
            <button className="flex min-h-14 w-full items-center gap-3 px-4 text-left text-red-600 hover:bg-card-2 dark:text-red-400" onClick={() => setSheet('disable')}>
              <LockOpen className="size-5" aria-hidden />
              <span className="flex-1 font-medium">Turn off encryption</span>
            </button>
          )}
        </SettingsGroup>
      )}

      <EnableSheet
        open={sheet === 'enable'}
        onClose={() => setSheet(null)}
        onDone={(c) => {
          setSheet(null)
          setCode(c)
        }}
        progress={progress}
        setProgress={setProgress}
      />
      <UnlockSheet open={sheet === 'unlock'} onClose={() => setSheet(null)} />
      <RecoverSheet open={sheet === 'recover'} onClose={() => setSheet(null)} />
      <ResetSheet open={sheet === 'reset'} onClose={() => setSheet(null)} email={user?.email ?? ''} />
      <DisableSheet open={sheet === 'disable'} onClose={() => setSheet(null)} />
      <RecoveryCodeSheet code={code} familyName={family.name} onClose={() => setCode(null)} />
    </>
  )
}

function EnableSheet({ open, onClose, onDone, progress, setProgress }: { open: boolean; onClose: () => void; onDone: (code: string) => void; progress: string; setProgress: (s: string) => void }) {
  const { enable, busy } = useEncryption()
  const [password, setPassword] = useState('')
  const [agree, setAgree] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    try {
      const code = await enable(password, setProgress)
      setPassword('')
      setAgree(false)
      onDone(code)
    } catch (err) {
      setError(friendlyError(err))
    } finally {
      setProgress('')
    }
  }
  return (
    <Sheet open={open} onClose={() => !busy && onClose()} title="Turn on encryption">
      <form onSubmit={submit} className="flex flex-col gap-4 pb-2" noValidate>
        <p className="text-ink-2">
          Existing notes and locations will be encrypted now, on this device. Everyone else gets the key automatically after they next sign in and an admin’s app
          is open.
        </p>
        <label className="flex items-start gap-3 rounded-xl bg-card-2 p-3">
          <input type="checkbox" className="mt-1 size-5 accent-brand-500" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span className="text-[15px]">
            I understand that if every admin forgets their password <strong>and</strong> we lose the recovery code, encrypted notes can’t be recovered.
          </span>
        </label>
        <Field label="Your password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={error} />
        <Button type="submit" loading={busy} disabled={!agree || !password}>
          Turn on encryption
        </Button>
        {progress && (
          <p role="status" className="text-center text-sm text-ink-3">
            {progress}
          </p>
        )}
      </form>
    </Sheet>
  )
}

function RecoveryCodeSheet({ code, familyName, onClose }: { code: string | null; familyName: string; onClose: () => void }) {
  const toast = useToast()
  const [saved, setSaved] = useState(false)
  const text = code
    ? `Family Hub — recovery code for ${familyName}\n\n${code}\n\nKeep this somewhere safe (a password manager, or printed and filed).\nAn admin can use it in More → Encryption → Use recovery code if everyone loses access to the encryption key.\nCreated ${new Date().toLocaleDateString('en-GB')}.`
    : ''
  return (
    <Sheet open={!!code} onClose={() => saved && onClose()} title="Your recovery code">
      {code && (
        <div className="flex flex-col gap-4 pb-2">
          <p className="text-ink-2">This is shown only once. It can unlock your family’s encrypted notes if every admin loses access.</p>
          <p className="rounded-2xl bg-card-2 p-4 text-center font-mono text-xl font-bold tracking-wider break-all select-all" aria-label="Recovery code">
            {code}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              icon={<Copy className="size-5" />}
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(code)
                  toast('Copied')
                } catch {
                  toast('Couldn’t copy — write it down instead', 'error')
                }
              }}
            >
              Copy
            </Button>
            <Button
              variant="secondary"
              icon={<Download className="size-5" />}
              onClick={() => {
                const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
                const a = document.createElement('a')
                a.href = url
                a.download = 'family-hub-recovery-code.txt'
                a.click()
                setTimeout(() => URL.revokeObjectURL(url), 3000)
              }}
            >
              Download
            </Button>
          </div>
          <label className="flex items-center gap-3">
            <input type="checkbox" className="size-5 accent-brand-500" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
            I’ve saved it somewhere safe
          </label>
          <Button disabled={!saved} onClick={onClose}>
            Done
          </Button>
        </div>
      )}
    </Sheet>
  )
}

function RecoverSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { recover, status } = useEncryption()
  const toast = useToast()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <Sheet open={open} onClose={onClose} title="Use recovery code">
      <form
        className="flex flex-col gap-4 pb-2"
        onSubmit={async (e) => {
          e.preventDefault()
          setBusy(true)
          setError(null)
          try {
            await recover(code)
            toast('Family key recovered')
            onClose()
          } catch (err) {
            setError(friendlyError(err))
          } finally {
            setBusy(false)
          }
        }}
      >
        {status === 'needs-unlock' && <p className="text-ink-2">First unlock with your password (above), then come back here.</p>}
        <Field label="Recovery code" placeholder="XXXX-XXXX-XXXX-XXXX-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value)} autoCapitalize="characters" error={error} />
        <Button type="submit" loading={busy} disabled={!code.trim() || status === 'needs-unlock'}>
          Recover
        </Button>
      </form>
    </Sheet>
  )
}

function ResetSheet({ open, onClose, email }: { open: boolean; onClose: () => void; email: string }) {
  const { resetMyKeys, busy } = useEncryption()
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  return (
    <Sheet open={open} onClose={onClose} title="Reset my keys">
      <form
        className="flex flex-col gap-4 pb-2"
        onSubmit={async (e) => {
          e.preventDefault()
          setError(null)
          try {
            const { error: err } = await supabase.auth.signInWithPassword({ email, password })
            if (err) throw new Error('That isn’t your current password')
            await resetMyKeys(password)
            toast('New keys made. An admin’s app will share the family key with you.')
            onClose()
          } catch (er) {
            setError(friendlyError(er))
          }
        }}
      >
        <p className="text-ink-2">Makes a new personal key locked with your current password. You’ll see 🔒 on notes until an admin’s Family Hub shares the family key with you again.</p>
        <Field label="Your current password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={error} />
        <Button type="submit" loading={busy} disabled={!password}>
          Reset my keys
        </Button>
      </form>
    </Sheet>
  )
}

function DisableSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { disable, busy } = useEncryption()
  const toast = useToast()
  const [progress, setProgress] = useState('')
  return (
    <Sheet open={open} onClose={() => !busy && onClose()} title="Turn off encryption?">
      <div className="flex flex-col gap-4 pb-2">
        <p className="text-ink-2">All notes and locations will be decrypted on this device and saved as normal text. They stay protected by your family’s login, the database rules and Supabase’s disk encryption.</p>
        <Button
          variant="danger"
          loading={busy}
          onClick={async () => {
            try {
              await disable(setProgress)
              toast('Encryption turned off')
              onClose()
            } catch (e) {
              toast(friendlyError(e), 'error')
            } finally {
              setProgress('')
            }
          }}
        >
          Decrypt and turn off
        </Button>
        {progress && <p className="text-center text-sm text-ink-3">{progress}</p>}
      </div>
    </Sheet>
  )
}
