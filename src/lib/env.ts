/** Public (browser-safe) configuration. Secrets must never be read here. */
export const env = {
  supabaseUrl: (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? '',
  supabaseAnonKey: (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim() ?? '',
}

export const isConfigured = Boolean(env.supabaseUrl && env.supabaseAnonKey)
