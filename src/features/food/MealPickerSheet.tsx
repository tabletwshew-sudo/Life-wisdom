import clsx from 'clsx'
import { Search, Shuffle, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { addDays, formatDate, type ISODate } from '@/lib/dates'
import { friendlyError } from '@/lib/errors'
import { cleanText } from '@/lib/validation'
import { SLOTS, useMealPlans, useRecipes, useSetMeal, type Slot } from './api'

interface Props {
  open: boolean
  onClose: () => void
  /** Planning a specific slot from the planner… */
  date?: ISODate
  slot?: Slot
  /** …or planning a specific recipe from its page. */
  presetRecipeId?: string
  defaultDate: ISODate
}

export function MealPickerSheet({ open, onClose, date, slot, presetRecipeId, defaultDate }: Props) {
  const recipes = (useRecipes().data ?? []).filter((r) => !r.is_idea)
  const meals = useMealPlans().data ?? []
  const setMeal = useSetMeal()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [custom, setCustom] = useState('')
  const [pickDate, setPickDate] = useState(date ?? defaultDate)
  const [pickSlot, setPickSlot] = useState<Slot>(slot ?? 'dinner')

  useEffect(() => {
    if (open) {
      setQuery('')
      setCustom('')
      setPickDate(date ?? defaultDate)
      setPickSlot(slot ?? 'dinner')
    }
  }, [open, date, slot, defaultDate])

  const current = meals.find((m) => m.plan_date === pickDate && m.slot === pickSlot)
  const preset = recipes.find((r) => r.id === presetRecipeId)

  // Recipes not eaten recently come first.
  const lastEaten = useMemo(() => {
    const out: Record<string, string> = {}
    for (const m of meals) if (m.recipe_id && (!out[m.recipe_id] || m.plan_date > out[m.recipe_id])) out[m.recipe_id] = m.plan_date
    return out
  }, [meals])
  const list = recipes
    .filter((r) => r.title.toLowerCase().includes(query.toLowerCase().trim()))
    .filter((r) => (pickSlot === 'dinner' || pickSlot === 'lunch' ? r.kind === 'food' : true))
    .sort((a, b) => (lastEaten[a.id] ?? '').localeCompare(lastEaten[b.id] ?? '') || a.title.localeCompare(b.title))

  async function choose(v: { recipeId?: string; customTitle?: string } | 'clear') {
    try {
      if (v === 'clear') await setMeal.mutateAsync({ date: pickDate, slot: pickSlot, clear: true })
      else await setMeal.mutateAsync({ date: pickDate, slot: pickSlot, recipeId: v.recipeId ?? null, customTitle: v.customTitle ?? null })
      toast(v === 'clear' ? 'Removed from the plan' : `Planned for ${formatDate(pickDate, { weekday: 'long' })} ${pickSlot}`)
      onClose()
    } catch (e) {
      toast(friendlyError(e), 'error')
    }
  }

  function surprise() {
    // Pick something not eaten in the last 2 weeks if possible.
    const cutoff = addDays(pickDate, -14)
    const pool = list.filter((r) => !lastEaten[r.id] || lastEaten[r.id] < cutoff)
    const from = pool.length ? pool : list
    if (!from.length) return toast('Add some recipes first, or use Ideas → Suggest something', 'error')
    choose({ recipeId: from[Math.floor(Math.random() * from.length)].id })
  }

  const slotLabel = SLOTS.find((s) => s.slot === pickSlot)!

  return (
    <Sheet open={open} onClose={onClose} title={preset ? `Plan “${preset.title}”` : `${slotLabel.emoji} ${slotLabel.label}, ${formatDate(pickDate, { weekday: 'short', day: 'numeric', month: 'short' })}`}>
      <div className="flex flex-col gap-4 pb-2">
        {preset && (
          <>
            <Field label="Day" type="date" value={pickDate} onChange={(e) => e.target.value && setPickDate(e.target.value)} />
            <div role="radiogroup" aria-label="Meal" className="grid grid-cols-3 gap-1 rounded-2xl bg-card-2 p-1">
              {SLOTS.map((s) => (
                <button
                  key={s.slot}
                  role="radio"
                  aria-checked={pickSlot === s.slot}
                  onClick={() => setPickSlot(s.slot)}
                  className={clsx('min-h-11 rounded-xl text-sm font-semibold', pickSlot === s.slot ? 'bg-card shadow-sm' : 'text-ink-3')}
                >
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>
            {current && <p className="text-sm text-ink-3">This will replace what’s planned.</p>}
            <Button full loading={setMeal.isPending} onClick={() => choose({ recipeId: preset.id })}>
              Add to the plan
            </Button>
          </>
        )}

        {!preset && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" size="md" icon={<Shuffle className="size-5" />} onClick={surprise}>
                Surprise me
              </Button>
              {current ? (
                <Button variant="secondary" size="md" icon={<Trash2 className="size-5" />} onClick={() => choose('clear')} className="text-red-600!">
                  Clear
                </Button>
              ) : (
                <span />
              )}
            </div>

            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                const t = cleanText(custom, 100)
                if (t) choose({ customTitle: t })
              }}
            >
              <Field label="Or type something" placeholder="e.g. Takeaway, Leftovers, Out for dinner" value={custom} onChange={(e) => setCustom(e.target.value)} className="flex-1" maxLength={100} />
              <Button type="submit" size="md" disabled={!custom.trim()}>
                Add
              </Button>
            </form>

            <div className="relative">
              <Search className="pointer-events-none absolute top-3.5 left-3 size-5 text-ink-3" aria-hidden />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search recipes"
                aria-label="Search recipes"
                className="min-h-12 w-full rounded-xl border border-line bg-card pr-4 pl-10"
              />
            </div>
            <ul className="flex flex-col gap-1.5">
              {list.map((r) => (
                <li key={r.id}>
                  <button
                    onClick={() => choose({ recipeId: r.id })}
                    className={clsx('flex min-h-14 w-full items-center gap-3 rounded-2xl px-3 text-left hover:bg-card-2', current?.recipe_id === r.id && 'bg-brand-100 dark:bg-brand-700/30')}
                  >
                    <span className="text-3xl" aria-hidden>
                      {r.emoji}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{r.title}</span>
                      <span className="text-xs text-ink-3">
                        {lastEaten[r.id] ? `Last planned ${formatDate(lastEaten[r.id], { day: 'numeric', month: 'short' })}` : 'Not planned yet'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
              {!list.length && <p className="py-4 text-center text-ink-3">No recipes yet. Add some in the Recipes tab.</p>}
            </ul>
          </>
        )}
      </div>
    </Sheet>
  )
}
