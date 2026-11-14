/**
 * Phase 6: end-to-end encryption — key privacy (RLS) and that the server only
 * ever stores ciphertext, unchanged.
 */
import pg from 'pg'
import { beforeAll, describe, expect, inject, it } from 'vitest'
import {
  decryptText,
  encryptText,
  generateFamilyKey,
  generateRecoveryCode,
  generateUserKeys,
  unwrapFamilyKey,
  unwrapWithRecoveryCode,
  wrapFamilyKeyFor,
  wrapWithRecoveryCode,
} from '../../src/lib/crypto/e2ee'
import { createFamily, createUser, type TestUser } from './helpers'

const FAST = 100_000 // fewer PBKDF2 rounds to keep tests quick (the app uses 600,000)
let mum: TestUser
let kid: TestUser
let other: TestUser
let famA: { id: string; code: string }
let _famB: { id: string; code: string }
let familyKey: CryptoKey
const keys: Record<string, Awaited<ReturnType<typeof generateUserKeys>>> = {}

async function publishKeys(u: TestUser, password: string) {
  const k = await generateUserKeys(password, FAST)
  keys[u.id] = k
  expect((await u.client.from('user_private_keys').insert({ user_id: u.id, ...k.wrapped })).error).toBeNull()
  expect((await u.client.from('user_public_keys').insert({ user_id: u.id, public_key: k.publicKey })).error).toBeNull()
}

beforeAll(async () => {
  ;[mum, kid, other] = await Promise.all([createUser('Mum'), createUser('Kid'), createUser('Other')])
  famA = await createFamily(mum, 'Family A')
  _famB = await createFamily(other, 'Family B')
  await kid.client.rpc('join_family', { p_code: famA.code })
  await publishKeys(mum, 'mum-password')
  await publishKeys(kid, 'kid-password')
  await publishKeys(other, 'other-password')
  familyKey = await generateFamilyKey()
  const wrappedForMum = await wrapFamilyKeyFor(familyKey, keys[mum.id].publicKey)
  expect((await mum.client.from('family_keys').insert({ family_id: famA.id, user_id: mum.id, wrapped_key: wrappedForMum, wrapped_by: mum.id })).error).toBeNull()
})

describe('key privacy', () => {
  it('nobody else can read your (password-locked) private key — not even your family’s admin', async () => {
    expect((await kid.client.from('user_private_keys').select('*').eq('user_id', kid.id)).data).toHaveLength(1)
    expect((await mum.client.from('user_private_keys').select('*').eq('user_id', kid.id)).data).toEqual([])
    expect((await other.client.from('user_private_keys').select('*').eq('user_id', kid.id)).data).toEqual([])
  })

  it('public keys are visible to your family only, and only you can replace yours', async () => {
    expect((await mum.client.from('user_public_keys').select('user_id').eq('user_id', kid.id)).data).toHaveLength(1)
    expect((await other.client.from('user_public_keys').select('user_id').eq('user_id', kid.id)).data).toEqual([])
    await mum.client.from('user_public_keys').update({ public_key: keys[mum.id].publicKey }).eq('user_id', kid.id)
    const { data } = await kid.client.from('user_public_keys').select('public_key').eq('user_id', kid.id).single()
    expect(data!.public_key).toBe(keys[kid.id].publicKey)
  })

  it('only admins can share the family key, and only with family members', async () => {
    const forKid = await wrapFamilyKeyFor(familyKey, keys[kid.id].publicKey)
    // A member can't hand out keys (not even to themselves)
    expect((await kid.client.from('family_keys').insert({ family_id: famA.id, user_id: kid.id, wrapped_key: forKid, wrapped_by: kid.id })).error).not.toBeNull()
    // Another family's admin can't put keys into our family
    expect((await other.client.from('family_keys').insert({ family_id: famA.id, user_id: other.id, wrapped_key: forKid, wrapped_by: other.id })).error).not.toBeNull()
    // Our admin can't share with an outsider
    const forOther = await wrapFamilyKeyFor(familyKey, keys[other.id].publicKey)
    expect((await mum.client.from('family_keys').insert({ family_id: famA.id, user_id: other.id, wrapped_key: forOther, wrapped_by: mum.id })).error).not.toBeNull()
    // Our admin shares with the kid
    expect((await mum.client.from('family_keys').insert({ family_id: famA.id, user_id: kid.id, wrapped_key: forKid, wrapped_by: mum.id })).error).toBeNull()
  })

  it('members see only their own copy; other families see nothing', async () => {
    const mine = await kid.client.from('family_keys').select('user_id').eq('family_id', famA.id)
    expect(mine.data).toEqual([{ user_id: kid.id }])
    expect((await other.client.from('family_keys').select('*').eq('family_id', famA.id)).data).toEqual([])
  })

  it('the recovery copy is for admins only', async () => {
    const code = generateRecoveryCode()
    const w = await wrapWithRecoveryCode(familyKey, code, FAST)
    expect((await kid.client.from('family_recovery').insert({ family_id: famA.id, created_by: kid.id, ...w })).error).not.toBeNull()
    expect((await mum.client.from('family_recovery').insert({ family_id: famA.id, created_by: mum.id, ...w })).error).toBeNull()
    expect((await kid.client.from('family_recovery').select('*').eq('family_id', famA.id)).data).toEqual([])
    expect((await other.client.from('family_recovery').select('*').eq('family_id', famA.id)).data).toEqual([])
    const { data } = await mum.client.from('family_recovery').select('wrapped_key, salt, iv, iterations').eq('family_id', famA.id).single()
    const recovered = await unwrapWithRecoveryCode(data!, code)
    const c = await encryptText(familyKey, 'ok', 'tasks.notes')
    expect(await decryptText(recovered, c, 'tasks.notes')).toBe('ok')
  })
})

