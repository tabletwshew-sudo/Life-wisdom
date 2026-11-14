/**
 * Phase 4: food — recipes, favourites, meal plans, shopping list and private
 * photo storage are isolated per family, with the right permissions.
 */
import { beforeAll, describe, expect, inject, it } from 'vitest'
import { createFamily, createUser, type TestUser } from './helpers'

let mum: TestUser
let kid: TestUser
let other: TestUser
let famA: { id: string; code: string }
let famB: { id: string; code: string }
let recipeA: string
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46, 0x49, 0x46, 0, 1, 0xff, 0xd9])

beforeAll(async () => {
  ;[mum, kid, other] = await Promise.all([createUser('Mum'), createUser('Kid'), createUser('Other')])
  famA = await createFamily(mum, 'Family A')
  famB = await createFamily(other, 'Family B')
  await kid.client.rpc('join_family', { p_code: famA.code })
  const { data, error } = await mum.client
    .from('recipes')
    .insert({ family_id: famA.id, created_by: mum.id, title: 'Secret sauce', ingredients: ['1 secret'], notes: 'Grandma’s recipe' })
    .select('id')
    .single()
  if (error) throw error
  recipeA = data.id
})

describe('food isolation between families', () => {
  it('another family cannot read recipes, favourites, meal plans or the shopping list', async () => {
    await mum.client.from('recipe_favourites').insert({ recipe_id: recipeA, user_id: mum.id, family_id: famA.id })
    await mum.client.from('meal_plans').insert({ family_id: famA.id, plan_date: '2026-11-20', slot: 'dinner', recipe_id: recipeA, created_by: mum.id })
    await mum.client.from('shopping_items').insert({ family_id: famA.id, name: 'Milk', added_by: mum.id })
    expect((await other.client.from('recipes').select('*').eq('family_id', famA.id)).data).toEqual([])
    expect((await other.client.from('recipe_favourites').select('*').eq('family_id', famA.id)).data).toEqual([])
    expect((await other.client.from('meal_plans').select('*').eq('family_id', famA.id)).data).toEqual([])
    expect((await other.client.from('shopping_items').select('*').eq('family_id', famA.id)).data).toEqual([])
  })

  it('another family cannot add to, tick, edit or delete family A’s things', async () => {
    expect((await other.client.from('recipes').insert({ family_id: famA.id, created_by: other.id, title: 'x' })).error).not.toBeNull()
    expect((await other.client.from('shopping_items').insert({ family_id: famA.id, name: 'x', added_by: other.id })).error).not.toBeNull()
    expect((await other.client.from('meal_plans').insert({ family_id: famA.id, plan_date: '2026-11-21', slot: 'dinner', custom_title: 'x', created_by: other.id })).error).not.toBeNull()
    expect((await other.client.from('recipe_favourites').insert({ recipe_id: recipeA, user_id: other.id, family_id: famB.id })).error).not.toBeNull()
    await other.client.from('shopping_items').update({ checked: true }).eq('family_id', famA.id)
    await other.client.from('recipes').update({ title: 'Hacked' }).eq('id', recipeA)
    await other.client.from('recipes').delete().eq('id', recipeA)
    const { data } = await mum.client.from('recipes').select('title').eq('id', recipeA).single()
    expect(data!.title).toBe('Secret sauce')
    const { data: milk } = await mum.client.from('shopping_items').select('checked').eq('family_id', famA.id)
    expect(milk!.every((i) => !i.checked)).toBe(true)
  })

  it('cannot plan another family’s recipe', async () => {
    const { error } = await other.client.from('meal_plans').insert({ family_id: famB.id, plan_date: '2026-11-21', slot: 'dinner', recipe_id: recipeA, created_by: other.id })
    expect(error).not.toBeNull()
  })
})

