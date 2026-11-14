import { useQueryClient } from '@tanstack/react-query'
import clsx from 'clsx'
import { Plus, Search, Star, Wand2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { useNewItems } from '@/features/tasks/useNewTracker'
import { useCurrentFamily } from '@/family/FamilyProvider'
import { isNewItem } from '@/lib/tasks/model'
import { useToast } from '@/components/ui/Toast'
import { friendlyError } from '@/lib/errors'
import { foodKeys, useFavourites, usePhotoUrls, useRecipes, useToggleFavourite, type Recipe } from '../api'
import { addDemoRecipes } from '../demo'
import { DRINK_TAGS, FOOD_TAGS, RecipeCard } from '../RecipeCard'
import { RecipeSheet } from '../RecipeSheet'

export const isRecipeNew = (r: Recipe, uid: string, seen: string | undefined) => isNewItem(r.created_by, r.created_at, null, uid, seen)

export function RecipeGrid({ kind }: { kind: 'food' | 'drink' }) {
  const { me, can, isAdmin, family } = useCurrentFamily()
  const qc = useQueryClient()
  const toast = useToast()
  const [demoBusy, setDemoBusy] = useState(false)
  const recipesQ = useRecipes()
  const favourites = useFavourites().data ?? {}
  const toggleFav = useToggleFavourite()
  const [query, setQuery] = useState('')
  const [tag, setTag] = useState<string | null>(null)
  const [onlyFavs, setOnlyFavs] = useState(false)
  const [adding, setAdding] = useState(false)

  const all = useMemo(() => (recipesQ.data ?? []).filter((r) => r.kind === kind && !r.is_idea), [recipesQ.data, kind])
  const shown = all.filter(
    (r) =>
      (!query.trim() || `${r.title} ${r.tags.join(' ')} ${r.ingredients.join(' ')}`.toLowerCase().includes(query.toLowerCase().trim())) &&
      (!tag || r.tags.includes(tag)) &&
      (!onlyFavs || (favourites[r.id] ?? []).includes(me.userId)),
  )
  const photos = usePhotoUrls(shown.map((r) => r.photo_path)).data ?? {}
  const isNew = useNewItems<Recipe>('recipe', shown, isRecipeNew)
  const tags = kind === 'drink' ? DRINK_TAGS : FOOD_TAGS

  return (
    <>
      <div className="mb-3 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute top-3.5 left-3 size-5 text-ink-3" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={kind === 'drink' ? 'Search drinks' : 'Search recipes or ingredients'}
            aria-label={kind === 'drink' ? 'Search drinks' : 'Search recipes'}
            className="min-h-12 w-full rounded-xl border border-line bg-card pr-4 pl-10"
          />
        </div>
        {can('addRecipes') && (
          <Button size="md" icon={<Plus className="size-5" />} onClick={() => setAdding(true)}>
            <span className="hidden sm:inline">{kind === 'drink' ? 'New drink' : 'New recipe'}</span>
            <span className="sm:hidden">New</span>
          </Button>
        )}
      </div>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0" role="group" aria-label="Filters">
        <button
          aria-pressed={onlyFavs}
          onClick={() => setOnlyFavs(!onlyFavs)}
          className={clsx('inline-flex min-h-10 shrink-0 items-center gap-1 rounded-full px-3 text-sm font-semibold', onlyFavs ? 'bg-amber-400 text-black' : 'bg-card text-ink-2 shadow-sm')}
        >
          <Star className={clsx('size-4', onlyFavs && 'fill-current')} aria-hidden /> My favourites
        </button>
        {tags.map((t) => (
          <button
            key={t}
            aria-pressed={tag === t}
            onClick={() => setTag(tag === t ? null : t)}
            className={clsx('min-h-10 shrink-0 rounded-full px-3 text-sm font-semibold capitalize', tag === t ? 'bg-brand-500 text-white' : 'bg-card text-ink-2 shadow-sm')}
          >
            {t}
          </button>
        ))}
      </div>

      {recipesQ.isPending ? (
        <Spinner />
      ) : shown.length === 0 ? (
        <Card>
          <EmptyState emoji={kind === 'drink' ? '🍹' : '📖'} title={all.length ? 'Nothing matches' : kind === 'drink' ? 'No drinks yet' : 'Your recipe book is empty'}>
            {!all.length && 'Add your family’s favourites, or try Ideas → Suggest something.'}
          </EmptyState>
          {!all.length && isAdmin && (
            <div className="flex justify-center pb-6">
              <Button
                variant="secondary"
                icon={<Wand2 className="size-5" />}
                loading={demoBusy}
                onClick={async () => {
                  setDemoBusy(true)
                  try {
                    await addDemoRecipes(family.id, me.userId)
                    await qc.invalidateQueries({ queryKey: foodKeys.recipes(family.id) })
                    toast('Example recipes and drinks added')
                  } catch (e) {
                    toast(friendlyError(e), 'error')
                  } finally {
                    setDemoBusy(false)
                  }
                }}
              >
                Add example recipes
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {shown.map((r) => {
            const favs = favourites[r.id] ?? []
            return (
              <RecipeCard
                key={r.id}
                recipe={r}
                photoUrl={r.photo_path ? photos[r.photo_path] : undefined}
                favourite={favs.includes(me.userId)}
                favCount={favs.length}
                isNew={isNew(r)}
                onToggleFavourite={() => toggleFav.mutate({ recipeId: r.id, on: !favs.includes(me.userId) })}
              />
            )
          })}
        </ul>
      )}
      <RecipeSheet open={adding} onClose={() => setAdding(false)} draft={kind === 'drink' ? DRINK_DRAFT : FOOD_DRAFT} />
    </>
  )
}

const FOOD_DRAFT = { kind: 'food' as const }
const DRINK_DRAFT = { kind: 'drink' as const, emoji: '🥤' }
