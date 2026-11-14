import clsx from 'clsx'
import { CheckCheck, Settings, Trash2 } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card, SectionTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { NewBadge } from '@/features/tasks/StatusIcon'
import { useCurrentFamily } from '@/family/FamilyProvider'
import { relativeDay, toISO } from '@/lib/dates'
import { useClearNotifications, useMarkRead, useNotifications, type AppNotification } from './api'

const KIND_ICON: Record<string, string> = {
  task_assigned: '🧹',
  event_invited: '📅',
  recipe_added: '📖',
  task_reminder: '⏰',
  event_reminder: '🔔',
  daily_summary: '☀️',
  test: '🔔',
}

function localDay(ts: string) {
  const d = new Date(ts)
  return toISO(new Date(d.getTime() - d.getTimezoneOffset() * 60_000))
}

export default function NotificationsPage() {
  const q = useNotifications()
  const markRead = useMarkRead()
  const clear = useClearNotifications()
  const navigate = useNavigate()
  const { memberById } = useCurrentFamily()
  const list = q.data ?? []
  const unread = list.filter((n) => !n.read_at).length
  const today = localDay(new Date().toISOString())

  const groups = new Map<string, AppNotification[]>()
  for (const n of list) {
    const k = localDay(n.created_at)
    groups.set(k, [...(groups.get(k) ?? []), n])
  }

  function open(n: AppNotification) {
    if (!n.read_at) markRead.mutate([n.id])
    navigate(n.link || '/')
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        bell={false}
        action={
          <Link to="/more/notifications" aria-label="Notification settings" className="flex size-11 items-center justify-center rounded-full bg-card shadow-sm">
            <Settings className="size-5" aria-hidden />
          </Link>
        }
      />
      {list.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          <Button size="md" variant="secondary" icon={<CheckCheck className="size-5" />} disabled={!unread} onClick={() => markRead.mutate('all')}>
            Mark all read
          </Button>
          <Button size="md" variant="ghost" icon={<Trash2 className="size-4" />} disabled={list.length === unread} loading={clear.isPending} onClick={() => clear.mutate()}>
            Clear read
          </Button>
        </div>
      )}
      {q.isPending ? (
        <Spinner />
      ) : !list.length ? (
        <Card>
          <EmptyState emoji="📭" title="Nothing new">
            You’ll see chores and events you’re given, reminders and your daily summary here.
          </EmptyState>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {[...groups.entries()].map(([day, items]) => (
            <section key={day}>
              <SectionTitle>{relativeDay(day, today)}</SectionTitle>
              <Card className="divide-y divide-line overflow-hidden">
                {items.map((n) => {
                  const actor = memberById(n.actor_id)
                  return (
                    <button
                      key={n.id}
                      onClick={() => open(n)}
                      className={clsx('flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-card-2', !n.read_at && 'bg-new-bg/60')}
                    >
                      {actor ? (
                        <Avatar emoji={actor.emoji} colour={actor.colour} size="md" />
                      ) : (
                        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-card-2 text-2xl" aria-hidden>
                          {KIND_ICON[n.kind] ?? '🔔'}
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start gap-2">
                          <span className={clsx('flex-1', n.read_at ? 'font-medium' : 'font-bold')}>{n.title}</span>
                          {!n.read_at && <NewBadge className="shrink-0" />}
                        </span>
                        {n.body && <span className="block text-sm text-ink-2">{n.body}</span>}
                        <span className="block text-xs text-ink-3">{new Date(n.created_at).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })}</span>
                      </span>
                    </button>
                  )
                })}
              </Card>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
