/**
 * Phase 2: tasks — RLS isolation, who can tick what, and server-side rules.
 */
import pg from 'pg'
import { beforeAll, describe, expect, inject, it } from 'vitest'
import { occursOn, type Repeat } from '../../src/lib/tasks/recurrence'
import { addDays } from '../../src/lib/dates'
import { createFamily, createUser, type TestUser } from './helpers'

let mum: TestUser // admin, family A
let kid: TestUser // member, family A
let kid2: TestUser // member, family A
let other: TestUser // admin, family B
let famA: { id: string; code: string }
let famB: { id: string; code: string }
let today: string

async function newTask(user: TestUser, family: string, data: Record<string, unknown>, assignees: string[] = []) {
  const { data: id, error } = await user.client.rpc('create_task', { p_family: family, p_data: data as never, p_assignees: assignees })
  if (error) throw error
  return id as string
}

beforeAll(async () => {
  ;[mum, kid, kid2, other] = await Promise.all([createUser('Mum'), createUser('Kid'), createUser('Kid2'), createUser('Other')])
  famA = await createFamily(mum, 'Family A')
  famB = await createFamily(other, 'Family B')
  await kid.client.rpc('join_family', { p_code: famA.code })
  await kid2.client.rpc('join_family', { p_code: famA.code })
  const { data } = await mum.client.rpc('family_today', { fid: famA.id })
  today = data as string
})

describe('task isolation between families', () => {
  let taskA: string
  beforeAll(async () => {
    taskA = await newTask(mum, famA.id, { title: 'Secret chore', notes: 'private', repeat: 'daily', start_date: today }, [kid.id])
  })

  it('another family cannot read tasks, assignees, completions or categories', async () => {
    await kid.client.from('task_completions').insert({ task_id: taskA, occurrence_date: today, for_user: kid.id, family_id: famA.id })
    expect((await other.client.from('tasks').select('*').eq('id', taskA)).data).toEqual([])
    expect((await other.client.from('task_assignees').select('*').eq('task_id', taskA)).data).toEqual([])
    expect((await other.client.from('task_completions').select('*').eq('task_id', taskA)).data).toEqual([])
    expect((await other.client.from('categories').select('*').eq('family_id', famA.id)).data).toEqual([])
  })

  it('another family cannot create tasks in, edit, tick or delete family A tasks', async () => {
    expect((await other.client.rpc('create_task', { p_family: famA.id, p_data: { title: 'x' } as never })).error).not.toBeNull()
    expect((await other.client.rpc('update_task', { p_task: taskA, p_data: { title: 'Hacked' } as never })).error).not.toBeNull()
    await other.client.from('tasks').update({ title: 'Hacked' }).eq('id', taskA)
    expect((await other.client.from('task_completions').insert({ task_id: taskA, occurrence_date: today, for_user: null, family_id: famB.id })).error).not.toBeNull()
    expect((await other.client.rpc('delete_task', { p_task: taskA, p_keep_history: false })).error).toBeNull() // silently does nothing
    const { data } = await mum.client.from('tasks').select('title').eq('id', taskA).single()
    expect(data!.title).toBe('Secret chore')
  })

  it('cannot assign a task to someone outside the family', async () => {
    const { error } = await mum.client.rpc('create_task', { p_family: famA.id, p_data: { title: 'x' } as never, p_assignees: [other.id] })
    expect(error).not.toBeNull()
  })

  it('cannot use another family’s category', async () => {
    const { data: catsB } = await other.client.from('categories').select('id').eq('family_id', famB.id).limit(1)
    const { error } = await mum.client.rpc('create_task', { p_family: famA.id, p_data: { title: 'x', category_id: catsB![0].id } as never })
    expect(error).not.toBeNull()
  })

  it('new families get default categories', async () => {
    const { data } = await mum.client.from('categories').select('name').eq('family_id', famA.id)
    expect(data!.map((c) => c.name)).toContain('Chores')
  })
})

