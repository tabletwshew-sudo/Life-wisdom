import { Pencil, Trash2 } from 'lucide-react'
import { Secret } from '@/features/encryption/Secret'
import { useRef, useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { useCurrentFamily } from '@/family/FamilyProvider'
import { addDays, formatDate, formatTime } from '@/lib/dates'
import { friendlyError } from '@/lib/errors'
import { buildOccurrences, type Occurrence, type Task } from '@/lib/tasks/model'
import { describeRule } from '@/lib/tasks/recurrence'
import { useCategories, useCompletions, useDeleteTask } from './api'
import { REMINDER_OPTIONS } from './TaskSheet'
import { StatusIcon } from './StatusIcon'

interface Props {
  occ: Occurrence | null
  today: string
  onClose: () => void
  onEdit: (task: Task) => void
}

export function canManageTask(task: Task, userId: string, isAdmin: boolean, canAdd: boolean) {
  return isAdmin || (task.createdBy === userId && canAdd)
}

export function TaskDetailSheet({ occ: current, today, onClose, onEdit }: Props) {
  // Keep showing the last task while the sheet animates closed.
  const last = useRef<Occurrence | null>(null)
  if (current) last.current = current
  const occ = current ?? last.current
  const { me, isAdmin, can, memberById, family } = useCurrentFamily()
  const categories = useCategories().data ?? []
  const del = useDeleteTask()
  const toast = useToast()
  const [confirming, setConfirming] = useState(false)
  const task = occ?.task
  const from = addDays(today, -13)
  const comps = useCompletions(from, today).data ?? []

  if (!task || !occ) return <Sheet open={false} onClose={onClose} title="" children={null} />

  const history = buildOccurrences([task], comps, from, today, today).filter((o) => o.forUser === occ.forUser)
  const category = categories.find((c) => c.id === task.categoryId)
  const manage = canManageTask(task, me.userId, isAdmin, can('addTasks'))
  const creator = memberById(task.createdBy)

  async function remove(keepHistory: boolean) {
    try {
      await del.mutateAsync({ id: task!.id, keepHistory })
      toast('Task deleted')
      setConfirming(false)
      onClose()
    } catch (e) {
      toast(friendlyError(e), 'error')
    }
  }

  return (
    <Sheet open={!!current} onClose={() => { setConfirming(false); onClose() }} title={task.title}>
      <div className="flex flex-col gap-4 pb-2">
        <div className="flex items-center gap-3">
          <span className="text-5xl" aria-hidden>{task.emoji}</span>
          <div className="text-ink-2">
            <p className="font-semibold">{describeRule({ repeat: task.repeat, repeatDays: task.repeatDays, startDate: task.startDate, repeatUntil: task.repeatUntil }, family.week_starts_on)}</p>
            {task.dueTime && <p>at {formatTime(task.dueTime)}</p>}
            {category && <p>{category.emoji} {category.name}</p>}
          </div>
        </div>

        <div>
          <p className="mb-1 text-sm font-semibold text-ink-3">
            {task.assignees.length ? (task.completionMode === 'each' ? 'Each of these people' : 'Any of these people') : 'Anyone in the family'}
          </p>
          <div className="flex flex-wrap gap-2">
            {task.assignees.map((a) => {
              const m = memberById(a.userId)
              return m ? (
                <span key={a.userId} className="flex items-center gap-2 rounded-full bg-card-2 py-1 pr-3 pl-1 font-medium">
                  <Avatar emoji={m.emoji} colour={m.colour} size="sm" /> {m.displayName}
                </span>
              ) : null
            })}
          </div>
        </div>

        {history.length > 0 && (
          <div>
            <p className="mb-2 text-sm font-semibold text-ink-3">Last 2 weeks{occ.forUser && ` · ${memberById(occ.forUser)?.displayName}`}</p>
            <ol className="flex flex-wrap gap-2">
              {history.map((h) => (
                <li key={h.key} className="flex flex-col items-center gap-1 text-xs text-ink-3">
                  <StatusIcon status={h.status} />
                  {formatDate(h.date, { weekday: 'narrow' })}
                  <span className="sr-only">{formatDate(h.date, { weekday: 'long', day: 'numeric', month: 'long' })}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {occ.completion && (
          <p className="rounded-xl bg-card-2 px-3 py-2 text-sm">
            ✅ Done by <strong>{memberById(occ.completion.completedBy)?.displayName ?? 'someone'}</strong> at{' '}
            {new Date(occ.completion.completedAt).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })}
          </p>
        )}

        {task.notes && (
          <div>
            <p className="mb-1 text-sm font-semibold text-ink-3">Notes</p>
            <Secret field="tasks.notes" value={task.notes} className="block whitespace-pre-wrap" />
          </div>
        )}

        <p className="text-sm text-ink-3">
          {task.reminderMinutes != null && `🔔 ${REMINDER_OPTIONS.find((o) => o.value === task.reminderMinutes)?.label}. `}
          {family.points_enabled && `⭐ ${task.points} point${task.points === 1 ? '' : 's'}. `}
          {creator && `Added by ${creator.displayName}.`}
        </p>

        {manage && !confirming && (
          <div className="grid grid-cols-2 gap-2">
            <Button variant="secondary" icon={<Pencil className="size-5" />} onClick={() => onEdit(task)}>
              Edit
            </Button>
            <Button variant="secondary" icon={<Trash2 className="size-5" />} onClick={() => setConfirming(true)} className="text-red-600!">
              Delete
            </Button>
          </div>
        )}
        {confirming && (
          <div className="flex flex-col gap-2 rounded-2xl bg-card-2 p-3">
            <p className="font-semibold">Delete “{task.title}”?</p>
            {task.repeat !== 'once' && (
              <Button variant="secondary" loading={del.isPending} onClick={() => remove(true)}>
                Stop from today (keep history)
              </Button>
            )}
            <Button variant="danger" loading={del.isPending} onClick={() => remove(false)}>
              Delete everything
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
