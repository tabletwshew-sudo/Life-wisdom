import clsx from 'clsx'
import { Clock, Lock, Repeat as RepeatIcon, Users } from 'lucide-react'
import { animate, motion, useMotionValue, useTransform } from 'motion/react'
import { useRef, useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { useCurrentFamily } from '@/family/FamilyProvider'
import { tint } from '@/lib/colours'
import { formatTime, relativeDay } from '@/lib/dates'
import { canComplete, type Occurrence } from '@/lib/tasks/model'
import type { Category } from './api'
import { Burst } from './Burst'
import { NewBadge, StatusIcon } from './StatusIcon'

interface Props {
  occ: Occurrence
  today: string
  isNew: boolean
  category?: Category
  onToggle: (occ: Occurrence) => void
  onOpen: (occ: Occurrence) => void
  showDate?: boolean
  overdue?: boolean
}

const SWIPE_DONE = 96

export function TaskRow({ occ, today, isNew, category, onToggle, onOpen, showDate, overdue }: Props) {
  const { me, isAdmin, memberById } = useCurrentFamily()
  const { task, status } = occ
  const [burstKey, setBurstKey] = useState(0)
  const allowed = canComplete(occ, me.userId, isAdmin, today)
  const colour = task.colour ?? category?.colour ?? '#7B61FF'
  const owner = memberById(occ.forUser)
  const doneBy = occ.completion ? memberById(occ.completion.completedBy) : undefined
  const assignees = occ.forUser ? [] : task.assignees.map((a) => memberById(a.userId)).filter((m) => !!m)

  const x = useMotionValue(0)
  // A swipe ends with a pointer-up; don't let that also count as a tap.
  const dragging = useRef(false)
  const bg = useTransform(x, [0, SWIPE_DONE], [0, 1])

  function toggle() {
    if (!allowed || status === 'upcoming') return
    if (status !== 'done') {
      setBurstKey((k) => k + 1)
      navigator.vibrate?.(15)
    }
    onToggle(occ)
  }

  const label = `${task.title}${owner ? ` for ${owner.displayName}` : ''}`

  return (
    <li className="relative">
      {/* Swipe-to-complete background */}
      {allowed && status !== 'upcoming' && (
        <motion.div
          style={{ opacity: bg }}
          className={clsx(
            'absolute inset-0 flex items-center rounded-2xl px-5 font-bold text-white',
            status === 'done' ? 'bg-ink-3' : 'bg-done',
          )}
          aria-hidden
        >
          {status === 'done' ? 'Undo' : '✓ Done'}
        </motion.div>
      )}
      <motion.div
        layout="position"
        style={{ x, background: isNew ? 'var(--color-new-bg)' : undefined }}
        drag={allowed && status !== 'upcoming' ? 'x' : false}
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: 0, right: 0.5 }}
        onDragStart={() => {
          dragging.current = true
        }}
        onDragEnd={(_, info) => {
          setTimeout(() => (dragging.current = false), 50)
          if (info.offset.x > SWIPE_DONE) toggle()
          animate(x, 0, { type: 'spring', stiffness: 500, damping: 40 })
        }}
        className={clsx(
          'relative flex items-center gap-3 overflow-hidden rounded-2xl bg-card py-2.5 pr-3 pl-4 shadow-[var(--shadow-card)]',
          isNew && 'ring-2 ring-new/50',
        )}
      >
        <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: colour }} aria-hidden />

        <button
          onClick={toggle}
          disabled={!allowed || status === 'upcoming'}
          aria-pressed={status === 'done'}
          aria-label={
            status === 'done' ? `Mark not done: ${label}` : status === 'upcoming' ? `${label} (coming up)` : `Mark done: ${label}`
          }
          className="relative flex size-12 shrink-0 items-center justify-center rounded-full disabled:cursor-default"
        >
          <motion.span key={status} initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 15 }}>
            <StatusIcon status={status} />
          </motion.span>
          {burstKey > 0 && <Burst key={burstKey} />}
        </button>

        <button onClick={() => !dragging.current && onOpen(occ)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-2xl" style={{ background: tint(colour, 0.18) }} aria-hidden>
            {task.emoji}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className={clsx('truncate font-semibold', status === 'done' && 'text-ink-3 line-through decoration-2')}>{task.title}</span>
              {isNew && <NewBadge />}
            </span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[13px] text-ink-3">
              {showDate && <span>{relativeDay(occ.date, today)}</span>}
              {task.dueTime && (
                <span className={clsx('inline-flex items-center gap-1', overdue && 'font-semibold text-missed')}>
                  <Clock className="size-3.5" aria-hidden /> {formatTime(task.dueTime)}
                  {overdue && ' · late'}
                </span>
              )}
              {task.repeat !== 'once' && <RepeatIcon className="size-3.5" aria-label="Repeats" />}
              {task.completionMode === 'any' && task.assignees.length > 1 && (
                <span className="inline-flex items-center gap-1">
                  <Users className="size-3.5" aria-hidden /> anyone
                </span>
              )}
              {category && (
                <span>
                  {category.emoji} {category.name}
                </span>
              )}
              {status === 'done' && doneBy && <span className="text-done">✓ {doneBy.displayName}</span>}
              {status === 'missed' && <span className="font-semibold text-missed">Missed</span>}
              {!allowed && status !== 'upcoming' && status !== 'done' && <Lock className="size-3.5" aria-label="Only this person or an admin can tick this" />}
            </span>
          </span>
        </button>

        {owner ? (
          <Avatar emoji={owner.emoji} colour={owner.colour} name={owner.displayName} size="sm" />
        ) : (
          assignees.length > 0 && (
            <span className="flex -space-x-2">
              {assignees.slice(0, 3).map((m) => (
                <Avatar key={m.userId} emoji={m.emoji} colour={m.colour} name={m.displayName} size="sm" />
              ))}
            </span>
          )
        )}
      </motion.div>
    </li>
  )
}
