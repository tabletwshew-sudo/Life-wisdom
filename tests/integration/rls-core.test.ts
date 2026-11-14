/**
 * Row Level Security tests for Phase 1 tables.
 * Proves one family can never see or change another family's data.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { anonClient, createFamily, createUser, type TestUser } from './helpers'

let alice: TestUser // admin of family A
let bob: TestUser // admin of family B
let carol: TestUser // member (kid) of family A
let famA: { id: string; code: string }
let famB: { id: string; code: string }

beforeAll(async () => {
  ;[alice, bob, carol] = await Promise.all([createUser('Alice'), createUser('Bob'), createUser('Carol')])
  famA = await createFamily(alice, 'Family A')
  famB = await createFamily(bob, 'Family B')
  const { data, error } = await carol.client.rpc('join_family', { p_code: famA.code })
  expect(error).toBeNull()
  expect(data).toBe(famA.id)
})

describe('signed-out visitors', () => {
  it('cannot read any table', async () => {
    const anon = anonClient()
    for (const table of ['families', 'family_members', 'profiles', 'family_invites'] as const) {
      const { data, error } = await anon.from(table).select('*')
      // Either a permission error or zero rows — never data.
      expect(error !== null || (data ?? []).length === 0, table).toBe(true)
    }
  })

  it('cannot call membership functions', async () => {
    const { error } = await anonClient().rpc('join_family', { p_code: famA.code })
    expect(error).not.toBeNull()
  })
})

describe('cross-family isolation', () => {
  it('Bob cannot see Family A', async () => {
    const { data } = await bob.client.from('families').select('*')
    expect(data!.map((f) => f.id)).toEqual([famB.id])
  })

  it('Bob cannot see Family A members or profiles', async () => {
    const { data: members } = await bob.client.from('family_members').select('*').eq('family_id', famA.id)
    expect(members).toEqual([])
    const { data: profiles } = await bob.client.from('profiles').select('*').in('id', [alice.id, carol.id])
    expect(profiles).toEqual([])
  })

  it('Bob cannot read Family A invite code', async () => {
    const { data } = await bob.client.from('family_invites').select('*').eq('family_id', famA.id)
    expect(data).toEqual([])
  })

  it('Bob cannot rename or delete Family A', async () => {
    await bob.client.from('families').update({ name: 'Hacked' }).eq('id', famA.id)
    await bob.client.from('families').delete().eq('id', famA.id)
    const { data } = await alice.client.from('families').select('name').eq('id', famA.id).single()
    expect(data!.name).toBe('Family A')
  })

  it('Bob cannot insert himself into Family A directly', async () => {
    const { error } = await bob.client.from('family_members').insert({ family_id: famA.id, user_id: bob.id, role: 'admin' })
    expect(error).not.toBeNull()
  })

  it('Bob cannot use admin functions on Family A', async () => {
    expect((await bob.client.rpc('regenerate_invite_code', { p_family: famA.id })).error).not.toBeNull()
    expect((await bob.client.rpc('remove_member', { p_family: famA.id, p_user: carol.id })).error).not.toBeNull()
    expect((await bob.client.rpc('update_member', { p_family: famA.id, p_user: carol.id, p_role: 'admin' })).error).not.toBeNull()
    const { data } = await alice.client.from('family_members').select('user_id').eq('family_id', famA.id)
    expect(data).toHaveLength(2)
  })

  it('Bob cannot edit Alice’s profile', async () => {
    await bob.client.from('profiles').update({ display_name: 'Hacked' }).eq('id', alice.id)
    const { data } = await alice.client.from('profiles').select('display_name').eq('id', alice.id).single()
    expect(data!.display_name).toBe('Alice')
  })
})

describe('inside a family', () => {
  it('members can see each other', async () => {
    const { data } = await carol.client.from('family_members').select('user_id, role').eq('family_id', famA.id)
    expect(data!.map((m) => m.user_id).sort()).toEqual([alice.id, carol.id].sort())
    const { data: profiles } = await carol.client.from('profiles').select('display_name').eq('id', alice.id)
    expect(profiles).toEqual([{ display_name: 'Alice' }])
  })

  it('members (kids) cannot see the invite code', async () => {
    const { data } = await carol.client.from('family_invites').select('*')
    expect(data).toEqual([])
  })

  it('members cannot change family settings', async () => {
    await carol.client.from('families').update({ members_can_add_tasks: true }).eq('id', famA.id)
    const { data } = await alice.client.from('families').select('members_can_add_tasks').eq('id', famA.id).single()
    expect(data!.members_can_add_tasks).toBe(false)
  })

  it('members cannot promote themselves or remove others', async () => {
    expect((await carol.client.rpc('update_member', { p_family: famA.id, p_user: carol.id, p_role: 'admin' })).error).not.toBeNull()
    expect((await carol.client.rpc('remove_member', { p_family: famA.id, p_user: alice.id })).error).not.toBeNull()
  })

  it('members can change their own colour', async () => {
    const { error } = await carol.client.rpc('update_member', { p_family: famA.id, p_user: carol.id, p_colour: '#009E73' })
    expect(error).toBeNull()
  })

  it('admins can change family settings', async () => {
    const { error } = await alice.client.from('families').update({ points_enabled: false }).eq('id', famA.id)
    expect(error).toBeNull()
  })

  it('the last admin cannot demote themselves or leave a family with others in it', async () => {
    expect((await alice.client.rpc('update_member', { p_family: famA.id, p_user: alice.id, p_role: 'member' })).error?.message).toMatch(
      /at least one admin/,
    )
    expect((await alice.client.rpc('remove_member', { p_family: famA.id, p_user: alice.id })).error?.message).toMatch(/someone else an admin/)
  })
})

describe('invite codes', () => {
  it('a wrong code returns null and does not join', async () => {
    const dave = await createUser('Dave')
    const { data, error } = await dave.client.rpc('join_family', { p_code: 'ZZZZ2222' })
    expect(error).toBeNull()
    expect(data).toBeNull()
    expect((await dave.client.from('families').select('*')).data).toEqual([])
  })

  it('locks out after 10 wrong codes in an hour', async () => {
    const eve = await createUser('Eve')
    for (let i = 0; i < 10; i++) await eve.client.rpc('join_family', { p_code: 'WRONG' + i })
    const { error } = await eve.client.rpc('join_family', { p_code: famA.code })
    expect(error?.message).toMatch(/Too many wrong codes/)
  })

  it('a regenerated code stops the old one working', async () => {
    const { data: newCode } = await alice.client.rpc('regenerate_invite_code', { p_family: famA.id })
    expect(newCode).toMatch(/^[A-HJ-NP-Z2-9]{8}$/)
    const frank = await createUser('Frank')
    expect((await frank.client.rpc('join_family', { p_code: famA.code })).data).toBeNull()
    expect((await frank.client.rpc('join_family', { p_code: newCode! })).data).toBe(famA.id)
    famA.code = newCode!
  })
})

describe('input validation', () => {
  it('rejects an invalid colour', async () => {
    const { error } = await carol.client.rpc('update_member', { p_family: famA.id, p_user: carol.id, p_colour: 'red; drop table' })
    expect(error).not.toBeNull()
  })

  it('trims names and strips control characters', async () => {
    await alice.client.from('profiles').update({ display_name: '  Al\u0007ice  ' }).eq('id', alice.id)
    const { data } = await alice.client.from('profiles').select('display_name').eq('id', alice.id).single()
    expect(data!.display_name).toBe('Alice')
  })

  it('rejects an empty family name and an invalid time zone', async () => {
    expect((await bob.client.rpc('create_family', { p_name: '   ' })).error).not.toBeNull()
    expect((await bob.client.rpc('create_family', { p_name: 'X', p_timezone: 'Mars/Olympus' })).error).not.toBeNull()
  })
})
