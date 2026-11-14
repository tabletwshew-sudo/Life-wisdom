import { format } from 'date-fns'
import { CalendarDays, CheckSquare, UtensilsCrossed } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Card, SectionTitle } from '@/components/ui/Card'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { useCurrentFamily } from '@/family/FamilyProvider'
import { tint } from '@/lib/colours'
import { InstallCard } from '@/components/InstallCard'

function greeting(d = new Date()) {
  const h = d.getHours()
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

export default function Today() {
  const { me, members, family } = useCurrentFamily()
  const now = new Date()

  return (
    <>
      <PageHeader subtitle={format(now, 'EEEE d MMMM')} title={`${greeting(now)}, ${me.displayName} ${me.emoji}`} />

      <InstallCard />

      <div className="grid gap-4 md:grid-cols-[auto_1fr]">
        <Card className="flex items-center gap-5 p-5">
          <ProgressRing value={0} label="Family progress today">
            <span className="text-2xl font-extrabold">0/0</span>
            <span className="text-xs font-semibold text-ink-3">done today</span>
          </ProgressRing>
          <div>
            <p className="text-lg font-bold">{family.name}</p>
            <p className="text-ink-3">No chores yet today.</p>
          </div>
        </Card>

        <Card className="p-4">
          <SectionTitle>Everyone</SectionTitle>
          <ul className="flex flex-wrap gap-4">
            {members.map((m) => (
              <li key={m.userId} className="flex flex-col items-center gap-1">
                <ProgressRing value={0} size={64} stroke={6} colour={m.colour} track={tint(m.colour, 0.3)} label={`${m.displayName}'s progress`}>
                  <span className="text-2xl" aria-hidden>
                    {m.emoji}
                  </span>
                </ProgressRing>
                <span className="text-sm font-semibold">{m.displayName}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <PlaceholderCard to="/tasks" icon={<CheckSquare className="size-6" />} title="Today’s tasks" text="Chores arrive in Phase 2." />
        <PlaceholderCard to="/calendar" icon={<CalendarDays className="size-6" />} title="Today’s events" text="The calendar arrives in Phase 3." />
        <PlaceholderCard to="/food" icon={<UtensilsCrossed className="size-6" />} title="What’s for dinner?" text="Meal planning arrives in Phase 4." />
      </div>
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
