import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { Flame, Plus, Star, Wand2 } from 'lucide-react'
import { AnimatePresence } from 'motion/react'
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card, SectionTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { useCurrentFamily, type Member } from '@/family/FamilyProvider'
import { useNowTime, useToday } from '@/hooks/useToday'
import { tint } from '@/lib/colours'
import { addDays, startOfWeek, type ISODate } from '@/lib/dates'
import { friendlyError } from '@/lib/errors'
import { belongsTo, buildOccurrences, isOverdueToday, pointsFor, progress, streak, type Occurrence, type Task } from '@/lib/tasks/model'
import { describeRule, nextOccurrence } from '@/lib/tasks/recurrence'
import { taskKeys, useCategories, useToggleCompletion, type Category } from './api'
import { DateStrip } from './DateStrip'
import { addDemoTasks } from './demo'
import { NewBadge } from './StatusIcon'
import { TaskDetailSheet } from './TaskDetailSheet'
import { TaskRow } from './TaskRow'
import { TaskSheet } from './TaskSheet'
import { useNewTracker } from './useNewTracker'
import { useOccurrences } from './useOccurrences'

type View = 'day' | 'people' | 'all'

export default function TasksPage() {
  const { family, members, me, can } = useCurrentFamily()
  const today = useToday()
  const nowTime = useNowTime()
  const [params, setParams] = useSearchParams()
  const view = (params.get('view') as View) || 'day'
  const selected = params.get('date') || today
  const setView = (v: View) => setParams((p) => (p.set('view', v), p), { replace: true })
  const setSelected = (d: ISODate) => setParams((p) => (p.set('date', d), p), { replace: true })

  const [personFilter, setPersonFilter] = useState<string | null>(null)
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ open: boolean; task: Task | null }>({ open: false, task: null })
  const [detail, setDetail] = useState<Occurrence | null>(null)

  // Load the visible week plus 60 days back (for streaks).
  const weekStart = startOfWeek(selected, family.week_starts_on)
  const from = addDays(weekStart < today ? weekStart : today, -60)
  const to = addDays(weekStart, 6) > today ? addDays(weekStart, 6) : today
  const { occurrences, tasks, completions, loading } = useOccurrences(from, to, today)
  const categories = useCategories().data ?? []
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const toggle = useToggleCompletion()
  const toast = useToast()

  const filtered = useMemo(
    () =>
      occurrences.filter(
        (o) => (!personFilter || belongsTo(o, personFilter)) && (!categoryFilter || o.task.categoryId === categoryFilter),
      ),
    [occurrences, personFilter, categoryFilter],
  )
  const dayOccs = filtered.filter((o) => o.date === selected)
  const visibleTasks = useMemo(() => (view === 'all' ? tasks : dayOccs.map((o) => o.task)), [view, tasks, dayOccs])
  const isNew = useNewTracker(tasks, visibleTasks)

  function onToggle(o: Occurrence) {
    toggle.mutate(
      { taskId: o.task.id, date: o.date, forUser: o.forUser, existing: o.completion },
      { onError: (e) => toast(friendlyError(e), 'error') },
    )
    if (!o.completion) {
      // Celebrate when this finishes everything for the person today.
      const mine = filtered.filter((x) => x.date === o.date && x.key !== o.key && (o.forUser ? x.forUser === o.forUser : true))
      if (mine.length && mine.every((x) => x.status === 'done')) toast('🎉 All done — amazing!')
    }
  }

  const marker = (d: ISODate) => {
    const list = filtered.filter((o) => o.date === d)
    if (!list.length) return null
    if (list.some((o) => o.status === 'missed')) return 'missed'
    if (list.every((o) => o.status === 'done')) return 'done'
    return 'todo'
  }

  const rowProps = (o: Occurrence) => ({
    occ: o,
    today,
    isNew: isNew(o.task),
    category: o.task.categoryId ? catById.get(o.task.categoryId) : undefined,
    onToggle,
    onOpen: setDetail,
    overdue: isOverdueToday(o, today, nowTime),
  })

  return (
    <>
      <PageHeader
        title="Tasks"
        action={
          can('addTasks') && (
            <span className="hidden md:block">
              <Button size="md" icon={<Plus className="size-5" />} onClick={() => setEditing({ open: true, task: null })}>
                New task
              </Button>
            </span>
          )
        }
      />

      <div role="tablist" aria-label="Task views" className="mb-4 grid grid-cols-3 gap-1 rounded-2xl bg-card-2 p-1">
        {(
          [
            ['day', 'By day'],
            ['people', 'By person'],
            ['all', 'All'],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            onClick={() => setView(v)}
            className={clsx('min-h-11 rounded-xl font-semibold transition', view === v ? 'bg-card shadow-sm' : 'text-ink-3')}
          >
            {label}
          </button>
        ))}
      </div>

      <Filters
        members={members}
        categories={categories}
        person={personFilter}
        category={categoryFilter}
        onPerson={setPersonFilter}
        onCategory={setCategoryFilter}
        showPeople={view !== 'people'}
      />

      {view !== 'all' && (
        <DateStrip selected={selected} today={today} weekStartsOn={family.week_starts_on} onSelect={setSelected} marker={marker} />
      )}

      {loading ? (
        <Spinner />
      ) : tasks.length === 0 ? (
        <NoTasks />
      ) : view === 'day' ? (
        <DayView occs={dayOccs} rowProps={rowProps} />
      ) : view === 'people' ? (
        <PeopleView
          members={personFilter ? members.filter((m) => m.userId === personFilter) : members}
          occs={dayOccs}
          allOccs={buildOccurrences(tasks, completions, from, today, today)}
          completions={completions}
          today={today}
          weekStart={startOfWeek(today, family.week_starts_on)}
          pointsEnabled={family.points_enabled}
          rowProps={rowProps}
        />
      ) : (
        <AllView
          tasks={tasks.filter(
            (t) =>
              !t.archivedAt &&
              (!t.repeatUntil || t.repeatUntil >= today || t.repeat === 'once') &&
              (!personFilter || t.assignees.length === 0 || t.assignees.some((a) => a.userId === personFilter)) &&
              (!categoryFilter || t.categoryId === categoryFilter),
          )}
          today={today}
          catById={catById}
          isNew={isNew}
          weekStartsOn={family.week_starts_on}
          onOpen={(t) => {
            const date = nextOccurrence({ repeat: t.repeat, repeatDays: t.repeatDays, startDate: t.startDate, repeatUntil: t.repeatUntil }, today) ?? t.startDate
            const list = buildOccurrences([t], completions, date, date, today)
            const o = list.find((x) => x.forUser === me.userId) ?? list[0]
            if (o) setDetail(o)
            else setEditing({ open: true, task: t })
          }}
        />
      )}

      {/* Floating add button on phones */}
      {can('addTasks') && (
        <button
          onClick={() => setEditing({ open: true, task: null })}
          aria-label="New task"
          className="fixed right-[max(1.25rem,env(safe-area-inset-right))] bottom-[calc(5.5rem+env(safe-area-inset-bottom))] z-30 flex size-16 items-center justify-center rounded-full bg-brand-500 text-white shadow-xl shadow-brand-500/30 active:scale-95 md:hidden"
        >
          <Plus className="size-8" strokeWidth={2.5} aria-hidden />
        </button>
      )}

      <TaskSheet open={editing.open} task={editing.task} defaultDate={selected < today ? today : selected} onClose={() => setEditing({ open: false, task: null })} />
      <TaskDetailSheet
        occ={detail}
        today={today}
        onClose={() => setDetail(null)}
        onEdit={(t) => {
          setDetail(null)
          setEditing({ open: true, task: t })
        }}
      />
    </>
  )
}

