import type { ReactNode } from 'react'

export function AuthLayout({ title, subtitle, children }: { title: string; subtitle?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-5 pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <img src="/logo.svg" alt="" className="mb-4 size-20 rounded-[1.4rem] shadow-lg" />
          <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
          {subtitle && <p className="mt-1.5 text-ink-3">{subtitle}</p>}
        </div>
        <div className="rounded-[1.75rem] bg-card p-5 shadow-[var(--shadow-card)] sm:p-6">{children}</div>
      </div>
    </div>
  )
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null
  return (
    <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:bg-red-950 dark:text-red-300">
      {message}
    </p>
  )
}

export const PENDING_INVITE_KEY = 'fh-pending-invite'
export function getPendingInvite(): string | null {
  try {
    return sessionStorage.getItem(PENDING_INVITE_KEY) || localStorage.getItem(PENDING_INVITE_KEY)
  } catch {
    return null
  }
}
export function setPendingInvite(code: string | null) {
  try {
    if (code) {
      sessionStorage.setItem(PENDING_INVITE_KEY, code)
      localStorage.setItem(PENDING_INVITE_KEY, code)
    } else {
      sessionStorage.removeItem(PENDING_INVITE_KEY)
      localStorage.removeItem(PENDING_INVITE_KEY)
    }
  } catch {
    /* ignore */
  }
}
