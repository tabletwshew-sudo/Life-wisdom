/**
 * Phase 5: notifications — privacy (RLS), instant alerts, scheduled reminders.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { addDays } from '../../src/lib/dates'
import { adminClient, createFamily, createUser, type TestUser } from './helpers'

let mum: TestUser
let kid: TestUser
let other: TestUser
let famA: { id: string; code: string }
let famB: { id: string; code: string }
let today: string
const admin = () => adminClient()

/** Run the reminder job as if it were a given London wall-clock time. */
async function runJobAt(date: string, time: string) {
  const { data, error } = await admin().rpc('generate_due_notifications', { p_now: `${date} ${time}:00 Europe/London`, p_window: '10 minutes' })
  if (error) throw error
  return data as number
}
async function notificationsFor(u: TestUser, kind?: string) {
  let q = u.client.from('notifications').select('*').eq('family_id', famA.id).order('created_at')
  if (kind) q = q.eq('kind', kind)
  const { data } = await q
  return data ?? []
}

beforeAll(async () => {
  ;[mum, kid, other] = await Promise.all([createUser('Mum'), createUser('Kid'), createUser('Other')])
  famA = await createFamily(mum, 'Family A')
  famB = await createFamily(other, 'Family B')
  await kid.client.rpc('join_family', { p_code: famA.code })
  today = (await mum.client.rpc('family_today', { fid: famA.id })).data as string
})

describe('instant alerts', () => {
  it('giving someone a chore notifies them (not the person who gave it)', async () => {
    await mum.client.rpc('create_task', { p_family: famA.id, p_data: { title: 'Tidy room', emoji: '🧸', repeat: 'daily' } as never, p_assignees: [kid.id, mum.id] })
    const kidN = await notificationsFor(kid, 'task_assigned')
    expect(kidN.map((n) => n.title)).toEqual(['Mum gave you a chore: 🧸 Tidy room'])
    expect(await notificationsFor(mum, 'task_assigned')).toEqual([])
  })

  it('adding someone to an event notifies them', async () => {
    await mum.client.rpc('create_event', { p_family: famA.id, p_data: { title: 'Swimming', start_date: addDays(today, 2), all_day: false, start_time: '17:00' } as never, p_attendees: [kid.id] })
    const n = await notificationsFor(kid, 'event_invited')
    expect(n[0].title).toBe('Mum added you to: 📅 Swimming')
    expect(n[0].body).toMatch(/at 5pm$/)
  })

  it('respects "new chores and events" being switched off', async () => {
    await kid.client.from('notification_prefs').upsert({ user_id: kid.id, family_id: famA.id, assignment_alerts: false })
    await mum.client.rpc('create_task', { p_family: famA.id, p_data: { title: 'Quiet chore' } as never, p_assignees: [kid.id] })
    expect((await notificationsFor(kid, 'task_assigned')).map((n) => n.title)).not.toContain('Mum gave you a chore: ✅ Quiet chore')
    await kid.client.from('notification_prefs').upsert({ user_id: kid.id, family_id: famA.id, assignment_alerts: true })
  })
})

describe('notification privacy', () => {
  it('nobody else can read your notifications — not your family, not other families', async () => {
    const mine = await notificationsFor(kid)
    expect(mine.length).toBeGreaterThan(0)
    const ids = mine.map((n) => n.id)
    expect((await mum.client.from('notifications').select('*').in('id', ids)).data).toEqual([])
    expect((await other.client.from('notifications').select('*').in('id', ids)).data).toEqual([])
  })

  it('notifications cannot be created or forged directly', async () => {
    const { error } = await mum.client.from('notifications').insert({ family_id: famA.id, user_id: kid.id, kind: 'test', title: 'Fake' })
    expect(error).not.toBeNull()
  })

  it('you can mark your own as read but not change what they say', async () => {
    const [n] = await notificationsFor(kid)
    await kid.client.from('notifications').update({ read_at: new Date().toISOString(), title: 'Changed', user_id: mum.id }).eq('id', n.id)
    const { data } = await kid.client.from('notifications').select('title, read_at, user_id').eq('id', n.id).single()
    expect(data!.title).toBe(n.title)
    expect(data!.user_id).toBe(kid.id)
    expect(data!.read_at).not.toBeNull()
  })

  it('signed-in users cannot run the reminder job', async () => {
    expect((await mum.client.rpc('generate_due_notifications' as never)).error).not.toBeNull()
  })

  it('push subscriptions are private to each person, and must be https', async () => {
    const sub = { user_id: kid.id, endpoint: `https://push.example.com/${crypto.randomUUID()}`, p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) }
    expect((await kid.client.from('push_subscriptions').insert(sub)).error).toBeNull()
    expect((await mum.client.from('push_subscriptions').select('*').eq('user_id', kid.id)).data).toEqual([])
    expect((await other.client.from('push_subscriptions').select('*')).data).toEqual([])
    expect((await mum.client.from('push_subscriptions').insert({ ...sub, user_id: kid.id, endpoint: 'https://evil.example/1' })).error).not.toBeNull()
    expect((await kid.client.from('push_subscriptions').insert({ ...sub, endpoint: 'http://insecure.example/1' })).error).not.toBeNull()
  })

  it('preferences are private', async () => {
    expect((await mum.client.from('notification_prefs').select('*').eq('user_id', kid.id)).data).toEqual([])
    expect((await mum.client.from('notification_prefs').upsert({ user_id: kid.id, family_id: famA.id, daily_summary: false })).error).not.toBeNull()
  })

  it('test notifications only work in your own family', async () => {
    expect((await other.client.rpc('send_test_notification', { p_family: famA.id })).error).not.toBeNull()
    expect((await kid.client.rpc('send_test_notification', { p_family: famA.id })).error).toBeNull()
  })
})

