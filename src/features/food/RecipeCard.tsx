import clsx from 'clsx'
import { Clock, Star } from 'lucide-react'
import { Link } from 'react-router-dom'
import { NewBadge } from '@/features/tasks/StatusIcon'
import type { Recipe } from './api'

export const FOOD_TAGS = ['breakfast', 'lunch', 'dinner', 'dessert', 'snack', 'kid-friendly', 'vegetarian', 'vegan', 'quick']
export const DRINK_TAGS = ['smoothie', 'mocktail', 'cocktail', 'hot drink', 'juice', 'kid-friendly']

const GRADIENTS = ['from-amber-200 to-orange-300', 'from-rose-200 to-pink-300', 'from-emerald-200 to-teal-300', 'from-sky-200 to-indigo-300', 'from-violet-200 to-fuchsia-300', 'from-lime-200 to-green-300']
export function gradientFor(id: string) {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return GRADIENTS[h % GRADIENTS.length]
}

export function totalMinutes(r: Pick<Recipe, 'prep_minutes' | 'cook_minutes'>): number | null {
  const t = (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0)
  return t > 0 ? t : null
}

export function minutesLabel(m: number): string {
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const r = m % 60
  return r ? `${h} h ${r} min` : `${h} h`
}

/** Photo, or the recipe's emoji on a soft gradient. */
export function RecipeImage({ recipe, url, className }: { recipe: Pick<Recipe, 'id' | 'emoji' | 'title'>; url?: string; className?: string }) {
  return url ? (
    <img src={url} alt="" loading="lazy" className={clsx('object-cover', className)} />
  ) : (
    <div className={clsx('flex items-center justify-center bg-gradient-to-br dark:opacity-80', gradientFor(recipe.id), className)} aria-hidden>
      <span className="text-5xl drop-shadow-sm">{recipe.emoji}</span>
    </div>
  )
}

interface Props {
  recipe: Recipe
  photoUrl?: string
  favourite: boolean
  favCount: number
  isNew: boolean
  onToggleFavourite: () => void
}

export function RecipeCard({ recipe, photoUrl, favourite, favCount, isNew, onToggleFavourite }: Props) {
  const mins = totalMinutes(recipe)
  return (
    <li className={clsx('relative overflow-hidden rounded-[var(--radius-card)] bg-card shadow-[var(--shadow-card)]', isNew && 'ring-2 ring-new/60')}>
      <Link to={`/food/recipe/${recipe.id}`} className="block">
        <RecipeImage recipe={recipe} url={photoUrl} className="aspect-[4/3] w-full" />
        <div className="p-3">
          <p className="line-clamp-2 leading-snug font-bold">{recipe.title}</p>
          <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-ink-3">
            {mins && (
              <span className="inline-flex items-center gap-0.5">
                <Clock className="size-3.5" aria-hidden /> {minutesLabel(mins)}
              </span>
            )}
            {recipe.tags.slice(0, 2).map((t) => (
              <span key={t} className="capitalize">
                {t}
              </span>
            ))}
          </p>
        </div>
      </Link>
      {isNew && <NewBadge className="absolute top-2 left-2 shadow" />}
      <button
        onClick={onToggleFavourite}
        aria-pressed={favourite}
        aria-label={favourite ? `Remove ${recipe.title} from your favourites` : `Add ${recipe.title} to your favourites`}
        className="absolute top-2 right-2 flex h-10 min-w-10 items-center justify-center gap-0.5 rounded-full bg-white/90 px-2 text-sm font-bold text-amber-600 shadow dark:bg-black/60"
      >
        <Star className={clsx('size-5', favourite && 'fill-amber-400')} aria-hidden />
        {favCount > 0 && <span>{favCount}</span>}
      </button>
    </li>
  )
}
