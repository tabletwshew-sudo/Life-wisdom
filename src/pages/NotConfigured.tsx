/** Shown when the Supabase environment variables are missing (e.g. a fresh deploy). */
export default function NotConfigured() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="max-w-md rounded-3xl bg-card p-6 shadow-[var(--shadow-card)]">
        <p className="mb-2 text-4xl">🔧</p>
        <h1 className="mb-2 text-2xl font-extrabold">Almost there!</h1>
        <p className="text-ink-2">
          Family Hub isn’t connected to its database yet. Add <code className="rounded bg-card-2 px-1">VITE_SUPABASE_URL</code> and{' '}
          <code className="rounded bg-card-2 px-1">VITE_SUPABASE_ANON_KEY</code> in your hosting settings (see the README, step 3), then redeploy.
        </p>
      </div>
    </div>
  )
}