type RowPropsFn = (o: Occurrence) => React.ComponentProps<typeof TaskRow>

function DayView({ occs, rowProps }: { occs: Occurrence[]; rowProps: RowPropsFn }) {
  if (!occs.length)
    return (
      <Card>
        <EmptyState emoji="🌤️" title="Nothing on this day">
          Enjoy the free time!
        </EmptyState>
      </Card>
    )
  const groups: [string, Occurrence[]][] = [
    ['To do', occs.filter((o) => o.status === 'due' || o.status === 'upcoming')],
    ['Missed', occs.filter((o) => o.status === 'missed')],
    ['Done', occs.filter((o) => o.status === 'done')],
  ]
  const p = progress(occs)
  return (
    <div className="flex flex-col gap-5">
      <p className="px-1 font-semibold text-ink-2" aria-live="polite">
        {p.done} of {p.total} done
      </p>
      {groups.map(([label, list]) =>
        list.length ? (
          <section key={label}>
            <SectionTitle>
              {label} · {list.length}
            </SectionTitle>
            <ul className="flex flex-col gap-2.5">
              <AnimatePresence initial={false}>
                {list.map((o) => (
                  <TaskRow key={o.key} {...rowProps(o)} />
                ))}
              </AnimatePresence>
            </ul>
          </section>
        ) : null,
      )}
    </div>
  )
}

