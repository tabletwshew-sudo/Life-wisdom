import type { ReactNode } from 'react'

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <header className="mb-5 flex items-end gap-3">
      <div className="min-w-0 flex-1">
        {subtitle && <p className="text-sm font-semibold text-ink-3">{subtitle}</p>}
        <h1 className="truncate text-[2rem] leading-tight font-extrabold tracking-tight">{title}</h1>
      </div>
      {action}
    </header>
  )
}
