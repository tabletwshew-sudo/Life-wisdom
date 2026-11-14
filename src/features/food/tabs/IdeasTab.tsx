import clsx from 'clsx'
import { BookmarkPlus, ExternalLink, Lightbulb, Plus, Shuffle, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card, SectionTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { useToast } from '@/components/ui/Toast'
import { NewBadge } from '@/features/tasks/StatusIcon'
import { useNewItems } from '@/features/tasks/useNewTracker'
import { useCurrentFamily } from '@/family/FamilyProvider'
import { useToday } from '@/hooks/useToday'
import { addDays } from '@/lib/dates'
import { friendlyError } from '@/lib/errors'
import { matchesFilter, suggest, type SuggestFilter, type Suggestion } from '@/lib/food/suggestions'
import { useMealPlans, useRecipes, useSaveRecipe, type Recipe } from '../api'
import { MealPickerSheet } from '../MealPickerSheet'
import { RecipeSheet, type RecipeDraft } from '../RecipeSheet'
import { isRecipeNew } from './RecipeGrid'

const FILTERS: { value: SuggestFilter; label: string }[] = [
  { value: 'any', label: 'Anything' },
  { value: 'dinner', label: '🍽️ Dinner' },
  { value: 'breakfast', label: '🥣 Breakfast' },
  { value: 'lunch', label: '🥪 Lunch' },
  { value: 'dessert', label: '🍰 Dessert' },
  { value: 'vegetarian', label: '🥦 Veggie' },
  { value: 'kid-friendly', label: '🧒 Kid-friendly' },
  { value: 'drink', label: '🥤 Drink' },
]

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

export function IdeasTab() {
  const { can } = useCurrentFamily()
  const recipes = useRecipes().data ?? []
  const ideas = recipes.filter((r) => r.is_idea)
  const isNew = useNewItems<Recipe>('recipe', ideas, isRecipeNew)
  const [draft, setDraft] = useState<RecipeDraft | null>(null)

  return (
    <>
      <SuggestBox onUse={(d) => setDraft(d)} />

      <SectionTitle
        action={
          can('addRecipes') && (
            <Button size="md" variant="secondary" icon={<Plus className="size-5" />} onClick={() => setDraft({ is_idea: true, emoji: '💡' })}>
              Save an idea
            </Button>
          )
        }
      >
        Ideas to try · {ideas.length}
      </SectionTitle>
      {ideas.length ? (
        <ul className="grid gap-2.5 md:grid-cols-2">
          {ideas.map((r) => (
            <li key={r.id}>
              <Link
                to={`/food/recipe/${r.id}`}
                className={clsx('flex min-h-16 items-center gap-3 rounded-2xl bg-card p-3 shadow-[var(--shadow-card)]', isNew(r) && 'ring-2 ring-new/50')}
                style={isNew(r) ? { background: 'var(--color-new-bg)' } : undefined}
              >
                <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-card-2 text-3xl" aria-hidden>
                  {r.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="truncate font-semibold">{r.title}</span>
                    {isNew(r) && <NewBadge />}
                  </span>
                  <span className="flex items-center gap-1 truncate text-sm text-ink-3">
                    {r.source_url ? (
                      <>
                        <ExternalLink className="size-3.5 shrink-0" aria-hidden /> {host(r.source_url)}
                      </>
                    ) : (
                      r.notes.startsWith('enc:') ? '🔒 Private note' : r.notes.slice(0, 60) || `${r.ingredients.length} ingredients`
                    )}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Card>
          <EmptyState emoji="💡" title="No ideas saved yet">
            Save links to recipes you spot online, or tap Suggest something above.
          </EmptyState>
        </Card>
      )}
      <RecipeSheet open={!!draft} draft={draft ?? undefined} onClose={() => setDraft(null)} />
    </>
  )
}

function SuggestBox({ onUse }: { onUse: (draft: RecipeDraft) => void }) {
  const { can } = useCurrentFamily()
  const recipes = useRecipes().data ?? []
  const meals = useMealPlans().data ?? []
  const saveRecipe = useSaveRecipe()
  const toast = useToast()
  const today = useToday()
  const [filter, setFilter] = useState<SuggestFilter>('dinner')
  const [shown, setShown] = useState<string[]>([])
  const [pick, setPick] = useState<{ own?: Recipe; idea?: Suggestion } | null>(null)
  const [planning, setPlanning] = useState<string | null>(null)

  // Family recipes not planned in the last 2 weeks.
  const ownPool = useMemo(() => {
    const recent = new Set(meals.filter((m) => m.plan_date >= addDays(today, -14) && m.recipe_id).map((m) => m.recipe_id))
    return recipes.filter((r) => !r.is_idea && !recent.has(r.id) && matchesFilter({ tags: r.tags, kind: r.kind as 'food' | 'drink' }, filter))
  }, [recipes, meals, today, filter])

  function go() {
    const ownLeft = ownPool.filter((r) => !shown.includes(r.title))
    const own = ownLeft.length ? ownLeft[Math.floor(Math.random() * ownLeft.length)] : undefined
    const idea = suggest(filter, [...shown, ...recipes.map((r) => r.title)]) ?? undefined
    setShown((s) => [...s, ...(own ? [own.title] : []), ...(idea ? [idea.title] : [])].slice(-40))
    setPick({ own, idea })
  }

  async function saveIdea(s: Suggestion) {
    try {
      await saveRecipe.mutateAsync({
        data: { title: s.title, kind: s.kind, is_idea: true, emoji: s.emoji, description: '', photo_path: null, ingredients: s.ingredients, steps: [], prep_minutes: null, cook_minutes: null, servings: null, tags: s.tags.filter((t) => t !== 'drink'), notes: '', source_url: null },
      })
      toast('Saved to ideas')
    } catch (e) {
      toast(friendlyError(e), 'error')
    }
  }

  return (
    <Card className="mb-6 p-4">
      <div className="mb-3 flex items-center gap-2">
        <Lightbulb className="size-6 text-amber-500" aria-hidden />
        <h2 className="text-lg font-bold">Stuck for ideas?</h2>
      </div>
      <div className="-mx-1 mb-3 flex gap-2 overflow-x-auto px-1 pb-1" role="radiogroup" aria-label="What kind of idea">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            role="radio"
            aria-checked={filter === f.value}
            onClick={() => {
              setFilter(f.value)
              setPick(null)
            }}
            className={clsx('min-h-10 shrink-0 rounded-full px-3 text-sm font-semibold', filter === f.value ? 'bg-brand-500 text-white' : 'bg-card-2 text-ink-2')}
          >
            {f.label}
          </button>
        ))}
      </div>
      <Button full icon={pick ? <Shuffle className="size-5" /> : <Sparkles className="size-5" />} onClick={go}>
        {pick ? 'Suggest something else' : 'Suggest something'}
      </Button>

      {pick && (
        <div className="mt-4 grid gap-3 md:grid-cols-2" aria-live="polite">
          {pick.own && (
            <div className="rounded-2xl bg-card-2 p-4">
              <p className="mb-1 text-xs font-bold tracking-wide text-ink-3 uppercase">From your recipe book</p>
              <p className="flex items-center gap-2 text-lg font-bold">
                <span className="text-3xl" aria-hidden>
                  {pick.own.emoji}
                </span>
                {pick.own.title}
              </p>
              <p className="mb-3 text-sm text-ink-3">Not had it for a while!</p>
              <div className="flex flex-wrap gap-2">
                <Link to={`/food/recipe/${pick.own.id}`} className="inline-flex min-h-11 items-center rounded-xl bg-card px-4 font-semibold">
                  View
                </Link>
                {can('addRecipes') && pick.own.kind === 'food' && (
                  <Button size="md" onClick={() => setPlanning(pick.own!.id)}>
                    Plan it
                  </Button>
                )}
              </div>
            </div>
          )}
          {pick.idea && (
            <div className="rounded-2xl bg-card-2 p-4">
              <p className="mb-1 text-xs font-bold tracking-wide text-ink-3 uppercase">Something new</p>
              <p className="flex items-center gap-2 text-lg font-bold">
                <span className="text-3xl" aria-hidden>
                  {pick.idea.emoji}
                </span>
                {pick.idea.title}
              </p>
              <p className="mb-3 line-clamp-2 text-sm text-ink-3">{pick.idea.ingredients.join(' · ')}</p>
              {can('addRecipes') && (
                <div className="flex flex-wrap gap-2">
                  <Button size="md" variant="secondary" icon={<BookmarkPlus className="size-4" />} loading={saveRecipe.isPending} onClick={() => saveIdea(pick.idea!)}>
                    Save to ideas
                  </Button>
                  <Button
                    size="md"
                    onClick={() =>
                      onUse({ title: pick.idea!.title, kind: pick.idea!.kind, emoji: pick.idea!.emoji, ingredients: pick.idea!.ingredients, tags: pick.idea!.tags.filter((t) => t !== 'drink'), is_idea: false })
                    }
                  >
                    Make it a recipe
                  </Button>
                </div>
              )}
            </div>
          )}
          {!pick.own && !pick.idea && <p className="text-ink-3">No ideas left for that. Try another filter!</p>}
        </div>
      )}
      <MealPickerSheet open={!!planning} onClose={() => setPlanning(null)} presetRecipeId={planning ?? undefined} defaultDate={today} />
    </Card>
  )
}
