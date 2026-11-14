import clsx from 'clsx'
import { Check, MapPin } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { ColourPicker } from '@/components/ui/ColourPicker'
import { Field } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { Toggle } from '@/components/ui/Toggle'
import { useToast } from '@/components/ui/Toast'
import { useCurrentFamily } from '@/family/FamilyProvider'
import type { CalEvent, EventRepeat } from '@/lib/calendar/events'
import { readableTextOn } from '@/lib/colours'
import { addDays, daysBetween } from '@/lib/dates'
import { friendlyError } from '@/lib/errors'
import { fieldErrors, eventSchema } from '@/lib/validation'
import { SecretHint, useSecretField } from '@/features/encryption/useSecretField'
import { useEventTypes, useSaveEvent, type EventInput } from './api'

export const EVENT_REPEATS: { value: EventRepeat; label: string }[] = [
  { value: 'once', label: 'Once' },
  { value: 'daily', label: 'Every day' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: 'Fortnightly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

export const EVENT_REMINDERS: { value: number | null; label: string }[] = [
  { value: null, label: 'No reminder' },
  { value: 0, label: 'When it starts' },
  { value: 15, label: '15 minutes before' },
  { value: 60, label: '1 hour before' },
  { value: 120, label: '2 hours before' },
  { value: 1440, label: '1 day before' },
  { value: 2880, label: '2 days before' },
  { value: 10080, label: '1 week before' },
]

interface Props {
  open: boolean
  onClose: () => void
  event?: CalEvent | null
  defaultDate: string
}

function initial(e: CalEvent | null | undefined, date: string): { data: EventInput; attendees: string[] } {
  if (e)
    return {
      data: {
        title: e.title,
        type_id: e.typeId,
        start_date: e.startDate,
        end_date: e.endDate,
        all_day: e.allDay,
        start_time: e.startTime?.slice(0, 5) ?? null,
        end_time: e.endTime?.slice(0, 5) ?? null,
        location: e.location,
        notes: e.notes,
        colour: e.colour,
        repeat: e.repeat,
        repeat_until: e.repeatUntil,
        reminder_minutes: e.reminderMinutes,
      },
      attendees: e.attendees.map((a) => a.userId),
    }
  return {
    data: {
      title: '',
      type_id: null,
      start_date: date,
      end_date: date,
      all_day: true,
      start_time: null,
      end_time: null,
      location: '',
      notes: '',
      colour: null,
      repeat: 'once',
      repeat_until: null,
      reminder_minutes: null,
    },
    attendees: [],
  }
}

export function EventSheet({ open, onClose, event, defaultDate }: Props) {
  const { members } = useCurrentFamily()
  const types = useEventTypes().data ?? []
  const save = useSaveEvent()
  const toast = useToast()
  const [state, setState] = useState(() => initial(event, defaultDate))
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [customColour, setCustomColour] = useState(!!event?.colour)

  useEffect(() => {
    if (open) {
      setState(initial(event, defaultDate))
      setErrors({})
      setCustomColour(!!event?.colour)
    }
  }, [open, event, defaultDate])

  const d = state.data
  const set = <K extends keyof EventInput>(k: K, v: EventInput[K]) => setState((s) => ({ ...s, data: { ...s.data, [k]: v } }))
  const patch = (p: Partial<EventInput>) => setState((s) => ({ ...s, data: { ...s.data, ...p } }))
  const notes = useSecretField(open, 'events.notes', event?.notes, (v) => set('notes', v))
  const location = useSecretField(open, 'events.location', event?.location, (v) => set('location', v))
  const toggleAttendee = (id: string) =>
    setState((s) => ({ ...s, attendees: s.attendees.includes(id) ? s.attendees.filter((a) => a !== id) : [...s.attendees, id] }))

  function pickType(id: string | null) {
    const t = types.find((x) => x.id === id)
    // Birthdays: all day, every year.
    if (t?.name === 'Birthday') patch({ type_id: id, all_day: true, repeat: 'yearly' })
    else set('type_id', id)
  }

  async function submit() {
    const parsed = eventSchema.safeParse({ ...d, colour: customColour ? d.colour : null })
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    setErrors({})
    try {
      const data = { ...parsed.data, notes: await notes.seal(parsed.data.notes), location: await location.seal(parsed.data.location) }
      await save.mutateAsync({ id: event?.id, data, attendees: state.attendees })
      toast(event ? 'Event updated' : 'Event added')
      onClose()
    } catch (e) {
      toast(friendlyError(e), 'error')
    }
  }

  const selectedType = types.find((t) => t.id === d.type_id)

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={event ? 'Edit event' : 'New event'}
      footer={
        <Button full onClick={submit} loading={save.isPending}>
          {event ? 'Save changes' : 'Add event'}
        </Button>
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        <Field label="What’s happening?" placeholder="e.g. Grandma’s birthday" value={d.title} onChange={(e) => set('title', e.target.value)} error={errors.title} maxLength={100} data-autofocus />

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink-2">Type</legend>
          <div className="flex flex-wrap gap-2">
            {types.map((t) => {
              const on = d.type_id === t.id
              return (
                <button
                  key={t.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => pickType(on ? null : t.id)}
                  className={clsx('inline-flex min-h-10 items-center gap-1 rounded-full border-2 px-3 text-[15px] font-semibold', on ? 'border-transparent' : 'border-line bg-card text-ink-2')}
                  style={on ? { background: t.colour, color: readableTextOn(t.colour) } : undefined}
                >
                  {on && <Check className="size-4" strokeWidth={3} aria-hidden />}
                  {t.emoji} {t.name}
                </button>
              )
            })}
          </div>
        </fieldset>

        <div className="-mx-4 rounded-2xl bg-card-2">
          <Toggle label="All day" checked={d.all_day} onChange={(v) => patch({ all_day: v, start_time: v ? null : (d.start_time ?? '09:00'), end_time: v ? null : (d.end_time ?? '10:00') })} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Starts"
            type="date"
            value={d.start_date}
            onChange={(e) => {
              const v = e.target.value
              if (!v) return
              // Keep the same length when the start moves.
              patch({ start_date: v, end_date: addDays(v, Math.max(0, daysBetween(d.start_date, d.end_date))) })
            }}
            error={errors.start_date}
          />
          <Field label="Ends" type="date" value={d.end_date} min={d.start_date} onChange={(e) => set('end_date', e.target.value)} error={errors.end_date} />
          {!d.all_day && (
            <>
              <Field label="Start time" type="time" value={d.start_time ?? ''} onChange={(e) => set('start_time', e.target.value || null)} error={errors.start_time} />
              <Field label="End time" type="time" value={d.end_time ?? ''} onChange={(e) => set('end_time', e.target.value || null)} error={errors.end_time} />
            </>
          )}
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink-2">Who’s going?</legend>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setState((s) => ({ ...s, attendees: s.attendees.length === members.length ? [] : members.map((m) => m.userId) }))}
              className="min-h-12 rounded-full bg-card-2 px-4 font-semibold text-ink-2"
            >
              {state.attendees.length === members.length ? 'Clear' : 'Everyone'}
            </button>
            {members.map((m) => {
              const on = state.attendees.includes(m.userId)
              return (
                <button
                  key={m.userId}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleAttendee(m.userId)}
                  className={clsx('flex min-h-12 items-center gap-2 rounded-full py-1 pr-4 pl-1 font-semibold', on ? 'text-white' : 'bg-card-2 text-ink-2')}
                  style={on ? { background: m.colour, color: readableTextOn(m.colour) } : undefined}
                >
                  <Avatar emoji={m.emoji} colour={m.colour} size="sm" className="bg-white!" />
                  {m.displayName}
                  {on && <Check className="size-4" strokeWidth={3} aria-hidden />}
                </button>
              )
            })}
          </div>
        </fieldset>

        <div className="relative">
          <Field
            label="Location (optional)"
            placeholder={location.locked ? '🔒 Encrypted' : 'Where?'}
            value={location.locked ? '' : d.location}
            disabled={location.locked}
            onChange={(e) => set('location', e.target.value)}
            maxLength={300}
            hint={location.locked || location.encrypted ? <SecretHint {...location} /> : undefined}
          />
          <MapPin className="pointer-events-none absolute top-11 right-3 size-5 text-ink-3" aria-hidden />
        </div>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink-2">Repeat</legend>
          <div className="flex flex-wrap gap-2">
            {EVENT_REPEATS.map((o) => (
              <button
                key={o.value}
                type="button"
                aria-pressed={d.repeat === o.value}
                onClick={() => set('repeat', o.value)}
                className={clsx('min-h-10 rounded-full border-2 px-3.5 text-[15px] font-semibold', d.repeat === o.value ? 'border-transparent bg-brand-500 text-white' : 'border-line bg-card text-ink-2')}
              >
                {o.label}
              </button>
            ))}
          </div>
        </fieldset>
        {d.repeat !== 'once' && (
          <Field
            label="Until (optional)"
            type="date"
            value={d.repeat_until ?? ''}
            min={d.start_date}
            onChange={(e) => set('repeat_until', e.target.value || null)}
            error={errors.repeat_until}
            hint="Leave empty to repeat forever (great for birthdays)"
          />
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink-2">Reminder</span>
          <select
            value={d.reminder_minutes ?? ''}
            onChange={(e) => set('reminder_minutes', e.target.value === '' ? null : Number(e.target.value))}
            className="min-h-12 rounded-xl border border-line bg-card px-3"
          >
            {EVENT_REMINDERS.map((o) => (
              <option key={String(o.value)} value={o.value ?? ''}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="text-sm text-ink-3">Notifications are switched on in Phase 5.{d.all_day && ' All-day reminders count back from 9am.'}</span>
        </label>

        <div>
          <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-2">
            <input
              type="checkbox"
              className="size-5 accent-brand-500"
              checked={customColour}
              onChange={(e) => {
                setCustomColour(e.target.checked)
                if (e.target.checked && !d.colour) set('colour', selectedType?.colour ?? '#7B61FF')
              }}
            />
            Choose a colour {selectedType && !customColour && <span className="font-normal text-ink-3">(using the {selectedType.name} colour)</span>}
          </label>
          {customColour && <ColourPicker value={d.colour ?? '#7B61FF'} onChange={(c) => set('colour', c)} label="Event colour" />}
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink-2">Notes (optional)</span>
          <textarea
            value={notes.locked ? '' : d.notes}
            onChange={(e) => set('notes', e.target.value)}
            maxLength={2000}
            rows={3}
            disabled={notes.locked}
            placeholder={notes.locked ? '🔒 Encrypted' : 'Presents to buy, what to bring…'}
            className="rounded-xl border border-line bg-card px-4 py-3 placeholder:text-ink-3 focus:border-brand-500 focus:outline-none disabled:opacity-60"
          />
          <SecretHint {...notes} />
        </label>
      </div>
    </Sheet>
  )
}
