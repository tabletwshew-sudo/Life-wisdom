/**
 * Phase 3: calendar events — isolation between families, permissions, validation.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { createFamily, createUser, type TestUser } from './helpers'

let mum: TestUser
let kid: TestUser
let other: TestUser
let famA: { id: string; code: string }
let famB: { id: string; code: string }
let party: string

async function newEvent(user: TestUser, family: string, data: Record<string, unknown>, attendees: string[] = []) {
  const { data: id, error } = await user.client.rpc('create_event', { p_family: family, p_data: data as never, p_attendees: attendees })
  if (error) throw error
  return id as string
}

beforeAll(async () => {
  ;[mum, kid, other] = await Promise.all([createUser('Mum'), createUser('Kid'), createUser('Other')])
  famA = await createFamily(mum, 'Family A')
  famB = await createFamily(other, 'Family B')
  await kid.client.rpc('join_family', { p_code: famA.code })
  party = await newEvent(
    mum,
    famA.id,
    { title: 'Secret party', start_date: '2026-12-05', end_date: '2026-12-05', all_day: false, start_time: '15:00', end_time: '17:00', location: '12 Hidden Lane', notes: 'Surprise!' },
    [kid.id],
  )
})

describe('event isolation between families', () => {
  it('another family cannot read events, attendees, exceptions or event types', async () => {
    expect((await other.client.from('events').select('*').eq('id', party)).data).toEqual([])
    expect((await other.client.from('event_attendees').select('*').eq('event_id', party)).data).toEqual([])
    expect((await other.client.from('event_exceptions').select('*').eq('event_id', party)).data).toEqual([])
    expect((await other.client.from('event_types').select('*').eq('family_id', famA.id)).data).toEqual([])
  })

  it('another family cannot create, edit, skip or delete family A events', async () => {
    expect((await other.client.rpc('create_event', { p_family: famA.id, p_data: { title: 'x' } as never })).error).not.toBeNull()
    expect((await other.client.rpc('update_event', { p_event: party, p_data: { title: 'Hacked' } as never })).error).not.toBeNull()
    expect((await other.client.from('event_exceptions').insert({ event_id: party, skip_date: '2026-12-05', family_id: famB.id })).error).not.toBeNull()
    await other.client.from('events').delete().eq('id', party)
    const { data } = await mum.client.from('events').select('title').eq('id', party).single()
    expect(data!.title).toBe('Secret party')
  })

  it('cannot invite someone from another family', async () => {
    const { error } = await mum.client.rpc('create_event', { p_family: famA.id, p_data: { title: 'x' } as never, p_attendees: [other.id] })
    expect(error).not.toBeNull()
  })

  it('cannot use another family’s event type', async () => {
    const { data: typesB } = await other.client.from('event_types').select('id').eq('family_id', famB.id).limit(1)
    const { error } = await mum.client.rpc('create_event', { p_family: famA.id, p_data: { title: 'x', type_id: typesB![0].id } as never })
    expect(error).not.toBeNull()
  })

  it('new families get default event types including Birthday', async () => {
    const { data } = await mum.client.from('event_types').select('name').eq('family_id', famA.id)
    expect(data!.map((t) => t.name)).toEqual(expect.arrayContaining(['Birthday', 'Party', 'School', 'Sport', 'Appointment']))
  })
})

describe('event permissions inside a family', () => {
  it('members can see events they are invited to', async () => {
    const { data } = await kid.client.from('events').select('title, event_attendees(user_id)').eq('id', party).single()
    expect(data!.title).toBe('Secret party')
    expect(data!.event_attendees).toEqual([{ user_id: kid.id }])
  })

  it('members cannot add events unless an admin allows it', async () => {
    expect((await kid.client.rpc('create_event', { p_family: famA.id, p_data: { title: 'Sleepover' } as never })).error).not.toBeNull()
    await mum.client.from('families').update({ members_can_add_events: true }).eq('id', famA.id)
    const { data: id, error } = await kid.client.rpc('create_event', { p_family: famA.id, p_data: { title: 'Sleepover' } as never })
    expect(error).toBeNull()
    // …and can then edit their own event, but not mum's
    expect((await kid.client.rpc('update_event', { p_event: id!, p_data: { title: 'Big sleepover' } as never })).error).toBeNull()
    expect((await kid.client.rpc('update_event', { p_event: party, p_data: { title: 'Nope' } as never })).error).not.toBeNull()
    await mum.client.from('families').update({ members_can_add_events: false }).eq('id', famA.id)
  })

  it('admins can skip one date of a repeating event', async () => {
    const id = await newEvent(mum, famA.id, { title: 'Football', start_date: '2026-11-03', repeat: 'weekly' })
    expect((await mum.client.from('event_exceptions').insert({ event_id: id, skip_date: '2026-11-10', family_id: famA.id })).error).toBeNull()
    expect((await kid.client.from('event_exceptions').insert({ event_id: id, skip_date: '2026-11-17', family_id: famA.id })).error).not.toBeNull()
  })
})

describe('event validation', () => {
  it('rejects an end before the start', async () => {
    const { error } = await mum.client.rpc('create_event', { p_family: famA.id, p_data: { title: 'x', start_date: '2026-12-05', end_date: '2026-12-01' } as never })
    expect(error).not.toBeNull()
  })

  it('rejects a timed event with an end time before its start time', async () => {
    const { error } = await mum.client.rpc('create_event', {
      p_family: famA.id,
      p_data: { title: 'x', start_date: '2026-12-05', end_date: '2026-12-05', all_day: false, start_time: '15:00', end_time: '14:00' } as never,
    })
    expect(error?.message).toMatch(/ends before it starts/)
  })

  it('clears times on all-day events and trims text', async () => {
    const id = await newEvent(mum, famA.id, { title: '  Inset\u0007 day  ', all_day: true, start_time: '09:00' })
    const { data } = await mum.client.from('events').select('title, start_time').eq('id', id).single()
    expect(data).toEqual({ title: 'Inset day', start_time: null })
  })
})
