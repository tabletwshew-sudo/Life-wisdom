import clsx from 'clsx'
import { ChevronLeft, ChevronRight, Plus, SlidersHorizontal } from 'lucide-react'
import { motion } from 'motion/react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { Spinner } from '@/components/ui/Spinner'
import { Toggle } from '@/components/ui/Toggle'
import { useToast } from '@/components/ui/Toast'
import { useToggleCompletion } from '@/features/tasks/api'
import { TaskDetailSheet } from '@/features/tasks/TaskDetailSheet'
import { TaskSheet } from '@/features/tasks/TaskSheet'
import { useCurrentFamily } from '@/family/FamilyProvider'
import { useSwipeGuard } from '@/hooks/useSwipeGuard'
import { useToday } from '@/hooks/useToday'
import { addMonths, monthGrid, type CalEvent, type EventOccurrence } from '@/lib/calendar/events'
import { addDays, formatDate, parts, relativeDay, startOfWeek, type ISODate } from '@/lib/dates'
import { friendlyError } from '@/lib/errors'
import type { Occurrence, Task } from '@/lib/tasks/model'
import { EventDetailSheet } from './EventDetailSheet'
import { EventSheet } from './EventSheet'
import { useCalendarPrefs } from './prefs'
import { useCalendarData } from './useCalendarData'
import { DayAgenda, MonthView, WeekView, YearView, type ViewHandlers } from './views'

type View = 'day' | 'week' | 'month' | 'year'
const VIEWS: [View, string][] = [
  ['day', 'Day'],
  ['week', 'Week'],
  ['month', 'Month'],
  ['year', 'Year'],
]

function rangeFor(view: View, date: ISODate, weekStartsOn: number): [ISODate, ISODate] {
  const { y, m } = parts(date)
  switch (view) {
    case 'day':
      return [date, date]
    case 'week': {
      const s = startOfWeek(date, weekStartsOn)
      return [s, addDays(s, 6)]
    }
    case 'month': {
      const g = monthGrid(y, m, weekStartsOn)
      return [g[0][0], g[5][6]]
    }
    case 'year':
      return [`${y}-01-01`, `${y}-12-31`]
  }
}

function move(view: View, date: ISODate, dir: 1 | -1): ISODate {
  if (view === 'day') return addDays(date, dir)
  if (view === 'week') return addDays(date, 7 * dir)
  if (view === 'month') return addMonths(date, dir)
  return addMonths(date, 12 * dir)
}

function title(view: View, date: ISODate, today: ISODate, weekStartsOn: number): string {
  if (view === 'day') return relativeDay(date, today) === 'Today' ? 'Today' : formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })
  if (view === 'week') {
    const s = startOfWeek(date, weekStartsOn)
    const e = addDays(s, 6)
    return parts(s).m === parts(e).m
      ? `${parts(s).d}–${formatDate(e, { day: 'numeric', month: 'long' })}`
      : `${formatDate(s, { day: 'numeric', month: 'short' })} – ${formatDate(e, { day: 'numeric', month: 'short' })}`
  }
  if (view === 'month') return formatDate(date, { month: 'long', year: 'numeric' })
  return String(parts(date).y)
}

