import clsx from 'clsx'
import { Check, Sparkles, X } from 'lucide-react'
import type { OccurrenceStatus } from '@/lib/tasks/model'

const LABEL: Record<OccurrenceStatus, string> = { done: 'Done', missed: 'Missed', due: 'To do', upcoming: 'Coming up' }

/** Tick / cross / empty circle. Always icon + accessible label, never colour alone. */
export function StatusIcon({ status, size = 'md' }: { status: OccurrenceStatus; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'size-5' : 'size-8'
  const icon = size === 'sm' ? 'size-3.5' : 'size-5'
  return (
    <span
      role="img"
      aria-label={LABEL[status]}
      className={clsx(
        'inline-flex shrink-0 items-center justify-center rounded-full',
        box,
        status === 'done' && 'bg-done text-white',
        status === 'missed' && 'bg-missed text-white',
        status === 'due' && 'border-[2.5px] border-ink-3',
        status === 'upcoming' && 'border-2 border-dashed border-ink-3/60',
      )}
    >
      {status === 'done' && <Check className={icon} strokeWidth={3.5} aria-hidden />}
      {status === 'missed' && <X className={icon} strokeWidth={3.5} aria-hidden />}
    </span>
  )
}

export function NewBadge({ className }: { className?: string }) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-0.5 rounded-full bg-new-bg px-2 py-0.5 text-[11px] font-extrabold tracking-wide text-new ring-1 ring-new/40 dark:text-amber-300',
        className,
      )}
    >
      <Sparkles className="size-3" aria-hidden /> NEW
    </span>
  )
}
