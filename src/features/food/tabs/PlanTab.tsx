import clsx from 'clsx'
import { ChevronLeft, ChevronRight, Plus, ShoppingCart } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { useCurrentFamily } from '@/family/FamilyProvider'
import { useToday } from '@/hooks/useToday'
import { addDays, formatDate, parts, range, startOfWeek, type ISODate } from '@/lib/dates'
import { friendlyError } from '@/lib/errors'
import { aggregateIngredients } from '@/lib/food/ingredients'
import { SLOTS, useAddShopping, useMealPlans, usePhotoUrls, useRecipes, type Slot } from '../api'
import { MealPickerSheet } from '../MealPickerSheet'
import { RecipeImage } from '../RecipeCard'

export function PlanTab() {
  const { family, can } = useCurrentFamily()
  const today = useToday()
  const [weekOf, setWeekOf] = useState(() => startOfWeek(today, family.week_starts_on))
  const days = range(weekOf, addDays(weekOf, 6))
  const meals = useMealPlans().data ?? []
  const recipes = useRecipes().data ?? []
  const byId = new Map(recipes.map((r) => [r.id, r]))
  const photos = usePhotoUrls(recipes.map((r) => r.photo_path)).data ?? {}
  const addShopping = useAddShopping()
  const toast = useToast()
  const [picking, setPicking] = useState<{ date: ISODate; slot: Slot } | null>(null)
  const canPlan = can('addRecipes')

  const weekMeals = meals.filter((m) => m.plan_date >= weekOf && m.plan_date <= addDays(weekOf, 6))

  async function weekToShopping() {
    const sources = weekMeals
      .filter((m) => m.recipe_id && m.plan_date >= today)
      .map((m) => byId.get(m.recipe_id!))
      .filter((r) => !!r)
      .map((r) => ({ recipe: r.title, lines: r.ingredients }))
    if (!sources.length) return toast('No planned recipes with ingredients this week (from today on)', 'error')
    try {
      const res = await addShopping.mutateAsync({ lines: aggregateIngredients(sources), source: 'meal_plan' })
      toast(`Added ${res.added} item${res.added === 1 ? '' : 's'}${res.alreadyThere ? ` (${res.alreadyThere} already on the list)` : ''}`)
    } catch (e) {
      toast(friendlyError(e), 'error')
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center gap-2">
        <button onClick={() => setWeekOf(addDays(weekOf, -7))} aria-label="Previous week" className="flex size-11 items-center justify-center rounded-full bg-card shadow-sm">
          <ChevronLeft className="size-5" aria-hidden />
        </button>
        <p className="flex-1 text-center font-bold" aria-live="polite">
          {parts(weekOf).m === parts(addDays(weekOf, 6)).m
            ? `${parts(weekOf).d}–${formatDate(addDays(weekOf, 6), { day: 'numeric', month: 'long' })}`
            : `${formatDate(weekOf, { day: 'numeric', month: 'short' })} – ${formatDate(addDays(weekOf, 6), { day: 'numeric', month: 'short' })}`}
        </p>
        <button onClick={() => setWeekOf(addDays(weekOf, 7))} aria-label="Next week" className="flex size-11 items-center justify-center rounded-full bg-card shadow-sm">
          <ChevronRight className="size-5" aria-hidden />
        </button>
      </div>

      {can('addShopping') && (
        <Button variant="secondary" full icon={<ShoppingCart className="size-5" />} loading={addShopping.isPending} onClick={weekToShopping} className="mb-4">
          Add this week’s ingredients to shopping
        </Button>
      )}

      <ol className="grid gap-3 lg:grid-cols-2">
        {days.map((d) => (
          <li key={d} className={clsx('rounded-[var(--radius-card)] bg-card p-3 shadow-[var(--shadow-card)]', d === today && 'ring-2 ring-brand-400')}>
            <p className="mb-2 px-1 font-bold">
              {formatDate(d, { weekday: 'long', day: 'numeric', month: 'short' })} {d === today && <span className="ml-1 rounded-full bg-brand-500 px-2 py-0.5 text-xs text-white">Today</span>}
            </p>
            <ul className="grid grid-cols-3 gap-2">
              {SLOTS.map(({ slot, label, emoji }) => {
                const meal = weekMeals.find((m) => m.plan_date === d && m.slot === slot)
                const recipe = meal?.recipe_id ? byId.get(meal.recipe_id) : undefined
                const title = recipe?.title ?? meal?.custom_title
                const inner = (
                  <>
                    <span className="block text-[11px] font-bold tracking-wide text-ink-3 uppercase">
                      {emoji} {label}
                    </span>
                    {title ? (
                      <span className="mt-1 flex items-center gap-1.5">
                        {recipe ? (
                          <RecipeImage recipe={recipe} url={recipe.photo_path ? photos[recipe.photo_path] : undefined} className="size-8 shrink-0 rounded-lg [&_span]:text-lg" />
                        ) : null}
                        <span className="line-clamp-2 text-sm leading-tight font-semibold">{title}</span>
                      </span>
                    ) : (
                      <span className="mt-1 flex items-center gap-1 text-sm text-ink-3">{canPlan ? <><Plus className="size-4" aria-hidden /> Add</> : '—'}</span>
                    )}
                  </>
                )
                const cls = 'block h-full min-h-18 w-full rounded-xl bg-card-2 p-2 text-left'
                return (
                  <li key={slot}>
                    {canPlan ? (
                      <button onClick={() => setPicking({ date: d, slot })} className={cls} aria-label={`${label} on ${formatDate(d, { weekday: 'long' })}: ${title ?? 'nothing planned'}`}>
                        {inner}
                      </button>
                    ) : recipe ? (
                      <Link to={`/food/recipe/${recipe.id}`} className={cls}>
                        {inner}
                      </Link>
                    ) : (
                      <div className={cls}>{inner}</div>
                    )}
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ol>
      {!canPlan && <p className="mt-3 px-1 text-sm text-ink-3">Only admins can change the meal plan (they can allow members in Family settings).</p>}

      <MealPickerSheet open={!!picking} onClose={() => setPicking(null)} date={picking?.date} slot={picking?.slot} defaultDate={today} />
    </>
  )
}
