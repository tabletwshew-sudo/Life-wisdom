import clsx from 'clsx'
import { Check, Minus, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { ColourPicker } from '@/components/ui/ColourPicker'
import { Field } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { useCurrentFamily } from '@/family/FamilyProvider'
import { readableTextOn } from '@/lib/colours'
import { formatDate } from '@/lib/dates'
import { friendlyError } from '@/lib/errors'
import { REPEAT_OPTIONS, describeRule, type Repeat } from '@/lib/tasks/recurrence'
import type { Task } from '@/lib/tasks/model'
import { fieldErrors, taskSchema } from '@/lib/validation'
import { SecretHint, useSecretField } from '@/features/encryption/useSecretField'
import { useCategories, useSaveTask, type TaskInput } from './api'

export const TASK_EMOJI = [
  '🛏️', '🍽️', '👕', '🧺', '🧹', '🧽', '🗑️', '♻️', '🐶', '🐱', '🐟', '🐰',
  '🪴', '🦷', '🚿', '📚', '🎒', '✏️', '🎹', '⚽', '🛒', '🍳', '🚗', '💊',
  '🧸', '🧦', '🪥', '🌱', '📦', '💧', '🧼', '⭐',
]

export const REMINDER_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'No reminder' },
  { value: 0, label: 'At the time' },
  { value: 10, label: '10 minutes before' },
  { value: 30, label: '30 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 120, label: '2 hours before' },
  { value: 1440, label: '1 day before' },
]

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 0]
const WD_LABEL = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
const WD_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

interface Props {
  open: boolean
  onClose: () => void
  task?: Task | null
  defaultDate: string
  onSaved?: (id: string) => void
}

function initial(task: Task | null | undefined, defaultDate: string, defaultAssignee: string | null): { data: TaskInput; assignees: string[] } {
  if (task)
    return {
      data: {
        title: task.title,
        notes: task.notes,
        emoji: task.emoji,
        category_id: task.categoryId,
        colour: task.colour,
        start_date: task.startDate,
        due_time: task.dueTime?.slice(0, 5) ?? null,
        repeat: task.repeat,
        repeat_days: task.repeatDays,
        repeat_until: task.repeatUntil,
        completion_mode: task.completionMode,
        points: task.points,
        reminder_minutes: task.reminderMinutes,
      },
      assignees: task.assignees.map((a) => a.userId),
    }
  return {
    data: {
      title: '',
      notes: '',
      emoji: '✅',
      category_id: null,
      colour: null,
      start_date: defaultDate,
      due_time: null,
      repeat: 'daily',
      repeat_days: [1, 2, 3, 4, 5],
      repeat_until: null,
      completion_mode: 'each',
      points: 1,
      reminder_minutes: null,
    },
    assignees: defaultAssignee ? [defaultAssignee] : [],
  }
}

