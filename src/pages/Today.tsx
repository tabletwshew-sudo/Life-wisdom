import { CalendarDays, ChevronRight, Flame, Star, UtensilsCrossed } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { InstallCard } from '@/components/InstallCard'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, SectionTitle } from '@/components/ui/Card'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useToast } from '@/components/ui/Toast'
import { useCategories, useToggleCompletion } from '@/features/tasks/api'
import { TaskDetailSheet } from '@/features/tasks/TaskDetailSheet'
import { TaskRow } from '@/features/tasks/TaskRow'
import { TaskSheet } from '@/features/tasks/TaskSheet'
import { useNewTracker } from '@/features/tasks/useNewTracker'
import { useOccurrences } from '@/features/tasks/useOccurrences'
import { useCurrentFamily } from '@/family/FamilyProvider'
import { useNowTime, useToday } from '@/hooks/useToday'
import { tint } from '@/lib/colours'
import { addDays, formatDate, startOfWeek } from '@/lib/dates'
import { friendlyError } from '@/lib/errors'
import { belongsTo, isOverdueToday, pointsFor, progress, streak, type Occurrence, type Task } from '@/lib/tasks/model'

function greeting(time: string) {
  const h = Number(time.slice(0, 2))
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function Today() {
  const { me, members, family, isAdmin } = useCurrentFamily()
  const today = useToday()
  const now = useNowTime()
  const { occurrences, tasks, completions } = useOccurrences(addDays(today, -60), today, today)
  const categories = useCategories().data ?? []
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])
  const toggle = useToggleCompletion()
  const toast = useToast()
  const [detail, setDetail] = useState<Occurrence | null>(null)
  const [editing, setEditing] = useState<Task | null>(null)

  const todays = occurrences.filter((o) => o.date === today)
  const family_p = progress(todays)
  const mine = todays.filter((o) => belongsTo(o, me.userId))
  const shown = (isAdmin ? todays : mine).filter((o) => o.status !== 'done').slice(0, 8)
  const weekStart = startOfWeek(today, family.week_starts_on)
  const shownTasks = shown.map((o) => o.task)
  const isNew = useNewTracker(tasks, shownTasks)

  return (
    <>
      <PageHeader subtitle={formatDate(today, { weekday: 'long', day: 'numeric', month: 'long' })} title={`${greeting(now)}, ${me.displayName} ${me.emoji}`} />

      <InstallCard />

      <div className="grid gap-4 md:grid-cols-[auto_1fr]">
        <Card className="flex items-center gap-5 p-5">
          <ProgressRing value={family_p.ratio} label="Family progress today">
            <span className="text-2xl font-extrabold">
              {family_p.done}/{family_p.total}
            </span>
            <span className="text-xs font-semibold text-ink-3">done today</span>
          </ProgressRing>
          <div>
            <p className="text-lg font-bold">{family.name}</p>
            <p className="text-ink-3">
              {family_p.total === 0
                ? 'No chores today.'
                : family_p.done === family_p.total
                  ? 'Everything’s done! 🎉'
                  : `${family_p.total - family_p.done} still to do`}
            </p>
          </div>
        </Card>

        <Card className="p-4">
          <SectionTitle>Everyone</SectionTitle>
          <ul className="flex flex-wrap gap-4">
            {members.map((m) => {
              const p = progress(todays.filter((o) => belongsTo(o, m.userId)))
              const s = streak(occurrences, m.userId, today)
              return (
                <li key={m.userId} className="flex flex-col items-center gap-0.5">
                  <ProgressRing value={p.ratio} size={64} stroke={6} colour={m.colour} track={tint(m.colour, 0.3)} label={`${m.displayName}'s progress`}>
                    <span className="text-2xl" aria-hidden>
                      {m.emoji}
                    </span>
                  </ProgressRing>
                  <span className="text-sm font-semibold">{m.displayName}</span>
                  <span className="flex items-center gap-2 text-xs font-semibold text-ink-3">
                    {p.done}/{p.total}
                    {s > 0 && (
                      <span className="inline-flex items-center text-orange-600 dark:text-orange-400" title={`${s}-day streak`}>
                        <Flame className="size-3.5" aria-hidden />
                        {s}
                      </span>
                    )}
                    {family.points_enabled && (
                      <span className="inline-flex items-center text-amber-600 dark:text-amber-400" title="Points this week">
                        <Star className="size-3.5" aria-hidden />
                        {pointsFor(completions, m.userId, weekStart, today)}
                      </span>
                    )}
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>
      </div>

      <section className="mt-6">
        <SectionTitle
          action={
            <Link to="/tasks" className="inline-flex min-h-9 items-center text-sm font-semibold text-brand-600 dark:text-brand-400">
              All tasks <ChevronRight className="size-4" aria-hidden />
            </Link>
          }
        >
          {isAdmin ? 'Still to do today' : 'Your tasks today'}
        </SectionTitle>
        {shown.length ? (
          <ul className="flex flex-col gap-2.5">
            {shown.map((o) => (
              <TaskRow
                key={o.key}
                occ={o}
                today={today}
                isNew={isNew(o.task)}
                category={o.task.categoryId ? catById.get(o.task.categoryId) : undefined}
                overdue={isOverdueToday(o, today, now)}
                onOpen={setDetail}
                onToggle={(x) =>
                  toggle.mutate(
                    { taskId: x.task.id, date: x.date, forUser: x.forUser, existing: x.completion },
                    { onError: (e) => toast(friendlyError(e), 'error') },
                  )
                }
              />
            ))}
          </ul>
        ) : (
          <Card className="p-5 text-center text-ink-3">{(isAdmin ? todays : mine).length ? 'All done for today! 🎉' : 'Nothing to do today 🌤️'}</Card>
        )}
      </section>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <PlaceholderCard to="/calendar" icon={<CalendarDays className="size-6" />} title="Today’s events" text="The calendar arrives in Phase 3." />
        <PlaceholderCard to="/food" icon={<UtensilsCrossed className="size-6" />} title="What’s for dinner?" text="Meal planning arrives in Phase 4." />
      </div>

      <TaskDetailSheet occ={detail} today={today} onClose={() => setDetail(null)} onEdit={(t) => (setDetail(null), setEditing(t))} />
      <TaskSheet open={!!editing} task={editing} defaultDate={today} onClose={() => setEditing(null)} />
    </>
  )
}

function PlaceholderCard({ to, icon, title, text }: { to: string; icon: React.ReactNode; title: string; text: string }) {
  return (
    <Link to={to}>
      <Card className="flex h-full items-start gap-3 p-4 transition hover:-translate-y-0.5">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-brand-100 text-brand-600 dark:bg-brand-700/40 dark:text-brand-200" aria-hidden>
          {icon}
        </span>
        <div>
          <p className="font-bold">{title}</p>
          <p className="text-sm text-ink-3">{text}</p>
        </div>
      </Card>
    </Link>
  )
}
