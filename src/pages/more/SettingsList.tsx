import clsx from 'clsx'
import { ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card, SectionTitle } from '@/components/ui/Card'

export function SettingsGroup({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="mb-5">
      {title && <SectionTitle>{title}</SectionTitle>}
      <Card className="divide-y divide-line overflow-hidden">{children}</Card>
    </section>
  )
}

interface RowProps {
  icon: ReactNode
  iconBg: string
  label: string
  detail?: ReactNode
  to?: string
  onClick?: () => void
  danger?: boolean
  badge?: string
}

export function SettingsRow({ icon, iconBg, label, detail, to, onClick, danger, badge }: RowProps) {
  const inner = (
    <>
      <span className={clsx('flex size-9 shrink-0 items-center justify-center rounded-xl text-white', iconBg)} aria-hidden>
        {icon}
      </span>
      <span className={clsx('flex-1 text-left font-medium', danger && 'text-red-600 dark:text-red-400')}>{label}</span>
      {badge && <span className="rounded-full bg-card-2 px-2 py-0.5 text-xs font-semibold text-ink-3">{badge}</span>}
      {detail && <span className="max-w-[40%] truncate text-ink-3">{detail}</span>}
      {(to || onClick) && !danger && <ChevronRight className="size-5 text-ink-3" aria-hidden />}
    </>
  )
  const cls = 'flex min-h-14 w-full items-center gap-3 px-4 py-2 transition hover:bg-card-2'
  if (to)
    return (
      <Link to={to} className={cls}>
        {inner}
      </Link>
    )
  if (onClick)
    return (
      <button onClick={onClick} className={cls}>
        {inner}
      </button>
    )
  return <div className={cls}>{inner}</div>
}
