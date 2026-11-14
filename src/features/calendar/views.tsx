import clsx from 'clsx'
import { Plus } from 'lucide-react'
import { DayCross } from '@/components/ui/DayCross'
import { EmptyState } from '@/components/ui/EmptyState'
import { StatusIcon } from '@/features/tasks/StatusIcon'
import { TaskRow } from '@/features/tasks/TaskRow'
import { useCurrentFamily } from '@/family/FamilyProvider'
import { monthGrid, type EventOccurrence } from '@/lib/calendar/events'
import { tint } from '@/lib/colours'
import { addDays, formatDate, parts, range, startOfWeek, type ISODate } from '@/lib/dates'
import { progress, type Occurrence } from '@/lib/tasks/model'
import type { CalendarData } from './useCalendarData'
import { EventChip, EventRow } from './EventItems'

export interface ViewHandlers {
  data: CalendarData
  today: ISODate
  onOpenDay: (d: ISODate) => void
  onOpenEvent: (o: EventOccurrence) => void
  onOpenTask: (o: Occurrence) => void
  onToggleTask: (o: Occurrence) => void
  onAddEvent?: (d: ISODate) => void
}

const dayLabel = (d: ISODate) => formatDate(d, { weekday: 'long', day: 'numeric', month: 'long' })

/** Compact task summary for grid cells: icon + done/total. */
function TaskSummary({ list }: { list: Occurrence[] }) {
  if (!list.length) return null
  const p = progress(list)
  const status = list.some((o) => o.status === 'missed') ? 'missed' : p.done === p.total ? 'done' : list[0].status === 'upcoming' ? 'upcoming' : 'due'
  return (
    <span className="flex items-center gap-1 text-[11px] font-semibold text-ink-3" aria-label={`${p.done} of ${p.total} chores done`}>
      <StatusIcon status={status} size="sm" />
      {p.done}/{p.total}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Agenda for one day (used by Day view and the day sheet)
// ---------------------------------------------------------------------------
export function DayAgenda({ day, h, compact }: { day: ISODate; h: ViewHandlers; compact?: boolean }) {
  const { data, today } = h
  const events = data.eventsOn(day)
  const tasks = data.tasksOn(day)
  if (!events.length && !tasks.length)
    return (
      <EmptyState emoji="🌤️" title="Nothing planned">
        {h.onAddEvent && (
          <button onClick={() => h.onAddEvent!(day)} className="mt-2 inline-flex min-h-11 items-center gap-1 rounded-full bg-brand-500 px-4 font-semibold text-white">
            <Plus className="size-4" aria-hidden /> Add an event
          </button>
        )}
      </EmptyState>
    )
  return (
    <div className={clsx('flex flex-col', compact ? 'gap-4' : 'gap-6')}>
      {events.length > 0 && (
        <section>
          <h3 className="mb-2 px-1 text-sm font-bold tracking-wide text-ink-3 uppercase">Events · {events.length}</h3>
          <ul className="flex flex-col gap-2.5">
            {events.map((o) => (
              <EventRow
                key={o.key}
                o={o}
                day={day}
                colours={data.eventColours(o.event)}
                type={o.event.typeId ? data.typeById.get(o.event.typeId) : undefined}
                isNew={data.isEventNew(o.event)}
                onOpen={() => h.onOpenEvent(o)}
              />
            ))}
          </ul>
        </section>
      )}
      {tasks.length > 0 && (
        <section>
          <h3 className="mb-2 px-1 text-sm font-bold tracking-wide text-ink-3 uppercase">
            Chores · {progress(tasks).done}/{tasks.length} done
          </h3>
          <ul className="flex flex-col gap-2.5">
            {tasks.map((o) => (
              <TaskRow
                key={o.key}
                occ={o}
                today={today}
                isNew={data.isTaskNew(o.task)}
                category={o.task.categoryId ? data.catById.get(o.task.categoryId) : undefined}
                onToggle={h.onToggleTask}
                onOpen={h.onOpenTask}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Month
// ---------------------------------------------------------------------------
export function MonthView({ date, h }: { date: ISODate; h: ViewHandlers }) {
  const { family } = useCurrentFamily()
  const { y, m } = parts(date)
  const weeks = monthGrid(y, m, family.week_starts_on)
  const headers = weeks[0].map((d) => formatDate(d, { weekday: 'short' }))
  return (
    <div role="grid" aria-label={formatDate(date, { month: 'long', year: 'numeric' })} className="overflow-hidden rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-card)]">
      <div role="row" className="grid grid-cols-7 border-b border-line">
        {headers.map((d) => (
          <div key={d} role="columnheader" className="py-2 text-center text-xs font-bold text-ink-3 uppercase">
            <span className="md:hidden">{d.slice(0, 1)}</span>
            <span className="hidden md:inline">{d}</span>
          </div>
        ))}
      </div>
      {weeks.map((week) => (
        <div role="row" key={week[0]} className="grid grid-cols-7 border-b border-line last:border-b-0">
          {week.map((d) => (
            <MonthCell key={d} day={d} inMonth={parts(d).m === m} h={h} />
          ))}
        </div>
      ))}
    </div>
  )
}

function MonthCell({ day, inMonth, h }: { day: ISODate; inMonth: boolean; h: ViewHandlers }) {
  const { data, today } = h
  const events = data.eventsOn(day)
  const tasks = data.tasksOn(day)
  const status = data.dayStatus(day)
  const isToday = day === today
  const extra = events.length - 3
  return (
    <div
      role="gridcell"
      className={clsx('relative min-h-22 border-r border-line p-1 last:border-r-0 md:min-h-28 md:p-1.5', !inMonth && 'bg-card-2/50')}
    >
      {status === 'missed' && <DayCross strength="soft" />}
      <button
        onClick={() => h.onOpenDay(day)}
        aria-label={`${dayLabel(day)}${events.length ? `, ${events.length} event${events.length > 1 ? 's' : ''}` : ''}${status === 'missed' ? ', something missed' : status === 'done' ? ', all chores done' : ''}`}
        className="absolute inset-0"
      />
      <div className="pointer-events-none relative flex flex-col gap-0.5">
        <span
          className={clsx(
            'mb-0.5 flex size-7 items-center justify-center self-start rounded-full text-sm font-bold',
            isToday ? 'bg-brand-500 text-white' : inMonth ? 'text-ink' : 'text-ink-3',
          )}
        >
          {parts(day).d}
        </span>
        <div className="pointer-events-auto flex flex-col gap-0.5">
          {events.slice(0, 3).map((o) => (
            <EventChip
              key={o.key}
              o={o}
              colours={data.eventColours(o.event)}
              type={o.event.typeId ? data.typeById.get(o.event.typeId) : undefined}
              isNew={data.isEventNew(o.event)}
              onClick={() => h.onOpenEvent(o)}
            />
          ))}
        </div>
        {extra > 0 && <span className="px-1 text-[11px] font-semibold text-ink-3">+{extra} more</span>}
        <TaskSummary list={tasks} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Week
// ---------------------------------------------------------------------------
export function WeekView({ date, h }: { date: ISODate; h: ViewHandlers }) {
  const { family } = useCurrentFamily()
  const start = startOfWeek(date, family.week_starts_on)
  const days = range(start, addDays(start, 6))
  const { data, today } = h
  return (
    <>
      {/* Tablets and computers: seven columns */}
      <div className="hidden grid-cols-7 gap-2 md:grid">
        {days.map((d) => {
          const status = data.dayStatus(d)
          return (
            <div key={d} className="relative flex min-h-80 flex-col gap-1 overflow-hidden rounded-2xl bg-card p-2 shadow-[var(--shadow-card)]">
              {status === 'missed' && <DayCross strength="soft" />}
              <button onClick={() => h.onOpenDay(d)} className="relative mb-1 flex flex-col items-center rounded-xl py-1 hover:bg-card-2" aria-label={dayLabel(d)}>
                <span className="text-xs font-bold text-ink-3 uppercase">{formatDate(d, { weekday: 'short' })}</span>
                <span className={clsx('flex size-9 items-center justify-center rounded-full text-lg font-bold', d === today && 'bg-brand-500 text-white')}>
                  {parts(d).d}
                </span>
              </button>
              {data.eventsOn(d).map((o) => (
                <EventChip
                  key={o.key}
                  o={o}
                  colours={data.eventColours(o.event)}
                  type={o.event.typeId ? data.typeById.get(o.event.typeId) : undefined}
                  isNew={data.isEventNew(o.event)}
                  onClick={() => h.onOpenEvent(o)}
                />
              ))}
              <div className="relative mt-1 flex flex-col gap-1">
                {data.tasksOn(d).map((o) => (
                  <button
                    key={o.key}
                    onClick={() => h.onOpenTask(o)}
                    className="flex items-center gap-1 rounded-md px-1 py-0.5 text-left text-xs hover:bg-card-2"
                    style={data.isTaskNew(o.task) ? { background: 'var(--color-new-bg)' } : undefined}
                  >
                    <StatusIcon status={o.status} size="sm" />
                    <span className="size-2 shrink-0 rounded-full" style={{ background: data.taskColour(o) }} aria-hidden />
                    <span className={clsx('truncate', o.status === 'done' && 'text-ink-3 line-through')}>
                      {o.task.emoji} {o.task.title}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Phones: a list of days */}
      <ol className="flex flex-col gap-3 md:hidden">
        {days.map((d) => {
          const events = data.eventsOn(d)
          const tasks = data.tasksOn(d)
          const status = data.dayStatus(d)
          return (
            <li key={d} className="relative overflow-hidden rounded-2xl bg-card p-3 shadow-[var(--shadow-card)]">
              {status === 'missed' && <DayCross strength="soft" />}
              <div className="relative flex items-start gap-3">
                <button
                  onClick={() => h.onOpenDay(d)}
                  aria-label={`${dayLabel(d)}, open day`}
                  className={clsx('flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl leading-none', d === today ? 'bg-brand-500 text-white' : 'bg-card-2')}
                >
                  <span className="text-[10px] font-bold uppercase">{formatDate(d, { weekday: 'short' })}</span>
                  <span className="text-lg font-bold">{parts(d).d}</span>
                </button>
                <div className="flex min-w-0 flex-1 flex-col gap-1 pt-0.5">
                  {events.length === 0 && tasks.length === 0 && (
                    <button onClick={() => h.onOpenDay(d)} className="py-2.5 text-left text-ink-3">
                      Nothing planned
                    </button>
                  )}
                  {events.map((o) => (
                    <EventChip
                      key={o.key}
                      o={o}
                      colours={data.eventColours(o.event)}
                      type={o.event.typeId ? data.typeById.get(o.event.typeId) : undefined}
                      isNew={data.isEventNew(o.event)}
                      onClick={() => h.onOpenEvent(o)}
                    />
                  ))}
                  {tasks.length > 0 && (
                    <button onClick={() => h.onOpenDay(d)} className="self-start py-1">
                      <TaskSummary list={tasks} />
                    </button>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </>
  )
}

// ---------------------------------------------------------------------------
// Year
// ---------------------------------------------------------------------------
export function YearView({ date, h, onOpenMonth }: { date: ISODate; h: ViewHandlers; onOpenMonth: (d: ISODate) => void }) {
  const { family } = useCurrentFamily()
  const { y } = parts(date)
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
        const first = `${y}-${String(m).padStart(2, '0')}-01`
        const weeks = monthGrid(y, m, family.week_starts_on)
        return (
          <section key={m} className="rounded-2xl bg-card p-2.5 shadow-[var(--shadow-card)]">
            <button onClick={() => onOpenMonth(first)} className="mb-1 w-full rounded-lg px-1 py-1 text-left font-bold text-brand-600 hover:bg-card-2 dark:text-brand-400">
              {formatDate(first, { month: 'long' })}
            </button>
            <div className="grid grid-cols-7 gap-y-0.5 text-center text-[11px]">
              {weeks.flat().map((d) => {
                const inMonth = parts(d).m === m
                if (!inMonth) return <span key={d} />
                const events = h.data.eventsOn(d)
                const colour = events.length ? h.data.eventColours(events[0].event)[0] : null
                return (
                  <button
                    key={d}
                    onClick={() => h.onOpenDay(d)}
                    aria-label={`${dayLabel(d)}${events.length ? `, ${events.length} event${events.length > 1 ? 's' : ''}` : ''}`}
                    className={clsx(
                      'mx-auto flex size-6 items-center justify-center rounded-full font-semibold',
                      d === h.today && 'bg-brand-500 text-white',
                      colour && d !== h.today && 'ring-2',
                    )}
                    style={colour && d !== h.today ? { background: tint(colour, 0.3), ['--tw-ring-color' as string]: colour } : undefined}
                  >
                    {parts(d).d}
                  </button>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
