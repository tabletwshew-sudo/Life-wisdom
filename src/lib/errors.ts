/** Turn Supabase / network errors into friendly sentences. */
export function friendlyError(err: unknown): string {
  const msg =
    typeof err === 'string'
      ? err
      : err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : ''
  if (!navigator.onLine) return 'You’re offline. Check your connection and try again.'
  if (/invalid login credentials/i.test(msg)) return 'Wrong email or password.'
  if (/user already registered/i.test(msg)) return 'There’s already an account with that email. Try signing in.'
  if (/email not confirmed/i.test(msg)) return 'Please confirm your email first (check your inbox).'
  if (/rate limit|too many/i.test(msg)) return msg || 'Too many attempts. Please wait a bit and try again.'
  if (/failed to fetch|network/i.test(msg)) return 'Can’t reach the server. Check your connection.'
  if (/password should be/i.test(msg)) return msg
  return msg || 'Something went wrong. Please try again.'
}