export function TaskSheet({ open, onClose, task, defaultDate, onSaved }: Props) {
  const { members, me, isAdmin, family } = useCurrentFamily()
  const categories = useCategories().data ?? []
  const save = useSaveTask()
  const toast = useToast()
  const [state, setState] = useState(() => initial(task, defaultDate, isAdmin ? null : me.userId))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [customColour, setCustomColour] = useState(!!task?.colour)

  useEffect(() => {
    if (open) {
      setState(initial(task, defaultDate, isAdmin ? null : me.userId))
      setErrors({})
      setCustomColour(!!task?.colour)
    }
  }, [open, task, defaultDate, isAdmin, me.userId])

  const d = state.data
  const set = <K extends keyof TaskInput>(k: K, v: TaskInput[K]) => setState((s) => ({ ...s, data: { ...s.data, [k]: v } }))
  const notes = useSecretField(open, 'tasks.notes', task?.notes, (v) => set('notes', v))
  const toggleAssignee = (id: string) =>
    setState((s) => ({ ...s, assignees: s.assignees.includes(id) ? s.assignees.filter((a) => a !== id) : [...s.assignees, id] }))

  async function submit() {
    const parsed = taskSchema.safeParse({ ...d, colour: customColour ? d.colour : null })
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error))
      return
    }
    setErrors({})
    try {
      const data = { ...parsed.data, notes: await notes.seal(parsed.data.notes) }
      const id = await save.mutateAsync({ id: task?.id, data, assignees: state.assignees })
      toast(task ? 'Task updated' : 'Task added')
      onSaved?.(id)
      onClose()
    } catch (e) {
      toast(friendlyError(e), 'error')
    }
  }

  const selectedCategory = categories.find((c) => c.id === d.category_id)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={task ? 'Edit task' : 'New task'}
      footer={
        <Button full onClick={submit} loading={save.isPending}>
          {task ? 'Save changes' : 'Add task'}
        </Button>
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        <div className="flex items-end gap-3">
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-card-2 text-3xl" aria-hidden>
            {d.emoji}
          </span>
          <Field
            label="What needs doing?"
            placeholder="e.g. Make the bed"
            value={d.title}
            onChange={(e) => set('title', e.target.value)}
            error={errors.title}
            maxLength={80}
            className="flex-1"
            data-autofocus
          />
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-ink-2">Emoji</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Task emoji">
            {TASK_EMOJI.map((e) => (
              <button
                key={e}
                type="button"
                aria-label={`Choose ${e}`}
                aria-pressed={d.emoji === e}
                onClick={() => set('emoji', e)}
                className={clsx(
                  'flex size-12 shrink-0 items-center justify-center rounded-2xl text-2xl',
                  d.emoji === e ? 'bg-brand-100 ring-3 ring-brand-500 dark:bg-brand-700/40' : 'bg-card-2',
                )}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink-2">Who?</legend>
          <div className="flex flex-wrap gap-2">
            {members.map((m) => {
              const on = state.assignees.includes(m.userId)
              return (
                <button
                  key={m.userId}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleAssignee(m.userId)}
                  className={clsx(
                    'flex min-h-12 items-center gap-2 rounded-full py-1 pr-4 pl-1 font-semibold transition',
                    on ? 'text-white' : 'bg-card-2 text-ink-2',
                  )}
                  style={on ? { background: m.colour } : undefined}
                >
                  <Avatar emoji={m.emoji} colour={m.colour} size="sm" className="bg-white!" />
                  {m.displayName}
                  {on && <Check className="size-4" strokeWidth={3} aria-hidden />}
                </button>
              )
            })}
          </div>
          {state.assignees.length === 0 && <p className="mt-2 text-sm text-ink-3">Nobody picked: anyone in the family can do it.</p>}
          {state.assignees.length > 1 && (
            <div role="radiogroup" aria-label="How is it done" className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-card-2 p-1">
              {(
                [
                  ['each', 'Each person does it'],
                  ['any', 'Anyone can do it'],
                ] as const
              ).map(([v, label]) => (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={d.completion_mode === v}
                  onClick={() => set('completion_mode', v)}
                  className={clsx('min-h-11 rounded-xl px-2 text-sm font-semibold', d.completion_mode === v ? 'bg-card shadow-sm' : 'text-ink-3')}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink-2">Repeat</legend>
          <div className="flex flex-wrap gap-2">
            {REPEAT_OPTIONS.map((o) => (
              <Chip key={o.value} on={d.repeat === o.value} onClick={() => set('repeat', o.value as Repeat)}>
                {o.label}
              </Chip>
            ))}
          </div>
          {d.repeat === 'weekdays' && (
            <div className="mt-3 flex justify-between gap-1" role="group" aria-label="Days of the week">
              {WEEKDAYS.map((wd) => {
                const on = d.repeat_days.includes(wd)
                return (
                  <button
                    key={wd}
                    type="button"
                    aria-pressed={on}
                    aria-label={WD_NAME[wd]}
                    onClick={() => set('repeat_days', on ? d.repeat_days.filter((x) => x !== wd) : [...d.repeat_days, wd])}
                    className={clsx('size-11 rounded-full font-bold', on ? 'bg-brand-500 text-white' : 'bg-card-2 text-ink-2')}
                  >
                    {WD_LABEL[wd]}
                  </button>
                )
              })}
            </div>
          )}
          {errors.repeat_days && <p className="mt-2 text-sm font-medium text-red-600">{errors.repeat_days}</p>}
          <p className="mt-2 text-sm text-ink-3">
            {describeRule(
              { repeat: d.repeat, repeatDays: d.repeat_days, startDate: d.start_date, repeatUntil: d.repeat_until },
              family.week_starts_on,
            )}
          </p>
        </fieldset>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label={d.repeat === 'once' ? 'Date' : 'Starting'}
            type="date"
            value={d.start_date}
            onChange={(e) => set('start_date', e.target.value)}
            error={errors.start_date}
          />
          <Field
            label="Time (optional)"
            type="time"
            value={d.due_time ?? ''}
            onChange={(e) => set('due_time', e.target.value || null)}
          />
        </div>
        {d.repeat !== 'once' && (
          <Field
            label="Until (optional)"
            type="date"
            value={d.repeat_until ?? ''}
            min={d.start_date}
            onChange={(e) => set('repeat_until', e.target.value || null)}
            error={errors.repeat_until}
            hint={d.repeat_until ? `Last time: ${formatDate(d.repeat_until, { day: 'numeric', month: 'long', year: 'numeric' })}` : 'Leave empty to repeat forever'}
          />
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink-2">Reminder</span>
          <select
            value={d.reminder_minutes ?? ''}
            onChange={(e) => set('reminder_minutes', e.target.value === '' ? null : Number(e.target.value))}
            className="min-h-12 rounded-xl border border-line bg-card px-3"
          >
            {REMINDER_OPTIONS.map((o) => (
              <option key={String(o.value)} value={o.value ?? ''}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="text-sm text-ink-3">{d.due_time ? 'Notifications are switched on in Phase 5.' : 'Without a time, reminders are sent at 8am.'}</span>
        </label>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink-2">Category</legend>
          <div className="flex flex-wrap gap-2">
            <Chip on={!d.category_id} onClick={() => set('category_id', null)}>
              None
            </Chip>
            {categories.map((c) => (
              <Chip key={c.id} on={d.category_id === c.id} onClick={() => set('category_id', c.id)} colour={c.colour}>
                {c.emoji} {c.name}
              </Chip>
            ))}
          </div>
        </fieldset>

        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-2">
            <input type="checkbox" className="size-5 accent-brand-500" checked={customColour} onChange={(e) => {
              setCustomColour(e.target.checked)
              if (e.target.checked && !d.colour) set('colour', selectedCategory?.colour ?? '#7B61FF')
            }} />
            Choose a colour {selectedCategory && !customColour && <span className="font-normal text-ink-3">(using the {selectedCategory.name} colour)</span>}
          </label>
          {customColour && <ColourPicker value={d.colour ?? '#7B61FF'} onChange={(c) => set('colour', c)} label="Task colour" />}
        </div>

        {family.points_enabled && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-ink-2">Points ⭐</span>
            <div className="flex items-center gap-3">
              <button type="button" aria-label="Fewer points" onClick={() => set('points', Math.max(0, d.points - 1))} className="flex size-11 items-center justify-center rounded-full bg-card-2">
                <Minus className="size-5" aria-hidden />
              </button>
              <span className="w-6 text-center text-lg font-bold" aria-live="polite">
                {d.points}
              </span>
              <button type="button" aria-label="More points" onClick={() => set('points', Math.min(100, d.points + 1))} className="flex size-11 items-center justify-center rounded-full bg-card-2">
                <Plus className="size-5" aria-hidden />
              </button>
            </div>
          </div>
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink-2">Notes (optional)</span>
          <textarea
            value={notes.locked ? '' : d.notes}
            onChange={(e) => set('notes', e.target.value)}
            maxLength={2000}
            rows={3}
            disabled={notes.locked}
            placeholder={notes.locked ? '🔒 Encrypted' : 'Any details…'}
            className="rounded-xl border border-line bg-card px-4 py-3 placeholder:text-ink-3 focus:border-brand-500 focus:outline-none disabled:opacity-60"
          />
          <SecretHint {...notes} />
        </label>
      </div>
    </Sheet>
  )
}

export function Chip({ on, onClick, children, colour }: { on: boolean; onClick: () => void; children: React.ReactNode; colour?: string }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={clsx(
        'inline-flex min-h-10 items-center gap-1 rounded-full border-2 px-3.5 text-[15px] font-semibold transition',
        on ? 'border-transparent bg-brand-500 text-white' : 'border-line bg-card text-ink-2',
      )}
      style={on && colour ? { background: colour, color: readableTextOn(colour) } : undefined}
    >
      {on && <Check className="size-4" strokeWidth={3} aria-hidden />}
      {children}
    </button>
  )
}