describe('the server only ever stores ciphertext', () => {
  it('a kid can read an encrypted note the admin wrote (key shared via their public key)', async () => {
    const secret = 'Spare key is under the blue pot 🔑'
    const notes = await encryptText(familyKey, secret, 'tasks.notes')
    const { data: id, error } = await mum.client.rpc('create_task', { p_family: famA.id, p_data: { title: 'Let the dog out', notes } as never, p_assignees: [kid.id] })
    expect(error).toBeNull()
    // Kid: fetch own wrapped family key, unlock it, decrypt the note
    const { data: row } = await kid.client.from('family_keys').select('wrapped_key').eq('family_id', famA.id).eq('user_id', kid.id).single()
    const kidFamilyKey = await unwrapFamilyKey(row!.wrapped_key, keys[kid.id].privateKey)
    const { data: task } = await kid.client.from('tasks').select('notes').eq('id', id as string).single()
    expect(await decryptText(kidFamilyKey, task!.notes, 'tasks.notes')).toBe(secret)
  })

  it('the database holds no plaintext, and long ciphertext is stored byte-for-byte', async () => {
    const long = 'Pick up the cake from the bakery ' + 'あ'.repeat(1960) // 2,000 characters (the app's limit) of 3-byte text
    const notes = await encryptText(familyKey, long, 'events.notes')
    const location = await encryptText(familyKey, '12 Hidden Lane', 'events.location')
    expect(notes.length).toBeGreaterThan(6000)
    const { data: id, error } = await mum.client.rpc('create_event', { p_family: famA.id, p_data: { title: 'Party', notes, location } as never })
    expect(error).toBeNull()
    const db = new pg.Client({ connectionString: inject('dbUrl') })
    await db.connect()
    try {
      const { rows } = await db.query('select notes, location from public.events where id = $1', [id])
      expect(rows[0].notes).toBe(notes)
      expect(rows[0].location).toBe(location)
      const leak = await db.query(`select count(*)::int as n from public.events where family_id = $1 and (notes like '%bakery%' or location like '%Hidden%')`, [famA.id])
      expect(leak.rows[0].n).toBe(0)
    } finally {
      await db.end()
    }
  })

  it('ciphertext survives editing a repeating chore (series split)', async () => {
    const notes = await encryptText(familyKey, 'Feed 2 scoops', 'tasks.notes')
    const { data: today } = await mum.client.rpc('family_today', { fid: famA.id })
    const start = new Date(new Date(today as string).getTime() - 3 * 86400000).toISOString().slice(0, 10)
    const { data: id } = await mum.client.rpc('create_task', { p_family: famA.id, p_data: { title: 'Feed cat', repeat: 'daily', start_date: start, notes } as never })
    const { data: newId } = await mum.client.rpc('update_task', { p_task: id as string, p_data: { repeat: 'weekly' } as never })
    const { data } = await mum.client.from('tasks').select('notes').eq('id', newId as string).single()
    expect(await decryptText(familyKey, data!.notes, 'tasks.notes')).toBe('Feed 2 scoops')
  })

  it('removing someone from the family deletes their copy of the key', async () => {
    const leaver = await createUser('Leaver')
    await leaver.client.rpc('join_family', { p_code: famA.code })
    await publishKeys(leaver, 'leaver-pw')
    await mum.client.from('family_keys').insert({ family_id: famA.id, user_id: leaver.id, wrapped_key: await wrapFamilyKeyFor(familyKey, keys[leaver.id].publicKey), wrapped_by: mum.id })
    expect((await leaver.client.from('family_keys').select('user_id').eq('family_id', famA.id)).data).toHaveLength(1)
    await mum.client.rpc('remove_member', { p_family: famA.id, p_user: leaver.id })
    expect((await mum.client.from('family_keys').select('user_id').eq('user_id', leaver.id)).data).toEqual([])
  })
})
