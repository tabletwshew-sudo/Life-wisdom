import { Check, Copy, KeyRound } from 'lucide-react'
import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { useCurrentFamily } from '@/family/FamilyProvider'
import { env } from '@/lib/env'
import { b64urlEncode, generateVapidKeys } from '../../../supabase/functions/send-reminders/webpush'

interface Keys {
  publicKey: string
  privateKey: string
  cronSecret: string
}

/**
 * Admin helper: creates the push keys in the browser (never sent anywhere) and
 * shows exactly what to paste where. One-off setup.
 */
export default function PushSetup() {
  const { isAdmin } = useCurrentFamily()
  const [keys, setKeys] = useState<Keys | null>(null)
  if (!isAdmin) return <Navigate to="/more/notifications" replace />

  const site = window.location.origin
  const projectUrl = env.supabaseUrl

  async function generate() {
    if (env.vapidPublicKey && !confirm('Push is already set up. New keys will stop notifications on every device until each one turns them on again. Continue?')) return
    const k = await generateVapidKeys()
    setKeys({ ...k, cronSecret: b64urlEncode(crypto.getRandomValues(new Uint8Array(32))) })
  }

  const sql = keys
    ? `select vault.create_secret('${projectUrl}', 'family_hub_project_url');
select vault.create_secret('${keys.cronSecret}', 'family_hub_cron_secret');
select cron.schedule('family-hub-reminders', '* * * * *', $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'family_hub_project_url') || '/functions/v1/send-reminders',
    headers := jsonb_build_object('Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'family_hub_cron_secret')),
    body := '{}'::jsonb, timeout_milliseconds := 20000);
$$);`
    : ''

  return (
    <>
      <PageHeader title="Set up push" subtitle="One-off, for admins" />
      <Card className="mb-5 p-5">
        <p className="text-ink-2">
          Push notifications need a pair of keys, a small server function and a once-a-minute timer, all on the free plans. Follow the steps in order; the full guide
          is in the README (“Push notifications”).
        </p>
        {env.vapidPublicKey ? (
          <p className="mt-3 rounded-xl bg-emerald-50 p-3 font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">✓ This website already has a push key.</p>
        ) : null}
        <Button className="mt-4" icon={<KeyRound className="size-5" />} onClick={generate}>
          {keys ? 'Make new keys' : 'Create my keys'}
        </Button>
        <p className="mt-2 text-sm text-ink-3">Keys are created on this device and are never sent anywhere. Keep this page open until you’ve finished.</p>
      </Card>

      {keys && (
        <ol className="flex flex-col gap-4">
          <Step n={1} title="Vercel: add the public key">
            Vercel → your project → Settings → Environment Variables → add:
            <Copyable label="Name" value="VITE_VAPID_PUBLIC_KEY" />
            <Copyable label="Value" value={keys.publicKey} />
            Then Deployments → ⋯ → <strong>Redeploy</strong>.
          </Step>
          <Step n={2} title="Supabase: add four secrets">
            Supabase → Edge Functions → <strong>Secrets</strong> → add each name and value:
            <Copyable label="VAPID_PUBLIC_KEY" value={keys.publicKey} />
            <Copyable label="VAPID_PRIVATE_KEY (keep secret!)" value={keys.privateKey} />
            <Copyable label="VAPID_SUBJECT" value={site} />
            <Copyable label="CRON_SECRET (keep secret!)" value={keys.cronSecret} />
          </Step>
          <Step n={3} title="Deploy the reminder function">
            The easiest way is the included GitHub Action: in GitHub → your repo → Settings → Secrets and variables → Actions, add <code>SUPABASE_ACCESS_TOKEN</code> and{' '}
            <code>SUPABASE_PROJECT_REF</code>, then Actions → “Deploy reminder function” → Run workflow. (README step 7 has details and a no-GitHub alternative.)
          </Step>
          <Step n={4} title="Supabase: start the once-a-minute timer">
            Supabase → SQL Editor → New query → paste and Run:
            <Copyable label="SQL" value={sql} multiline />
          </Step>
          <Step n={5} title="Turn it on and test">
            On each phone: open Family Hub from the Home Screen → More → Notifications → <strong>Turn on notifications</strong> → <strong>Send a test</strong>.
          </Step>
        </ol>
      )}
    </>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li>
      <Card className="flex gap-3 p-4">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-500 font-bold text-white" aria-hidden>
          {n}
        </span>
        <div className="min-w-0 flex-1 text-ink-2">
          <h2 className="mb-1 font-bold text-ink">{title}</h2>
          {children}
        </div>
      </Card>
    </li>
  )
}

function Copyable({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  const toast = useToast()
  const [done, setDone] = useState(false)
  return (
    <div className="my-2">
      <p className="text-xs font-bold tracking-wide text-ink-3 uppercase">{label}</p>
      <div className="flex items-start gap-2">
        <code className={`min-w-0 flex-1 rounded-lg bg-card-2 px-3 py-2 font-mono text-[13px] text-ink ${multiline ? 'whitespace-pre-wrap' : 'truncate'} break-all select-all`}>{value}</code>
        <button
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(value)
              setDone(true)
              setTimeout(() => setDone(false), 1500)
            } catch {
              toast('Couldn’t copy — select the text instead', 'error')
            }
          }}
          aria-label={`Copy ${label}`}
          className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-card-2"
        >
          {done ? <Check className="size-5 text-done" aria-hidden /> : <Copy className="size-5" aria-hidden />}
        </button>
      </div>
    </div>
  )
}
