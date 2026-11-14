import { CalendarDays, MapPin, Pencil, Repeat as RepeatIcon, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { useCurrentFamily } from '@/family/FamilyProvider'
import type { CalEvent, EventOccurrence } from '@/lib/calendar/events'
import { formatDate } from '@/lib/dates'
import { friendlyError } from '@/lib/errors'
import { describeRule } from '@/lib/tasks/recurrence'
import { useDeleteEvent, useEventTypes } from './api'
import { EVENT_REMINDERS } from './EventSheet'
import { eventTimeLabel, eventTitle } from './EventItems'

export function EventDetailSheet({ occ: current, onClose, onEdit }: { occ: EventOccurrence | null; onClose: () => void; onEdit: (e: CalEvent) => void }) {
  const last = useRef<EventOccurrence | null>(null)
  if (current) last.current = current
  const occ = current ?? last.current
  const { me, isAdmin, can, memberById, family } = useCurrentFamily()
  const types = useEventTypes().data ?? []
  const del = useDeleteEvent()
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)
  if (!occ) return null
  const e = occ.event
  const type = types.find((t) => t.id === e.typeId)
  const manage = isAdmin || (e.createdBy === me.userId && can('addEvents'))
  const creator = memberById(e.createdBy)
  const dateLabel =
    occ.start === occ.end
      ? formatDate(occ.start, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : `${formatDate(occ.start, { weekday: 'short', day: 'numeric', month: 'short' })} – ${formatDate(occ.end, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}`

  async function remove(onlyDate?: string) {
    try {
      await del.mutateAsync({ id: e.id, onlyDate })
      toast(onlyDate ? 'Removed from this day' : 'Event deleted')
      setConfirming(false)
      onClose()
    } catch (err) {
      toast(friendlyError(err), 'error')
    }
  }

  const close = () => {
    setConfirming(false)
    onClose()
  }

  return (
    <Sheet open={!!current} onClose={close} title={eventTitle(occ)}>
      <div className="flex flex-col gap-4 pb-2">
        <div className="flex items-start gap-3">
          <span className="text-5xl" aria-hidden>
            {type?.emoji ?? '📌'}
          </span>
          <div className="text-ink-2">
            {type && <p className="font-semibold">{type.name}</p>}
            <p className="flex items-center gap-1.5">
              <CalendarDays className="size-4" aria-hidden /> {dateLabel}
            </p>
            <p>{eventTimeLabel(occ)}</p>
            {e.repeat !== 'once' && (
              <p className="flex items-center gap-1.5">
                <RepeatIcon className="size-4" aria-hidden />
                {describeRule({ repeat: e.repeat, repeatDays: [], startDate: e.startDate, repeatUntil: e.repeatUntil }, family.week_starts_on)}
              </p>
            )}
          </div>
        </div>

        {e.location && (
          <p className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-5 shrink-0 text-ink-3" aria-hidden />
            {e.location.startsWith('enc:') ? '🔒 Encrypted' : e.location}
          </p>
        )}

        {e.attendees.length > 0 && (
          <div>
            <p className="mb-1 text-sm font-semibold text-ink-3">Who’s going</p>
            <div className="flex flex-wrap gap-2">
              {e.attendees.map((a) => {
                const m = memberById(a.userId)
                return m ? (
                  <span key={a.userId} className="flex items-center gap-2 rounded-full bg-card-2 py-1 pr-3 pl-1 font-medium">
                    <Avatar emoji={m.emoji} colour={m.colour} size="sm" /> {m.displayName}
                  </span>
                ) : null
              })}
            </div>
          </div>
        )}

        {e.notes && (
          <div>
            <p className="mb-1 text-sm font-semibold text-ink-3">Notes</p>
            <p className="whitespace-pre-wrap">{e.notes.startsWith('enc:') ? '🔒 Encrypted' : e.notes}</p>
          </div>
        )}

        <p className="text-sm text-ink-3">
          {e.reminderMinutes != null && `🔔 ${EVENT_REMINDERS.find((r) => r.value === e.reminderMinutes)?.label}. `}
          {creator && `Added by ${creator.displayName}.`}
        </p>

        {manage && !confirming && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" icon={<Pencil className="size-5" />} onClick={() => onEdit(e)}>
              Edit
            </Button>
            <Button variant="secondary" icon={<Trash2 className="size-5" />} onClick={() => setConfirming(true)} className="text-red-600!">
              Delete
            </Button>
          </div>
        )}
        {confirming && (
          <div className="flex flex-col gap-2 rounded-2xl bg-card-2 p-3">
            <p className="font-semibold">Delete “{e.title}”?</p>
            {e.repeat !== 'once' && (
              <Button variant="secondary" loading={del.isPending} onClick={() => remove(occ.start)}>
                Just this one ({formatDate(occ.start, { day: 'numeric', month: 'short' })})
              </Button>
            )}
            <Button variant="danger" loading={del.isPending} onClick={() => remove()}>
              {e.repeat !== 'once' ? 'Every time' : 'Delete'}
            </Button>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    </Sheet>
  )
}