describe('private recipe photos', () => {
  it('family members can upload into their own family folder and read it', async () => {
    const path = `${famA.id}/test-${crypto.randomUUID()}.jpg`
    expect((await mum.client.storage.from('recipe-photos').upload(path, JPEG, { contentType: 'image/jpeg' })).error).toBeNull()
    const { data } = await kid.client.storage.from('recipe-photos').createSignedUrl(path, 60)
    expect(data?.signedUrl).toBeTruthy()
  })

  it('another family cannot read, list, upload into or delete family A photos', async () => {
    const path = `${famA.id}/private-${crypto.randomUUID()}.jpg`
    await mum.client.storage.from('recipe-photos').upload(path, JPEG, { contentType: 'image/jpeg' })
    const signed = await other.client.storage.from('recipe-photos').createSignedUrl(path, 60)
    expect(signed.data?.signedUrl ?? null).toBeNull()
    const download = await other.client.storage.from('recipe-photos').download(path)
    expect(download.data).toBeNull()
    const listed = await other.client.storage.from('recipe-photos').list(famA.id)
    expect(listed.data ?? []).toEqual([])
    expect((await other.client.storage.from('recipe-photos').upload(`${famA.id}/evil.jpg`, JPEG, { contentType: 'image/jpeg' })).error).not.toBeNull()
    await other.client.storage.from('recipe-photos').remove([path])
    expect((await mum.client.storage.from('recipe-photos').download(path)).data).not.toBeNull()
  })

  it('signed-out visitors cannot read photos (the bucket is private)', async () => {
    const path = `${famA.id}/anon-${crypto.randomUUID()}.jpg`
    await mum.client.storage.from('recipe-photos').upload(path, JPEG, { contentType: 'image/jpeg' })
    const base = inject('supabaseUrl')
    const pub = await fetch(`${base}/storage/v1/object/public/recipe-photos/${path}`)
    expect(pub.ok).toBe(false)
    const anonRead = await fetch(`${base}/storage/v1/object/recipe-photos/${path}`, { headers: { apikey: inject('anonKey') } })
    expect(anonRead.ok).toBe(false)
    // …while the family member can:
    const own = await mum.client.storage.from('recipe-photos').download(path)
    expect(own.data).not.toBeNull()
  })

  it('a recipe cannot point at a photo in another family’s folder', async () => {
    const { error } = await other.client.from('recipes').insert({ family_id: famB.id, created_by: other.id, title: 'x', photo_path: `${famA.id}/steal.jpg` })
    expect(error?.message).toMatch(/another family/)
  })
})

describe('permissions inside a family', () => {
  it('kids can tick shopping items, and the server records who ticked', async () => {
    const { data: item } = await mum.client.from('shopping_items').insert({ family_id: famA.id, name: 'Bread', added_by: mum.id }).select('id').single()
    expect((await kid.client.from('shopping_items').update({ checked: true, checked_by: mum.id }).eq('id', item!.id)).error).toBeNull()
    const { data } = await mum.client.from('shopping_items').select('checked, checked_by').eq('id', item!.id).single()
    expect(data).toEqual({ checked: true, checked_by: kid.id })
  })

  it('kids cannot add shopping items or recipes when an admin switches it off', async () => {
    await mum.client.from('families').update({ members_can_add_shopping: false, members_can_add_recipes: false }).eq('id', famA.id)
    expect((await kid.client.from('shopping_items').insert({ family_id: famA.id, name: 'Sweets', added_by: kid.id })).error).not.toBeNull()
    expect((await kid.client.from('recipes').insert({ family_id: famA.id, created_by: kid.id, title: 'Sweets' })).error).not.toBeNull()
    expect((await kid.client.from('meal_plans').insert({ family_id: famA.id, plan_date: '2026-11-22', slot: 'dinner', custom_title: 'Sweets', created_by: kid.id })).error).not.toBeNull()
    await mum.client.from('families').update({ members_can_add_shopping: true, members_can_add_recipes: true }).eq('id', famA.id)
  })

  it('kids cannot edit or delete recipes someone else added', async () => {
    await kid.client.from('recipes').update({ title: 'Mine now' }).eq('id', recipeA)
    await kid.client.from('recipes').delete().eq('id', recipeA)
    const { data } = await mum.client.from('recipes').select('title').eq('id', recipeA).single()
    expect(data!.title).toBe('Secret sauce')
  })

  it('favourites are personal: you can only star or unstar for yourself', async () => {
    expect((await kid.client.from('recipe_favourites').insert({ recipe_id: recipeA, user_id: mum.id, family_id: famA.id })).error).not.toBeNull()
    expect((await kid.client.from('recipe_favourites').insert({ recipe_id: recipeA, user_id: kid.id, family_id: famA.id })).error).toBeNull()
    await kid.client.from('recipe_favourites').delete().eq('recipe_id', recipeA).eq('user_id', mum.id)
    const { data } = await mum.client.from('recipe_favourites').select('user_id').eq('recipe_id', recipeA)
    expect(data!.map((f) => f.user_id).sort()).toEqual([mum.id, kid.id].sort())
  })

  it('only one meal per slot per day', async () => {
    await mum.client.from('meal_plans').insert({ family_id: famA.id, plan_date: '2026-11-23', slot: 'lunch', custom_title: 'Soup', created_by: mum.id })
    const { error } = await mum.client.from('meal_plans').insert({ family_id: famA.id, plan_date: '2026-11-23', slot: 'lunch', custom_title: 'Sandwiches', created_by: mum.id })
    expect(error).not.toBeNull()
  })
})

describe('validation', () => {
  it('rejects non-web links and cleans up lists', async () => {
    expect((await mum.client.from('recipes').insert({ family_id: famA.id, created_by: mum.id, title: 'x', source_url: 'javascript:alert(1)' })).error).not.toBeNull()
    const { data } = await mum.client
      .from('recipes')
      .insert({ family_id: famA.id, created_by: mum.id, title: '  Toast\u0008 ', ingredients: ['  bread ', '', '\u0007'], tags: ['Quick', 'quick'] })
      .select('title, ingredients, tags')
      .single()
    expect(data).toEqual({ title: 'Toast', ingredients: ['bread'], tags: ['quick'] })
  })
})