describe('members (kids) permissions', () => {
  let bed: string
  beforeAll(async () => {
    bed = await newTask(mum, famA.id, { title: 'Make the bed', repeat: 'daily', start_date: addDays(today, -3) }, [kid.id, kid2.id])
  })

  it('cannot create tasks unless an admin allows it', async () => {
    expect((await kid.client.rpc('create_task', { p_family: famA.id, p_data: { title: 'Kid task' } as never })).error).not.toBeNull()
    await mum.client.from('families').update({ members_can_add_tasks: true }).eq('id', famA.id)
    expect((await kid.client.rpc('create_task', { p_family: famA.id, p_data: { title: 'Kid task' } as never })).error).toBeNull()
    await mum.client.from('families').update({ members_can_add_tasks: false }).eq('id', famA.id)
  })

  it('cannot edit or delete tasks an admin made', async () => {
    expect((await kid.client.rpc('update_task', { p_task: bed, p_data: { title: 'Nope' } as never })).error).not.toBeNull()
    expect((await kid.client.rpc('delete_task', { p_task: bed, p_keep_history: false })).error).not.toBeNull()
  })

  it('can tick their own task but not their sibling’s', async () => {
    const mine = await kid.client.from('task_completions').insert({ task_id: bed, occurrence_date: today, for_user: kid.id, family_id: famA.id })
    expect(mine.error).toBeNull()
    const theirs = await kid.client.from('task_completions').insert({ task_id: bed, occurrence_date: today, for_user: kid2.id, family_id: famA.id })
    expect(theirs.error).not.toBeNull()
  })

  it('cannot untick someone else’s tick; admins can tick for anyone', async () => {
    const admin = await mum.client.from('task_completions').insert({ task_id: bed, occurrence_date: today, for_user: kid2.id, family_id: famA.id })
    expect(admin.error).toBeNull()
    await kid.client.from('task_completions').delete().eq('task_id', bed).eq('for_user', kid2.id)
    const { data } = await mum.client.from('task_completions').select('id').eq('task_id', bed).eq('for_user', kid2.id)
    expect(data).toHaveLength(1)
  })

  it('records who completed it and when (set by the server, not the client)', async () => {
    const { data } = await mum.client.from('task_completions').select('completed_by, completed_at, points').eq('task_id', bed).eq('for_user', kid.id).single()
    expect(data!.completed_by).toBe(kid.id)
    expect(Date.now() - new Date(data!.completed_at).getTime()).toBeLessThan(60_000)
    expect(data!.points).toBe(1)
  })
})

describe('server-side completion rules', () => {
  let weekly: string
  beforeAll(async () => {
    weekly = await newTask(mum, famA.id, { title: 'Bins', repeat: 'weekly', start_date: addDays(today, -7), completion_mode: 'any' }, [])
  })

  it('cannot tick a day the task is not due', async () => {
    const { error } = await mum.client.from('task_completions').insert({ task_id: weekly, occurrence_date: addDays(today, -1), family_id: famA.id })
    expect(error?.message).toMatch(/not due/)
  })

  it('cannot tick a future day', async () => {
    const { error } = await mum.client.from('task_completions').insert({ task_id: weekly, occurrence_date: addDays(today, 7), family_id: famA.id })
    expect(error?.message).toMatch(/future/)
  })

  it("'any' mode: one shared tick, can't be ticked twice", async () => {
    expect((await kid.client.from('task_completions').insert({ task_id: weekly, occurrence_date: today, family_id: famA.id })).error).toBeNull()
    expect((await kid2.client.from('task_completions').insert({ task_id: weekly, occurrence_date: today, family_id: famA.id })).error).not.toBeNull()
  })

  it('ticking today does not tick last week (independent instances)', async () => {
    const { data } = await mum.client.from('task_completions').select('occurrence_date').eq('task_id', weekly)
    expect(data!.map((d) => d.occurrence_date)).toEqual([today])
  })
})

describe('unassigned tasks', () => {
  it('anyone in the family can tick a task assigned to nobody', async () => {
    const id = await newTask(mum, famA.id, { title: 'Tidy lounge', repeat: 'daily', start_date: today }, [])
    const { error } = await kid2.client.from('task_completions').insert({ task_id: id, occurrence_date: today, family_id: famA.id })
    expect(error).toBeNull()
  })
})

