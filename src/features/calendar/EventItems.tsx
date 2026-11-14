import clsx from 'clsx'
import { MapPin, Repeat as RepeatIcon, Sparkles } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { useCurrentFamily } from '@/family/FamilyProvider'
import { NewBadge } from '@/features/tasks/StatusIcon'
import { yearsSince, type EventOccurrence } from '@/lib/calendar/events'
import { tint } from '@/lib/colours'
import { daysBetween, formatTime, type ISODate } from '@/lib/dates'
import type { EventType } from './api'

/** "Sam’s birthday" → "Sam’s birthday (12)" for yearly events. */
export function eventTitle(o: EventOccurrence): string {
  const n = yearsSince(o.event, o.start)
  return n ? `${o.event.title} (${n})` : o.event.title
}

export function eventTimeLabel(o: EventOccurrence, day?: ISODate): string {
  const e = o.event
  if (e.allDay) return 'All day'
  if (day && o.start !== o.end) {
    if (day === o.start) return `From ${formatTime(e.startTime)}`
    if (day === o.end) return e.endTime ? `Until ${formatTime(e.endTime)}` : 'All day'
    return 'All day'
  }
  return e.endTime ? `${formatTime(e.startTime)}–${formatTime(e.endTime)}` : formatTime(e.startTime)
}

/** Vertical stripe split between several colours (one per person). */
export function Stripe({ colours, className }: { colours: string[]; className?: string }) {
  return (
    <span className={clsx('flex flex-col overflow-hidden', className)} aria-hidden>
      {colours.map((c, i) => (
        <span key={i} className="flex-1" style={{ background: c }} />
      ))}
    </span>
  )
}

/** Small chip for month and week grids. */
export function EventChip({
  o,
  colours,
  type,
  isNew,
  onClick,
}: {
  o: EventOccurrence
  colours: string[]
  type?: EventType
  isNew: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={clsx('relative flex w-full min-w-0 items-center gap-1 overflow-hidden rounded-md py-0.5 pr-1 pl-1.5 text-left text-[11px] leading-4 font-semibold md:text-xs', isNew && 'ring-1 ring-new')}
      style={{ background: isNew ? 'var(--color-new-bg)' : tint(colours[0], 0.22) }}
      title={eventTitle(o)}
    >
      <Stripe colours={colours} className="absolute inset-y-0 left-0 w-1" />
      <span aria-hidden className="shrink-0">
        {type?.emoji ?? '📌'}
      </span>
      {/* Phones: emoji + colour only (cells are tiny); the full name is still read out. */}
      <span className="sr-only sm:not-sr-only sm:truncate">
        {!o.event.allDay && <span className="mr-1 hidden font-normal text-ink-3 md:inline">{formatTime(o.event.startTime)}</span>}
        {eventTitle(o)}
      </span>
      {isNew && <Sparkles className="ml-auto size-3 shrink-0 text-new" aria-label="New" />}
    </button>
  )
}

/** Full row for agenda lists (day view, day sheet, Today page). */
export function EventRow({
  o,
  day,
  colours,
  type,
  isNew,
  onOpen,
}: {
  o: EventOccurrence
  day: ISODate
  colours: string[]
  type?: EventType
  isNew: boolean
  onOpen: () => void
}) {
  const { memberById } = useCurrentFamily()
  const e = o.event
  const multi = o.start !== o.end
  const attendees = e.attendees.map((a) => memberById(a.userId)).filter((m) => !!m)
  return (
    <li>
      <button
        onClick={onOpen}
        className={clsx('relative flex w-full items-center gap-3 overflow-hidden rounded-2xl bg-card py-3 pr-3 pl-4 text-left shadow-[var(--shadow-card)]', isNew && 'ring-2 ring-new/50')}
        style={isNew ? { background: 'var(--color-new-bg)' } : undefined}
      >
        <Stripe colours={colours} className="absolute inset-y-0 left-0 w-1.5" />
        <span className="w-16 shrink-0 text-[13px] leading-tight font-semibold text-ink-2">{eventTimeLabel(o, day)}</span>
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-2xl" style={{ background: tint(colours[0], 0.18) }} aria-hidden>
          {type?.emoji ?? '📌'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate font-semibold">{eventTitle(o)}</span>
            {isNew && <NewBadge />}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2.5 text-[13px] text-ink-3">
            {type && <span>{type.name}</span>}
            {multi && <span>Day {daysBetween(o.start, day) + 1} of {daysBetween(o.start, o.end) + 1}</span>}
            {e.repeat !== 'once' && <RepeatIcon className="size-3.5" aria-label="Repeats" />}
            {e.location && !e.location.startsWith('enc:') && (
              <span className="inline-flex min-w-0 items-center gap-1">
                <MapPin className="size-3.5 shrink-0" aria-hidden />
                <span className="truncate">{e.location}</span>
              </span>
            )}
          </span>
        </span>
        <span className="flex -space-x-2">
          {attendees.slice(0, 4).map((m) => (
            <Avatar key={m.userId} emoji={m.emoji} colour={m.colour} name={m.displayName} size="sm" />
          ))}
        </span>
      </button>
    </li>
  )
}
