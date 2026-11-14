import clsx from 'clsx'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { motion } from 'motion/react'
import { addDays, formatDate, range, startOfWeek, type ISODate } from '@/lib/dates'

interface Props {
  selected: ISODate
  today: ISODate
  weekStartsOn: number
  onSelect: (d: ISODate) => void
  /** Optional per-day marker: 'done' (all ticked), 'missed' (something missed), 'todo' */
  marker?: (d: ISODate) => 'done' | 'missed' | 'todo' | null
}

/** A week of days. Swipe left/right (or use the arrows) to change week. */
export function DateStrip({ selected, today, weekStartsOn, onSelect, marker }: Props) {
  const start = startOfWeek(selected, weekStartsOn)
  const days = range(start, addDays(start, 6))
  const go = (n: number) => onSelect(addDays(selected, n))

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center gap-2">
        <button onClick={() => go(-7)} aria-label="Previous week" className="flex size-11 items-center justify-center rounded-full bg-card shadow-sm">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <p className="flex-1 text-center font-bold" aria-live="polite">
          {formatDate(selected, { month: 'long', year: 'numeric' })}
        </p>
        {selected !== today && (
          <button onClick={() => onSelect(today)} className="min-h-11 rounded-full bg-brand-100 px-4 text-sm font-semibold text-brand-700 dark:bg-brand-700/40 dark:text-brand-200">
            Today
          </button>
        )}
        <button onClick={() => go(7)} aria-label="Next week" className="flex size-11 items-center justify-center rounded-full bg-card shadow-sm">
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>
      <motion.ol
        className="grid touch-pan-y grid-cols-7 gap-1"
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.25}
        onDragEnd={(_, info) => {
          if (info.offset.x < -50) go(7)
          else if (info.offset.x > 50) go(-7)
        }}
      >
        {days.map((d) => {
          const isSel = d === selected
          const m = marker?.(d)
          return (
            <li key={d}>
              <button
                onClick={() => onSelect(d)}
                aria-current={isSel ? 'date' : undefined}
                aria-label={formatDate(d, { weekday: 'long', day: 'numeric', month: 'long' }) + (m ? `, ${m === 'done' ? 'all done' : m === 'missed' ? 'something missed' : 'to do'}` : '')}
                className={clsx(
                  'flex w-full flex-col items-center gap-0.5 rounded-2xl py-2 transition',
                  isSel ? 'bg-brand-500 text-white shadow-md' : 'bg-card text-ink',
                  d === today && !isSel && 'ring-2 ring-brand-400',
                )}
              >
                <span className={clsx('text-[11px] font-semibold uppercase', isSel ? 'text-white/80' : 'text-ink-3')}>
                  {formatDate(d, { weekday: 'short' }).slice(0, 3)}
                </span>
                <span className="text-lg font-bold">{formatDate(d, { day: 'numeric' })}</span>
                <span
                  className={clsx(
                    'flex h-4 items-center text-sm leading-4 font-black',
                    !isSel && m === 'done' && 'text-done',
                    !isSel && m === 'missed' && 'text-missed',
                    !isSel && m === 'todo' && 'text-ink-3',
                  )}
                  aria-hidden
                >
                  {m === 'done' ? '✓' : m === 'missed' ? '✕' : m === 'todo' ? '•' : ''}
                </span>
              </button>
            </li>
          )
        })}
      </motion.ol>
    </div>
  )
}