function PeopleView({
  members,
  occs,
  allOccs,
  completions,
  today,
  weekStart,
  pointsEnabled,
  rowProps,
}: {
  members: Member[]
  occs: Occurrence[]
  allOccs: Occurrence[]
  completions: import('@/lib/tasks/model').Completion[]
  today: ISODate
  weekStart: ISODate
  pointsEnabled: boolean
  rowProps: RowPropsFn
}) {
  const shared = occs.filter((o) => !o.forUser && o.task.assignees.length === 0)
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {members.map((m) => {
        const mine = occs.filter((o) => o.forUser === m.userId || (!o.forUser && o.task.assignees.some((a) => a.userId === m.userId)))
        const p = progress(mine)
        const s = streak(allOccs, m.userId, today)
        const pts = pointsFor(completions, m.userId, weekStart, today)
        return (
          <Card key={m.userId} className="p-4" style={{ boxShadow: `inset 0 4px 0 ${m.colour}, var(--shadow-card)` }}>
            <div className="mb-3 flex items-center gap-3">
              <ProgressRing value={p.ratio} size={56} stroke={6} colour={m.colour} track={tint(m.colour, 0.25)} label={`${m.displayName}'s progress`}>
                <span className="text-2xl" aria-hidden>
                  {m.emoji}
                </span>
              </ProgressRing>
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-bold">{m.displayName}</p>
                <p className="text-sm text-ink-3">
                  {p.done}/{p.total} done
                </p>
              </div>
              <div className="flex flex-col items-end gap-0.5 text-sm font-semibold">
                {s > 0 && (
                  <span className="inline-flex items-center gap-1 text-orange-600 dark:text-orange-400">
                    <Flame className="size-4" aria-hidden /> {s} day{s === 1 ? '' : 's'}
                  </span>
                )}
                {pointsEnabled && (
                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400" title="Points this week">
                    <Star className="size-4" aria-hidden /> {pts}
                  </span>
                )}
              </div>
            </div>
            {mine.length ? (
              <ul className="flex flex-col gap-2">
                {mine.map((o) => (
                  <TaskRow key={o.key} {...rowProps(o)} />
                ))}
              </ul>
            ) : (
              <p className="py-2 text-center text-ink-3">Nothing for {m.displayName} today 🎈</p>
            )}
          </Card>
        )
      })}
      {shared.length > 0 && (
        <Card className="p-4">
          <p className="mb-3 text-lg font-bold">👨‍👩‍👧 Anyone</p>
          <ul className="flex flex-col gap-2">
            {shared.map((o) => (
              <TaskRow key={o.key} {...rowProps(o)} />
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function AllView({
  tasks,
  today,
  catById,
  isNew,
  weekStartsOn,
  onOpen,
}: {
  tasks: Task[]
  today: ISODate
  catById: Map<string, Category>
  isNew: (t: Task) => boolean
  weekStartsOn: number
  onOpen: (t: Task) => void
}) {
  const { memberById } = useCurrentFamily()
  const visible = tasks.filter((t) => t.repeat !== 'once' || t.startDate >= addDays(today, -7))
  if (!visible.length)
    return (
      <Card>
        <EmptyState emoji="🔍" title="No tasks match" />
      </Card>
    )
  return (
    <ul className="flex flex-col gap-2.5">
      {visible.map((t) => {
        const cat = t.categoryId ? catById.get(t.categoryId) : undefined
        const colour = t.colour ?? cat?.colour ?? '#7B61FF'
        return (
          <li key={t.id}>
            <button
              onClick={() => onOpen(t)}
              className={clsx('relative flex w-full items-center gap-3 overflow-hidden rounded-2xl bg-card py-3 pr-3 pl-4 text-left shadow-[var(--shadow-card)]', isNew(t) && 'ring-2 ring-new/50')}
              style={isNew(t) ? { background: 'var(--color-new-bg)' } : undefined}
            >
              <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: colour }} aria-hidden />
              <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-2xl" style={{ background: tint(colour, 0.18) }} aria-hidden>
                {t.emoji}
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate font-semibold">{t.title}</span>
                  {isNew(t) && <NewBadge />}
                </span>
                <span className="block truncate text-[13px] text-ink-3">
                  {describeRule({ repeat: t.repeat, repeatDays: t.repeatDays, startDate: t.startDate, repeatUntil: t.repeatUntil }, weekStartsOn)}
                  {cat && ` · ${cat.emoji} ${cat.name}`}
                </span>
              </span>
              <span className="flex -space-x-2">
                {t.assignees.slice(0, 4).map((a) => {
                  const m = memberById(a.userId)
                  return m ? <Avatar key={a.userId} emoji={m.emoji} colour={m.colour} name={m.displayName} size="sm" /> : null
                })}
              </span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function Filters(props: {
  members: Member[]
  categories: Category[]
  person: string | null
  category: string | null
  onPerson: (id: string | null) => void
  onCategory: (id: string | null) => void
  showPeople: boolean
}) {
  return (
    <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0" role="group" aria-label="Filters">
      {props.showPeople &&
        props.members.map((m) => {
          const on = props.person === m.userId
          return (
            <button
              key={m.userId}
              aria-pressed={on}
              onClick={() => props.onPerson(on ? null : m.userId)}
              className={clsx('flex min-h-10 shrink-0 items-center gap-1.5 rounded-full py-0.5 pr-3 pl-0.5 text-sm font-semibold', on ? 'text-white' : 'bg-card text-ink-2 shadow-sm')}
              style={on ? { background: m.colour } : undefined}
            >
              <Avatar emoji={m.emoji} colour={m.colour} size="sm" className={on ? 'bg-white!' : ''} /> {m.displayName}
            </button>
          )
        })}
      {props.showPeople && <span className="mx-1 w-px shrink-0 bg-line" aria-hidden />}
      {props.categories.map((c) => {
        const on = props.category === c.id
        return (
          <button
            key={c.id}
            aria-pressed={on}
            onClick={() => props.onCategory(on ? null : c.id)}
            className={clsx('min-h-10 shrink-0 rounded-full px-3 text-sm font-semibold', on ? 'text-white' : 'bg-card text-ink-2 shadow-sm')}
            style={on ? { background: c.colour } : undefined}
          >
            {c.emoji} {c.name}
          </button>
        )
      })}
    </div>
  )
}

function NoTasks() {
  const { family, members, isAdmin } = useCurrentFamily()
  const qc = useQueryClient()
  const categories = useCategories().data ?? []
  const today = useToday()
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  return (
    <Card>
      <EmptyState emoji="🧹" title="No chores yet">
        Tap <strong>+</strong> to add the first one{isAdmin && ', or add some examples to try things out'}.
      </EmptyState>
      {isAdmin && (
        <div className="flex justify-center pb-6">
          <Button
            variant="secondary"
            loading={busy}
            icon={<Wand2 className="size-5" />}
            onClick={async () => {
              setBusy(true)
              try {
                await addDemoTasks(family.id, members, categories, today)
                await qc.invalidateQueries({ queryKey: taskKeys.tasks(family.id) })
                toast('Example chores added')
              } catch (e) {
                toast(friendlyError(e), 'error')
              } finally {
                setBusy(false)
              }
            }}
          >
            Add example chores
          </Button>
        </div>
      )}
    </Card>
  )
}
