import clsx from 'clsx'
import { Secret } from '@/features/encryption/Secret'
import { ArrowLeft, CalendarPlus, Clock, ExternalLink, Pencil, ShoppingCart, Star, Trash2, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { useCurrentFamily } from '@/family/FamilyProvider'
import { useToday } from '@/hooks/useToday'
import { friendlyError } from '@/lib/errors'
import { aggregateIngredients } from '@/lib/food/ingredients'
import { useAddShopping, useDeleteRecipe, useFavourites, usePhotoUrls, useRecipes, useToggleFavourite } from './api'
import { MealPickerSheet } from './MealPickerSheet'
import { minutesLabel, RecipeImage } from './RecipeCard'
import { RecipeSheet } from './RecipeSheet'

export default function RecipePage() {
  const { id } = useParams()
  const { me, isAdmin, can, memberById } = useCurrentFamily()
  const recipesQ = useRecipes()
  const favourites = useFavourites().data ?? {}
  const toggleFav = useToggleFavourite()
  const addShopping = useAddShopping()
  const del = useDeleteRecipe()
  const toast = useToast()
  const navigate = useNavigate()
  const today = useToday()
  const [editing, setEditing] = useState(false)
  const [planning, setPlanning] = useState(false)
  const [got, setGot] = useState<Set<number>>(new Set())
  const recipe = recipesQ.data?.find((r) => r.id === id)
  const photo = usePhotoUrls([recipe?.photo_path]).data?.[recipe?.photo_path ?? '']

  if (recipesQ.isPending) return <Spinner />
  if (!recipe)
    return (
      <Card>
        <EmptyState emoji="🤷" title="Recipe not found">
          <Link to="/food?tab=recipes" className="font-semibold text-brand-600">
            Back to recipes
          </Link>
        </EmptyState>
      </Card>
    )

  const back = recipe.is_idea ? '/food?tab=ideas' : recipe.kind === 'drink' ? '/food?tab=drinks' : '/food?tab=recipes'
  const favs = favourites[recipe.id] ?? []
  const mine = favs.includes(me.userId)
  const manage = isAdmin || (recipe.created_by === me.userId && can('addRecipes'))
  const creator = memberById(recipe.created_by)

  async function toShopping() {
    try {
      const lines = aggregateIngredients([{ recipe: recipe!.title, lines: recipe!.ingredients }])
      const res = await addShopping.mutateAsync({ lines, source: 'recipe' })
      toast(res.added ? `Added ${res.added} item${res.added === 1 ? '' : 's'} to the shopping list` : 'Everything is already on the list')
    } catch (e) {
      toast(friendlyError(e), 'error')
    }
  }

  async function remove() {
    if (!confirm(`Delete “${recipe!.title}”? It will also be removed from any meal plans.`)) return
    try {
      await del.mutateAsync(recipe!)
      toast('Deleted')
      navigate(back, { replace: true })
    } catch (e) {
      toast(friendlyError(e), 'error')
    }
  }

  return (
    <article className="mx-auto max-w-3xl">
      <Link to={back} className="mb-3 inline-flex min-h-11 items-center gap-1 font-semibold text-brand-600 dark:text-brand-400">
        <ArrowLeft className="size-5" aria-hidden /> Back
      </Link>
      <div className="relative overflow-hidden rounded-[var(--radius-card)] shadow-[var(--shadow-card)]">
        <RecipeImage recipe={recipe} url={photo} className="aspect-[16/9] w-full" />
        <button
          onClick={() => toggleFav.mutate({ recipeId: recipe.id, on: !mine })}
          aria-pressed={mine}
          aria-label={mine ? 'Remove from your favourites' : 'Add to your favourites'}
          className="absolute top-3 right-3 flex h-12 min-w-12 items-center justify-center gap-1 rounded-full bg-white/90 px-3 font-bold text-amber-600 shadow dark:bg-black/60"
        >
          <Star className={clsx('size-6', mine && 'fill-amber-400')} aria-hidden /> {favs.length > 0 && favs.length}
        </button>
      </div>

      <h1 className="mt-4 text-3xl font-extrabold tracking-tight">{recipe.title}</h1>
      <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-ink-3">
        {recipe.prep_minutes ? <span>Prep {minutesLabel(recipe.prep_minutes)}</span> : null}
        {recipe.cook_minutes ? (
          <span className="inline-flex items-center gap-1">
            <Clock className="size-4" aria-hidden /> Cook {minutesLabel(recipe.cook_minutes)}
          </span>
        ) : null}
        {recipe.servings ? (
          <span className="inline-flex items-center gap-1">
            <Users className="size-4" aria-hidden /> Serves {recipe.servings}
          </span>
        ) : null}
        {favs.length > 0 && <span>⭐ {favs.map((u) => memberById(u)?.displayName).filter(Boolean).join(', ')}</span>}
      </p>
      {recipe.tags.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {recipe.tags.map((t) => (
            <li key={t} className="rounded-full bg-card-2 px-3 py-1 text-sm font-semibold capitalize">
              {t}
            </li>
          ))}
        </ul>
      )}

      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {recipe.ingredients.length > 0 && can('addShopping') && (
          <Button variant="secondary" size="md" icon={<ShoppingCart className="size-5" />} loading={addShopping.isPending} onClick={toShopping}>
            Shopping list
          </Button>
        )}
        {can('addRecipes') && !recipe.is_idea && (
          <Button variant="secondary" size="md" icon={<CalendarPlus className="size-5" />} onClick={() => setPlanning(true)}>
            Plan it
          </Button>
        )}
        {manage && (
          <>
            <Button variant="secondary" size="md" icon={<Pencil className="size-5" />} onClick={() => setEditing(true)}>
              {recipe.is_idea ? 'Edit / make recipe' : 'Edit'}
            </Button>
            <Button variant="secondary" size="md" icon={<Trash2 className="size-5" />} onClick={remove} className="text-red-600!">
              Delete
            </Button>
          </>
        )}
      </div>

      {recipe.source_url && (
        <a href={recipe.source_url} target="_blank" rel="noopener noreferrer nofollow" className="mt-4 inline-flex min-h-11 items-center gap-1.5 font-semibold text-brand-600 dark:text-brand-400">
          <ExternalLink className="size-4" aria-hidden /> Open the original recipe
        </a>
      )}

      <div className="mt-6 grid gap-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        {recipe.ingredients.length > 0 && (
          <section>
            <h2 className="mb-2 text-xl font-bold">Ingredients</h2>
            <ul className="flex flex-col gap-1">
              {recipe.ingredients.map((line, i) => (
                <li key={i}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-card-2">
                    <input
                      type="checkbox"
                      className="size-5 shrink-0 accent-[var(--color-done)]"
                      checked={got.has(i)}
                      onChange={() => setGot((s) => (s.has(i) ? (s.delete(i), new Set(s)) : new Set(s.add(i))))}
                    />
                    <span className={clsx(got.has(i) && 'text-ink-3 line-through')}>{line}</span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        )}
        {recipe.steps.length > 0 && (
          <section>
            <h2 className="mb-2 text-xl font-bold">Steps</h2>
            <ol className="flex flex-col gap-3">
              {recipe.steps.map((s, i) => (
                <li key={i} className="flex gap-3">
                  <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-500 font-bold text-white" aria-hidden>
                    {i + 1}
                  </span>
                  <p className="pt-1 text-[17px] leading-relaxed">{s}</p>
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>

      {recipe.notes && (
        <section className="mt-6">
          <h2 className="mb-2 text-xl font-bold">Notes</h2>
          <Secret field="recipes.notes" value={recipe.notes} className="block whitespace-pre-wrap" />
        </section>
      )}
      {creator && <p className="mt-6 text-sm text-ink-3">Added by {creator.displayName}</p>}

      <RecipeSheet open={editing} recipe={recipe} onClose={() => setEditing(false)} />
      <MealPickerSheet open={planning} onClose={() => setPlanning(false)} presetRecipeId={recipe.id} defaultDate={today} />
    </article>
  )
}
