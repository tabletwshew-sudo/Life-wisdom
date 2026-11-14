import { CalendarDays, ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Card, SectionTitle } from '@/components/ui/Card'
import { useNewItems } from '@/features/tasks/useNewTracker'
import { useCurrentFamily } from '@/family/FamilyProvider'
import { expandEvents, isEventNewFor, type CalEvent, type EventOccurrence } from '@/lib/calendar/events'
import { addDays, relativeDay, type ISODate } from '@/lib/dates'
import { useEventTypes, useEvents } from './api'
import { EventDetailSheet } from './EventDetailSheet'
import { EventRow } from './EventItems'
import { EventSheet } from './EventSheet'

/** Today's events (and the next couple of days if today is empty) for the Today page. */
export function TodayEvents({ today }: { today: ISODate }) {
  const { memberById } = useCurrentFamily()
  const events = useEvents().data ?? []
  const types = useEventTypes().data ?? []
  const [detail, setDetail] = useState<EventOccurrence | null>(null)
  const [edit, setEdit] = useState<CalEvent | null>(null)

  const todays = useMemo(() => expandEvents(events, today, today), [events, today])
  const upcoming = useMemo(() => (todays.length ? [] : expandEvents(events, addDays(today, 1), addDays(today, 3)).slice(0, 3)), [events, today, todays.length])
  const shown = todays.length ? todays : upcoming
  const isNew = useNewItems<CalEvent>('event', shown.map((o) => o.event), isEventNewFor)

  const colours = (e: CalEvent) => {
    const people = e.attendees.map((a) => memberById(a.userId)?.colour).filter((c): c is string => !!c)
    const typeColour = e.colour ?? types.find((t) => t.id === e.typeId)?.colour ?? '#0072B2'
    return people.length ? people : [typeColour]
  }

  return (
    <section>
      <SectionTitle
        action={
          <Link to="/calendar" className="inline-flex min-h-9 items-center text-sm font-semibold text-brand-600 dark:text-brand-400">
            Calendar <ChevronRight className="size-4" aria-hidden />
          </Link>
        }
      >
        {todays.length ? 'Today’s events' : 'Coming up'}
      </SectionTitle>
      {shown.length ? (
        <div className="flex flex-col gap-2.5">
          {shown.map((o) => (
            <div key={o.key}>
              {!todays.length && <p className="mb-1 px-1 text-xs font-semibold text-ink-3">{relativeDay(o.start, today)}</p>}
              <ul>
              <EventRow
                o={o}
                day={todays.length ? today : o.start}
                colours={colours(o.event)}
                type={types.find((t) => t.id === o.event.typeId)}
                isNew={isNew(o.event)}
                onOpen={() => setDetail(o)}
              />
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <Card className="flex items-center gap-3 p-4 text-ink-3">
          <CalendarDays className="size-6" aria-hidden /> Nothing on the calendar for the next few days.
        </Card>
      )}
      <EventDetailSheet occ={detail} onClose={() => setDetail(null)} onEdit={(e) => (setDetail(null), setEdit(e))} />
      <EventSheet open={!!edit} event={edit} defaultDate={today} onClose={() => setEdit(null)} />
    </section>
  )
}
