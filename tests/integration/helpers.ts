import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { inject } from 'vitest'
import type { Database } from '../../src/lib/database.types'

export type Client = SupabaseClient<Database>

const url = () => inject('supabaseUrl')
const opts = { auth: { persistSession: false, autoRefreshToken: false } }

export const anonClient = (): Client => createClient<Database>(url(), inject('anonKey'), opts)
export const adminClient = (): Client => createClient<Database>(url(), inject('serviceKey'), opts)

export interface TestUser {
  id: string
  email: string
  client: Client
}

/** Creates a confirmed user and returns a client signed in as them. */
export async function createUser(name: string): Promise<TestUser> {
  const email = `${name.toLowerCase()}-${crypto.randomUUID().slice(0, 8)}@test.familyhub.local`
  const password = 'correct-horse-battery'
  const admin = adminClient()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: name },
  })
  if (error) throw error
  const client = anonClient()
  const { error: e2 } = await client.auth.signInWithPassword({ email, password })
  if (e2) throw e2
  return { id: data.user.id, email, client }
}

export async function createFamily(user: TestUser, name: string): Promise<{ id: string; code: string }> {
  const { data: id, error } = await user.client.rpc('create_family', { p_name: name, p_colour: '#0072B2', p_timezone: 'Europe/London' })
  if (error) throw error
  const { data, error: e2 } = await user.client.from('family_invites').select('code').eq('family_id', id!).single()
  if (e2) throw e2
  return { id: id!, code: data.code }
}
