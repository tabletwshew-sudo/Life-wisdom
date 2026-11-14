import type { ReactNode } from 'react'

export function EmptyState({ emoji, title, children }: { emoji: string; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <span className="text-5xl" aria-hidden>
        {emoji}
      </span>
      <p className="text-lg font-bold">{title}</p>
      {children && <div className="max-w-sm text-ink-3">{children}</div>}
    </div>
  )
}
