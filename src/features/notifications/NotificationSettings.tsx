import { BellOff, BellRing, Send, Smartphone, Trash2, Wrench } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Toggle } from '@/components/ui/Toggle'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/auth/AuthProvider'
import { useCurrentFamily } from '@/family/FamilyProvider'
import { friendlyError } from '@/lib/errors'
import { disablePush, enablePush, getPushStatus, type PushStatus } from '@/lib/push'
import { env } from '@/lib/env'
import { supabase } from '@/lib/supabase'
import { SettingsGroup } from '@/pages/more/SettingsList'
import { useDevices, usePrefs, useSavePrefs } from './api'
import { useQueryClient } from '@tanstack/react-query'

const STATUS_TEXT: Record<PushStatus, { title: string; body: string }> = {
  on: { title: 'Notifications are on for this device', body: 'Reminders and alerts will pop up even when Family Hub is closed.' },
  ready: { title: 'Get notifications on this device', body: 'Tap below and choose “Allow”.' },
  'ios-install': {
    title: 'Install the app first (iPhone)',
    body: 'On iPhone and iPad, notifications only work after you add Family Hub to your Home Screen: Safari → Share → Add to Home Screen. Then open it from the new icon and come back here.',
  },
  'ios-old': { title: 'Update your iPhone', body: 'Notifications for web apps need iOS 16.4 or newer (Settings → General → Software Update).' },
  denied: {
    title: 'Notifications are blocked',
    body: 'You chose “Don’t allow” earlier. iPhone: Settings → Notifications → Family Hub → Allow. Computer: click the padlock next to the web address and allow notifications.',
  },
  unsupported: { title: 'This browser can’t show notifications', body: 'Reminders will still pop up inside the app while it’s open.' },
  'not-setup': { title: 'Push isn’t set up yet', body: 'An admin needs to add the push key (see below). Until then, reminders pop up inside the app while it’s open.' },
}

