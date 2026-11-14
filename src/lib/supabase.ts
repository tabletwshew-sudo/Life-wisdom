import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import { env, isConfigured } from './env'

export const supabase = createClient<Database>(
  isConfigured ? env.supabaseUrl : 'http://localhost:54321',
  isConfigured ? env.supabaseAnonKey : 'not-configured',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'fh-auth',
    },
  },
)
