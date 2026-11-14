import { execSync } from 'node:child_process'
import type { TestProject } from 'vitest/node'

/** Reads URL + keys from the running local Supabase so nothing is hard-coded. */
export default function setup(project: TestProject) {
  let status: Record<string, string>
  try {
    status = JSON.parse(execSync('npx supabase status -o json', { stdio: ['ignore', 'pipe', 'ignore'] }).toString())
  } catch {
    throw new Error('Local Supabase is not running. Start it with: npx supabase start')
  }
  project.provide('supabaseUrl', status.API_URL)
  project.provide('anonKey', status.PUBLISHABLE_KEY || status.ANON_KEY)
  project.provide('serviceKey', status.SECRET_KEY || status.SERVICE_ROLE_KEY)
}

declare module 'vitest' {
  export interface ProvidedContext {
    supabaseUrl: string
    anonKey: string
    serviceKey: string
  }
}
