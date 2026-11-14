import type { ReactNode } from 'react'
import { Bell } from '@/features/notifications/Bell'

/** Big iOS-style page title. On phones the notification bell sits top-right. */
export function PageHeader({ title, subtitle, action, bell = true }: { title: string; subtitle?: ReactNode; action?: ReactNode; bell?: boolean }) {
  return (
    <header className="mb-5 flex items-end gap-3">
      <div className="min-w-0 flex-1">
        {subtitle && <p className="text-sm font-semibold text-ink-3">{subtitle}</p>}
        <h1 className="truncate text-[2rem] leading-tight font-extrabold tracking-tight">{title}</h1>
      </div>
      {action}
      {bell && <Bell className="self-start md:hidden" />}
    </header>
  )
}