describe('editing keeps history', () => {
  it('changing the schedule splits the series so past days keep their ticks and crosses', async () => {
    const start = addDays(today, -5)
    const id = await newTask(mum, famA.id, { title: 'Read', repeat: 'daily', start_date: start }, [kid.id])
    await kid.client.from('task_completions').insert({ task_id: id, occurrence_date: addDays(today, -2), for_user: kid.id, family_id: famA.id })
    const { data: newId, error } = await mum.client.rpc('update_task', { p_task: id, p_data: { repeat: 'weekdays', repeat_days: [1, 3, 5] } as never })
    expect(error).toBeNull()
    expect(newId).not.toBe(id)
    const { data: old } = await mum.client.from('tasks').select('repeat, repeat_until').eq('id', id).single()
    expect(old).toEqual({ repeat: 'daily', repeat_until: addDays(today, -1) })
    const { data: fresh } = await mum.client.from('tasks').select('repeat, start_date, task_assignees(user_id)').eq('id', newId!).single()
    expect(fresh!.repeat).toBe('weekdays')
    expect(fresh!.start_date).toBe(today)
    expect(fresh!.task_assignees).toEqual([{ user_id: kid.id }])
    const { data: ticks } = await mum.client.from('task_completions').select('task_id').eq('occurrence_date', addDays(today, -2)).eq('for_user', kid.id)
    expect(ticks!.some((t) => t.task_id === id)).toBe(true)
  })

  it('changing only the title does not split', async () => {
    const id = await newTask(mum, famA.id, { title: 'Old name', repeat: 'daily', start_date: addDays(today, -5) })
    const { data: same } = await mum.client.rpc('update_task', { p_task: id, p_data: { title: 'New name' } as never })
    expect(same).toBe(id)
  })

  it('deleting with keep-history ends the series yesterday', async () => {
    const id = await newTask(mum, famA.id, { title: 'Water plants', repeat: 'daily', start_date: addDays(today, -3) })
    await mum.client.rpc('delete_task', { p_task: id, p_keep_history: true })
    const { data } = await mum.client.from('tasks').select('repeat_until, archived_at').eq('id', id).single()
    expect(data!.repeat_until).toBe(addDays(today, -1))
    expect(data!.archived_at).not.toBeNull()
  })
})

describe('NEW tracking (seen_items)', () => {
  it('people can only record and read their own "seen" marks', async () => {
    const id = await newTask(mum, famA.id, { title: 'Seen test' }, [kid.id])
    expect((await kid.client.rpc('mark_seen', { p_family: famA.id, p_type: 'task', p_ids: [id] })).error).toBeNull()
    expect((await kid2.client.from('seen_items').select('*').eq('item_id', id)).data).toEqual([])
    expect((await kid.client.from('seen_items').select('item_id').eq('item_id', id)).data).toEqual([{ item_id: id }])
    expect((await other.client.rpc('mark_seen', { p_family: famA.id, p_type: 'task', p_ids: [id] })).error).not.toBeNull()
  })
})

describe('recurrence: database and app agree', () => {
  it('public.occurs_on() matches occursOn() for every rule over 3 years', async () => {
    const cases: { repeat: Repeat; start: string; days?: number[] }[] = [
      { repeat: 'once', start: '2026-03-15' },
      { repeat: 'daily', start: '2026-03-15' },
      { repeat: 'weekdays', start: '2026-03-15', days: [1, 3, 5] },
      { repeat: 'weekdays', start: '2026-03-15', days: [0, 6] },
      { repeat: 'weekly', start: '2026-03-15' },
      { repeat: 'fortnightly', start: '2026-03-16' },
      { repeat: 'monthly', start: '2026-01-31' },
      { repeat: 'monthly', start: '2026-02-28' },
      { repeat: 'yearly', start: '2024-02-29' },
    ]
    const db = new pg.Client({ connectionString: inject('dbUrl') })
    await db.connect()
    try {
      for (const c of cases) {
        const { rows } = await db.query<{ d: string; yes: boolean }>(
          `select to_char(d, 'YYYY-MM-DD') as d, public.occurs_on($1, $2::smallint[], $3::date, null, d::date) as yes
             from generate_series('2026-01-01'::date, '2028-12-31'::date, '1 day') d`,
          [c.repeat, c.days ?? [], c.start],
        )
        expect(rows).toHaveLength(1096)
        for (const r of rows) {
          const expected = occursOn({ repeat: c.repeat, repeatDays: c.days ?? [], startDate: c.start, repeatUntil: null }, r.d)
          if (r.yes !== expected) throw new Error(`${c.repeat} from ${c.start} disagrees on ${r.d}: db=${r.yes} app=${expected}`)
        }
      }
    } finally {
      await db.end()
    }
  })
})