describe('scheduled reminders', () => {
  let fish: string
  beforeAll(async () => {
    const { data } = await mum.client.rpc('create_task', {
      p_family: famA.id,
      p_data: { title: 'Feed the fish', emoji: '🐟', repeat: 'daily', start_date: today, due_time: '07:30', reminder_minutes: 10 } as never,
      p_assignees: [kid.id],
    })
    fish = data as string
  })

  it('sends a chore reminder at the right minute, once', async () => {
    await runJobAt(today, '07:15')
    expect((await notificationsFor(kid, 'task_reminder')).filter((n) => n.title.includes('Feed the fish'))).toHaveLength(0)
    await runJobAt(today, '07:21')
    await runJobAt(today, '07:22') // a second run must not duplicate it
    const r = (await notificationsFor(kid, 'task_reminder')).filter((n) => n.title.includes('Feed the fish'))
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ title: '⏰ 🐟 Feed the fish', body: 'Due today at 7:30am', link: `/tasks?view=day&date=${today}` })
  })

  it('does not remind about a chore that is already done', async () => {
    const { data: plants } = await mum.client.rpc('create_task', {
      p_family: famA.id,
      p_data: { title: 'Water plants', emoji: '🪴', repeat: 'daily', start_date: today, due_time: '18:00', reminder_minutes: 10 } as never,
      p_assignees: [kid.id],
    })
    const { error } = await kid.client.from('task_completions').insert({ task_id: plants as string, family_id: famA.id, occurrence_date: today, for_user: kid.id })
    expect(error).toBeNull()
    await runJobAt(today, '17:51')
    expect((await notificationsFor(kid, 'task_reminder')).filter((n) => n.title.includes('Water plants'))).toHaveLength(0)
  })

  it('sends event reminders to attendees, and never includes encrypted text', async () => {
    const day = addDays(today, 3)
    await mum.client.rpc('create_event', {
      p_family: famA.id,
      p_data: { title: 'Dentist', start_date: day, all_day: false, start_time: '15:30', reminder_minutes: 1440, location: 'enc:secret-ciphertext' } as never,
      p_attendees: [kid.id],
    })
    await runJobAt(addDays(day, -1), '15:31')
    const r = (await notificationsFor(kid, 'event_reminder')).find((n) => n.title.includes('Dentist'))!
    expect(r.body).toBe('Tomorrow at 3:30pm')
    expect(JSON.stringify(r)).not.toContain('enc:')
    expect((await notificationsFor(mum, 'event_reminder')).find((n) => n.title.includes('Dentist'))).toBeUndefined()
  })

  it('sends a daily summary at each person’s chosen time', async () => {
    await mum.client.from('notification_prefs').upsert({ user_id: mum.id, family_id: famA.id, daily_summary: true, daily_summary_time: '06:45' })
    await mum.client.from('meal_plans').insert({ family_id: famA.id, plan_date: today, slot: 'dinner', custom_title: 'Pizza night', created_by: mum.id })
    await runJobAt(today, '06:46')
    const s = await notificationsFor(mum, 'daily_summary')
    expect(s).toHaveLength(1)
    expect(s[0].body).toMatch(/chore.*Dinner: Pizza night/)
    // Kid keeps the default 07:30 — nothing yet at 06:46
    expect(await notificationsFor(kid, 'daily_summary')).toHaveLength(0)
  })

  it('respects chore reminders being switched off', async () => {
    await kid.client.from('notification_prefs').upsert({ user_id: kid.id, family_id: famA.id, task_reminders: false })
    const day = addDays(today, 4)
    await runJobAt(day, '07:21')
    expect((await notificationsFor(kid, 'task_reminder')).filter((n) => n.link.endsWith(day))).toHaveLength(0)
  })
})
