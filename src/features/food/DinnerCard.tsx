import { ChevronRight, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card, SectionTitle } from '@/components/ui/Card'
import { useCurrentFamily } from '@/family/FamilyProvider'
import type { ISODate } from '@/lib/dates'
import { SLOTS, useMealPlans, usePhotoUrls, useRecipes } from './api'
import { MealPickerSheet } from './MealPickerSheet'
import { RecipeImage } from './RecipeCard'

/** "What's for dinner?" on the Today page, plus breakfast/lunch if planned. */
export function DinnerCard({ today }: { today: ISODate }) {
  const { can } = useCurrentFamily()
  const meals = (useMealPlans().data ?? []).filter((m) => m.plan_date === today)
  const recipes = useRecipes().data ?? []
  const byId = new Map(recipes.map((r) => [r.id, r]))
  const dinner = meals.find((m) => m.slot === 'dinner')
  const dinnerRecipe = dinner?.recipe_id ? byId.get(dinner.recipe_id) : undefined
  const photo = usePhotoUrls([dinnerRecipe?.photo_path]).data?.[dinnerRecipe?.photo_path ?? '']
  const others = meals.filter((m) => m.slot !== 'dinner')
  const [picking, setPicking] = useState(false)

  return (
    <section>
      <SectionTitle
        action={
          <Link to="/food" className="inline-flex min-h-9 items-center text-sm font-semibold text-brand-600 dark:text-brand-400">
            Meal plan <ChevronRight className="size-4" aria-hidden />
          </Link>
        }
      >
        What’s for dinner?
      </SectionTitle>
      <Card className="overflow-hidden">
        {dinner ? (
          <Link to={dinnerRecipe ? `/food/recipe/${dinnerRecipe.id}` : '/food'} className="flex items-center gap-4 p-3">
            {dinnerRecipe ? (
              <RecipeImage recipe={dinnerRecipe} url={photo} className="size-20 shrink-0 rounded-2xl" />
            ) : (
              <span className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-card-2 text-4xl" aria-hidden>
                🍽️
              </span>
            )}
            <span>
              <span className="block text-xl font-extrabold">{dinnerRecipe?.title ?? dinner.custom_title}</span>
              {dinnerRecipe?.cook_minutes ? <span className="text-sm text-ink-3">Cook {dinnerRecipe.cook_minutes} min</span> : null}
            </span>
          </Link>
        ) : (
          <div className="flex flex-wrap items-center gap-3 p-4">
            <span className="text-4xl" aria-hidden>
              🤔
            </span>
            <p className="flex-1 font-semibold text-ink-2">Nothing planned yet.</p>
            {can('addRecipes') && (
              <Button size="md" onClick={() => setPicking(true)}>
                Plan dinner
              </Button>
            )}
            <Link to="/food?tab=ideas" className="inline-flex min-h-11 items-center gap-1 rounded-xl bg-card-2 px-3 font-semibold">
              <Sparkles className="size-4" aria-hidden /> Ideas
            </Link>
          </div>
        )}
        {others.length > 0 && (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 border-t border-line px-4 py-2 text-sm text-ink-2">
            {others.map((m) => {
              const s = SLOTS.find((x) => x.slot === m.slot)!
              return (
                <li key={m.id}>
                  {s.emoji} {s.label}: <strong>{(m.recipe_id && byId.get(m.recipe_id)?.title) || m.custom_title}</strong>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
      <MealPickerSheet open={picking} onClose={() => setPicking(false)} date={today} slot="dinner" defaultDate={today} />
    </section>
  )
}