export default function NotificationSettings() {
  const { user } = useAuth()
  const { family, isAdmin } = useCurrentFamily()
  const toast = useToast()
  const qc = useQueryClient()
  const prefs = usePrefs().data
  const save = useSavePrefs()
  const devices = useDevices().data ?? []
  const [status, setStatus] = useState<PushStatus | null>(null)
  const [busy, setBusy] = useState<'on' | 'off' | 'test' | null>(null)

  const refresh = () => getPushStatus().then(setStatus)
  useEffect(() => {
    refresh()
  }, [])

  async function turnOn() {
    setBusy('on')
    try {
      await enablePush(user!.id)
      toast('Notifications turned on')
      qc.invalidateQueries({ queryKey: ['push_subscriptions'] })
    } catch (e) {
      toast(friendlyError(e), 'error')
    } finally {
      setBusy(null)
      refresh()
    }
  }

  async function turnOff() {
    setBusy('off')
    try {
      await disablePush()
      toast('Notifications turned off for this device')
      qc.invalidateQueries({ queryKey: ['push_subscriptions'] })
    } catch (e) {
      toast(friendlyError(e), 'error')
    } finally {
      setBusy(null)
      refresh()
    }
  }

  async function sendTest() {
    setBusy('test')
    try {
      const { error } = await supabase.rpc('send_test_notification', { p_family: family.id })
      if (error) throw error
      // Ask the server to push it now (if push is set up).
      const { data } = await supabase.auth.getSession()
      await fetch(`${env.supabaseUrl}/functions/v1/send-reminders`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${data.session?.access_token}`, apikey: env.supabaseAnonKey, 'Content-Type': 'application/json' },
        body: '{}',
      }).catch(() => null)
      toast(status === 'on' ? 'Test sent — it should pop up in a few seconds' : 'Test added to your notifications')
    } catch (e) {
      toast(friendlyError(e), 'error')
    } finally {
      setBusy(null)
    }
  }

  async function removeDevice(id: string) {
    const { error } = await supabase.from('push_subscriptions').delete().eq('id', id)
    if (error) return toast(friendlyError(error), 'error')
    qc.invalidateQueries({ queryKey: ['push_subscriptions'] })
    refresh()
  }

  const s = status ? STATUS_TEXT[status] : null
  const p = prefs

  return (
    <>
      <PageHeader title="Notifications" />

      <Card className="mb-5 p-5">
        {s && (
          <div className="flex gap-3">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-600 dark:bg-brand-700/40 dark:text-brand-200" aria-hidden>
              {status === 'on' ? <BellRing className="size-6" /> : status === 'ready' ? <Smartphone className="size-6" /> : <BellOff className="size-6" />}
            </span>
            <div>
              <h2 className="text-lg font-bold">{s.title}</h2>
              <p className="text-ink-2">{s.body}</p>
            </div>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {status === 'ready' && (
            <Button onClick={turnOn} loading={busy === 'on'} icon={<BellRing className="size-5" />}>
              Turn on notifications
            </Button>
          )}
          {status === 'on' && (
            <Button variant="secondary" onClick={turnOff} loading={busy === 'off'} icon={<BellOff className="size-5" />}>
              Turn off on this device
            </Button>
          )}
          <Button variant="secondary" onClick={sendTest} loading={busy === 'test'} icon={<Send className="size-5" />}>
            Send a test
          </Button>
          {status === 'ios-install' && (
            <Link to="/more/install" className="inline-flex min-h-13 items-center rounded-2xl bg-brand-500 px-5 font-semibold text-white">
              How to install
            </Link>
          )}
        </div>
      </Card>

      {p && (
        <>
          <SettingsGroup title="What to tell me about">
            <Toggle label="Daily summary" description="Your chores, events and dinner for the day" checked={p.daily_summary} onChange={(v) => save.mutate({ daily_summary: v })} />
            {p.daily_summary && (
              <label className="flex min-h-14 items-center gap-3 px-4 py-2">
                <span className="flex-1 font-medium">Summary time</span>
                <input
                  type="time"
                  value={p.daily_summary_time.slice(0, 5)}
                  onChange={(e) => e.target.value && save.mutate({ daily_summary_time: e.target.value })}
                  className="min-h-11 rounded-xl border border-line bg-card px-3"
                />
              </label>
            )}
            <Toggle label="New chores and events" description="When someone gives me a chore or adds me to an event" checked={p.assignment_alerts} onChange={(v) => save.mutate({ assignment_alerts: v })} />
            <Toggle label="Chore reminders" description="At the reminder time set on each chore" checked={p.task_reminders} onChange={(v) => save.mutate({ task_reminders: v })} />
            <Toggle label="Event reminders" description="At the reminder time set on each event" checked={p.event_reminders} onChange={(v) => save.mutate({ event_reminders: v })} />
            <Toggle label="New recipes" description="When someone adds a recipe, drink or idea" checked={p.new_recipe_alerts} onChange={(v) => save.mutate({ new_recipe_alerts: v })} />
          </SettingsGroup>
          <p className="-mt-3 mb-5 px-1 text-sm text-ink-3">These choices are just for you, and apply on all your devices.</p>
        </>
      )}

      {devices.length > 0 && (
        <SettingsGroup title="My devices with notifications">
          {devices.map((d) => (
            <div key={d.id} className="flex min-h-14 items-center gap-3 px-4 py-2">
              <Smartphone className="size-5 text-ink-3" aria-hidden />
              <span className="flex-1">
                <span className="block font-medium">{d.device_label || 'Device'}</span>
                <span className="text-xs text-ink-3">Added {new Date(d.created_at).toLocaleDateString('en-GB')}</span>
              </span>
              <button onClick={() => removeDevice(d.id)} aria-label={`Remove ${d.device_label}`} className="flex size-10 items-center justify-center rounded-full text-ink-3 hover:bg-card-2">
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          ))}
        </SettingsGroup>
      )}

      <Card className="mb-5 p-5 text-ink-2">
        <h2 className="mb-2 font-bold text-ink">Good to know</h2>
        <ul className="list-disc space-y-1 pl-5 text-[15px]">
          <li>Each device is set up separately: turn notifications on, on every phone or computer you use.</li>
          <li>iPhone/iPad: needs iOS 16.4+ and the app added to the Home Screen. Focus modes and Low Power Mode can delay them.</li>
          <li>In a normal browser tab, reminders appear inside Family Hub while it’s open.</li>
          <li>Reminders are checked every minute, so they can arrive up to a minute late.</li>
          <li>Notifications never include private notes or (when encryption is on) locations.</li>
        </ul>
      </Card>

      {isAdmin && (
        <Link to="/more/notifications/setup" className="mb-4 flex min-h-14 items-center gap-3 rounded-2xl bg-card px-4 shadow-[var(--shadow-card)]">
          <Wrench className="size-5 text-ink-3" aria-hidden />
          <span className="flex-1 font-semibold">Set up push (admins)</span>
          <span className="text-sm text-ink-3">{env.vapidPublicKey ? 'Key added ✓' : 'Not set up'}</span>
        </Link>
      )}
    </>
  )
}