export default function CalendarPage() {
  const { family, can } = useCurrentFamily()
  const today = useToday()
  const [params, setParams] = useSearchParams()
  const view = (params.get('view') as View) || 'month'
  const date = params.get('date') || today
  const go = (v: View, d: ISODate) =>
    setParams(
      (p) => {
        p.set('view', v)
        p.set('date', d)
        return p
      },
      { replace: true },
    )

  const { colourMode, setColourMode, showTasks, setShowTasks, showMeals, setShowMeals } = useCalendarPrefs()
  const [from, to] = rangeFor(view, date, family.week_starts_on)
  const data = useCalendarData(from, to, today, showTasks && view !== 'year', colourMode, showMeals && view !== 'year')

  const [daySheet, setDaySheet] = useState<ISODate | null>(null)
  const [eventDetail, setEventDetail] = useState<EventOccurrence | null>(null)
  const [eventEdit, setEventEdit] = useState<{ open: boolean; event: CalEvent | null; date: ISODate }>({ open: false, event: null, date: today })
  const [taskDetail, setTaskDetail] = useState<Occurrence | null>(null)
  const [taskEdit, setTaskEdit] = useState<Task | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const toggle = useToggleCompletion()
  const toast = useToast()
  const swipe = useSwipeGuard()
  const canAdd = can('addEvents')

  const addEvent = (d: ISODate) => {
    setDaySheet(null)
    setEventEdit({ open: true, event: null, date: d < today ? today : d })
  }

  const h: ViewHandlers = {
    data,
    today,
    onOpenDay: (d) => (view === 'day' ? go('day', d) : setDaySheet(d)),
    onOpenEvent: (o) => setEventDetail(o),
    onOpenTask: (o) => setTaskDetail(o),
    onToggleTask: (o) =>
      toggle.mutate({ taskId: o.task.id, date: o.date, forUser: o.forUser, existing: o.completion }, { onError: (e) => toast(friendlyError(e), 'error') }),
    onAddEvent: canAdd ? addEvent : undefined,
  }

  return (
    <>
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <h1 className="mr-auto min-w-0 truncate text-[1.75rem] leading-tight font-extrabold tracking-tight md:text-[2rem]" aria-live="polite">
          {title(view, date, today, family.week_starts_on)}
        </h1>
        <div className="flex items-center gap-1.5">
          <button onClick={() => go(view, move(view, date, -1))} aria-label={`Previous ${view}`} className="flex size-11 items-center justify-center rounded-full bg-card shadow-sm">
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button onClick={() => go(view, today)} className="min-h-11 rounded-full bg-card px-4 text-sm font-semibold shadow-sm">
            Today
          </button>
          <button onClick={() => go(view, move(view, date, 1))} aria-label={`Next ${view}`} className="flex size-11 items-center justify-center rounded-full bg-card shadow-sm">
            <ChevronRight className="size-5" aria-hidden />
          </button>
          <button onClick={() => setSettingsOpen(true)} aria-label="Calendar options" className="flex size-11 items-center justify-center rounded-full bg-card shadow-sm">
            <SlidersHorizontal className="size-5" aria-hidden />
          </button>
          {canAdd && (
            <span className="hidden md:block">
              <Button size="md" icon={<Plus className="size-5" />} onClick={() => addEvent(view === 'year' ? today : date)}>
                New event
              </Button>
            </span>
          )}
        </div>
      </header>

      <div role="tablist" aria-label="Calendar views" className="mb-4 grid grid-cols-4 gap-1 rounded-2xl bg-card-2 p-1">
        {VIEWS.map(([v, label]) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            onClick={() => go(v, date)}
            className={clsx('min-h-11 rounded-xl font-semibold transition', view === v ? 'bg-card shadow-sm' : 'text-ink-3')}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Swipe left/right to move through time (touch screens). */}
      <motion.div
        key={`${view}:${from}`}
        initial={{ opacity: 0.4 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.15}
        dragSnapToOrigin
        onDragStart={swipe.onDragStart}
        onClickCapture={swipe.onClickCapture}
        onDragEnd={(_, info) => {
          swipe.onDragEndCleanup()
          if (info.offset.x < -70) go(view, move(view, date, 1))
          else if (info.offset.x > 70) go(view, move(view, date, -1))
        }}
        className="touch-pan-y"
      >
        {data.loading ? (
          <Spinner />
        ) : view === 'month' ? (
          <MonthView date={date} h={h} />
        ) : view === 'week' ? (
          <WeekView date={date} h={h} />
        ) : view === 'day' ? (
          <DayAgenda day={date} h={h} />
        ) : (
          <YearView date={date} h={h} onOpenMonth={(d) => go('month', d)} />
        )}
      </motion.div>

      <Legend colourMode={colourMode} />

      {canAdd && (
        <button
          onClick={() => addEvent(view === 'year' ? today : date)}
          aria-label="New event"
          className="fixed right-[max(1.25rem,env(safe-area-inset-right))] bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex size-16 items-center justify-center rounded-full bg-brand-500 text-white shadow-xl shadow-brand-500/30 active:scale-95 md:hidden"
        >
          <Plus className="size-8" strokeWidth={2.5} aria-hidden />
        </button>
      )}

      {/* Tap a day → agenda with an "Add" button */}
      <Sheet
        open={!!daySheet}
        onClose={() => setDaySheet(null)}
        title={daySheet ? formatDate(daySheet, { weekday: 'long', day: 'numeric', month: 'long' }) : ''}
        footer={
          daySheet && (
            <div className="flex gap-2">
              <Button variant="secondary" full onClick={() => (go('day', daySheet), setDaySheet(null))}>
                Open day
              </Button>
              {canAdd && (
                <Button full icon={<Plus className="size-5" />} onClick={() => addEvent(daySheet)}>
                  Add event
                </Button>
              )}
            </div>
          )
        }
      >
        {daySheet && <DayAgenda day={daySheet} h={{ ...h, onAddEvent: undefined }} compact />}
      </Sheet>

      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Calendar options">
        <p className="mb-2 text-sm font-semibold text-ink-2">Colour items by</p>
        <div role="radiogroup" aria-label="Colour items by" className="mb-4 grid grid-cols-2 gap-1 rounded-2xl bg-card-2 p-1">
          {(
            [
              ['person', '🙂 Person'],
              ['category', '🏷️ Type / category'],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              role="radio"
              aria-checked={colourMode === v}
              onClick={() => setColourMode(v)}
              className={clsx('min-h-11 rounded-xl font-semibold', colourMode === v ? 'bg-card shadow-sm' : 'text-ink-3')}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="-mx-4 rounded-2xl">
          <Toggle label="Show chores on the calendar" description="Ticks, crosses and NEW badges for tasks" checked={showTasks} onChange={setShowTasks} />
          <Toggle label="Show meals on the calendar" description="From the meal planner" checked={showMeals} onChange={setShowMeals} />
        </div>
      </Sheet>

      <EventDetailSheet
        occ={eventDetail}
        onClose={() => setEventDetail(null)}
        onEdit={(e) => {
          setEventDetail(null)
          setEventEdit({ open: true, event: e, date: e.startDate })
        }}
      />
      <EventSheet open={eventEdit.open} event={eventEdit.event} defaultDate={eventEdit.date} onClose={() => setEventEdit((s) => ({ ...s, open: false }))} />
      <TaskDetailSheet occ={taskDetail} today={today} onClose={() => setTaskDetail(null)} onEdit={(t) => (setTaskDetail(null), setTaskEdit(t))} />
      <TaskSheet open={!!taskEdit} task={taskEdit} defaultDate={today} onClose={() => setTaskEdit(null)} />
    </>
  )
}

function Legend({ colourMode }: { colourMode: 'person' | 'category' }) {
  const { members } = useCurrentFamily()
  if (colourMode !== 'person') return null
  return (
    <ul className="mt-4 flex flex-wrap gap-3 px-1 text-sm text-ink-2" aria-label="Colour key">
      {members.map((m) => (
        <li key={m.userId} className="flex items-center gap-1.5">
          <span className="size-3 rounded-full" style={{ background: m.colour }} aria-hidden />
          {m.emoji} {m.displayName}
        </li>
      ))}
    </ul>
  )
}
