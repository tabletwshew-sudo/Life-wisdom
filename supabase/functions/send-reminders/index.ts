// Family Hub — send-reminders Edge Function
//
// Called every minute by pg_cron (see supabase/setup/schedule-reminders.sql)
// with the header `x-cron-secret`. It:
//   1. creates due task/event reminders and daily summaries (in SQL), then
//   2. sends every not-yet-pushed notification to the person's devices.
//
// A signed-in user can also call it (with their normal login token) to push
// their own pending notifications straight away — used by "Send a test".
//
// Secrets (Supabase dashboard → Edge Functions → Secrets):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, CRON_SECRET
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided automatically.

import { sendPush, type VapidKeys } from './webpush.ts'

// A tiny database client (no external packages needed).
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const dbHeaders = { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' }

async function db<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, { ...init, headers: { ...dbHeaders, ...(init.headers ?? {}) } })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  const text = await res.text()
  return (text ? JSON.parse(text) : null) as T
}
const inList = (ids: string[]) => `in.(${ids.map((i) => encodeURIComponent(i)).join(',')})`

async function userFromToken(token: string): Promise<string | null> {
  if (!token) return null
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${token}` } })
  if (!res.ok) return null
  const u = await res.json()
  return typeof u?.id === 'string' ? u.id : null
}

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405)

  // Who is calling?
  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''
  const given = req.headers.get('x-cron-secret') ?? ''
  const isCron = cronSecret.length >= 16 && timingSafeEqual(given, cronSecret)
  let onlyUser: string | null = null
  if (!isCron) {
    onlyUser = await userFromToken((req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, ''))
    if (!onlyUser) return json({ error: 'Not allowed' }, 401)
  }

  // 1. Create due reminders (scheduler only).
  let created = 0
  if (isCron) {
    try {
      created = (await db<number>('rpc/generate_due_notifications', { method: 'POST', body: '{}' })) ?? 0
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : String(e) }, 500)
    }
  }

  // 2. Push anything not yet sent (from the last hour).
  const vapid: VapidKeys = {
    publicKey: Deno.env.get('VAPID_PUBLIC_KEY') ?? '',
    privateKey: Deno.env.get('VAPID_PRIVATE_KEY') ?? '',
    subject: Deno.env.get('VAPID_SUBJECT') || 'mailto:family-hub@example.com',
  }
  if (!vapid.publicKey || !vapid.privateKey) return json({ created, pushed: 0, note: 'VAPID keys not set; in-app only' })

  type Pending = { id: string; user_id: string; title: string; body: string; link: string; kind: string }
  const since = new Date(Date.now() - 3600_000).toISOString()
  const pending = await db<Pending[]>(
    `notifications?select=id,user_id,title,body,link,kind&pushed_at=is.null&created_at=gte.${encodeURIComponent(since)}` +
      (onlyUser ? `&user_id=eq.${onlyUser}` : '') +
      '&order=created_at&limit=200',
  )
  if (!pending.length) return json({ created, pushed: 0 })

  const userIds = [...new Set(pending.map((n) => n.user_id))]
  const subs = await db<{ id: string; user_id: string; endpoint: string; p256dh: string; auth: string }[]>(
    `push_subscriptions?select=id,user_id,endpoint,p256dh,auth&user_id=${inList(userIds)}`,
  )
  const unread = await db<{ user_id: string }[]>(`notifications?select=user_id&read_at=is.null&user_id=${inList(userIds)}`)
  const unreadCount = new Map<string, number>()
  for (const u of unread) unreadCount.set(u.user_id, (unreadCount.get(u.user_id) ?? 0) + 1)

  let pushed = 0
  const dead: string[] = []
  const used: string[] = []
  for (const n of pending) {
    for (const s of subs.filter((x) => x.user_id === n.user_id)) {
      try {
        const r = await sendPush(
          s,
          { title: n.title, body: n.body, url: n.link, tag: n.id, badge: unreadCount.get(n.user_id) ?? 1 },
          vapid,
          { urgency: n.kind.endsWith('reminder') ? 'high' : 'normal' },
        )
        if (r.ok) {
          pushed++
          used.push(s.id)
        } else if (r.gone) dead.push(s.id)
      } catch (e) {
        console.error('push failed', s.id, e instanceof Error ? e.message : e)
      }
    }
  }
  // Mark as pushed even if the person has no devices (they'll see it in the app).
  const now = new Date().toISOString()
  await db(`notifications?id=${inList(pending.map((n) => n.id))}`, { method: 'PATCH', body: JSON.stringify({ pushed_at: now }) })
  if (dead.length) await db(`push_subscriptions?id=${inList(dead)}`, { method: 'DELETE' })
  if (used.length) await db(`push_subscriptions?id=${inList([...new Set(used)])}`, { method: 'PATCH', body: JSON.stringify({ last_used_at: now }) })

  return json({ created, pushed, removedDevices: dead.length })
})
