import clsx from 'clsx'
import { Camera, Check, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Field } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { Toggle } from '@/components/ui/Toggle'
import { useToast } from '@/components/ui/Toast'
import { useCurrentFamily } from '@/family/FamilyProvider'
import { friendlyError } from '@/lib/errors'
import { fieldErrors, recipeSchema } from '@/lib/validation'
import { uploadRecipePhoto, usePhotoUrls, useSaveRecipe, type Recipe, type RecipeInput } from './api'
import { DRINK_TAGS, FOOD_TAGS, RecipeImage } from './RecipeCard'

const FOOD_EMOJI = ['🍝', '🍕', '🍔', '🌮', '🍛', '🍲', '🥗', '🍗', '🐟', '🥘', '🍜', '🥞', '🍳', '🥪', '🥧', '🍰', '🍪', '🍫', '🍎', '🥦']
const DRINK_EMOJI = ['🥤', '🍓', '🥭', '🍌', '🍹', '🍸', '🍋', '☕', '🧋', '🫖', '🍷', '🧃']

export type RecipeDraft = Partial<RecipeInput>

interface Props {
  open: boolean
  onClose: () => void
  recipe?: Recipe | null
  /** Pre-filled values for a new recipe (e.g. from a suggestion or an idea). */
  draft?: RecipeDraft
  onSaved?: (id: string) => void
}

const linesToText = (a: string[] | undefined) => (a ?? []).join('\n')
const textToLines = (s: string) => s.split('\n').map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
const num = (s: string) => (s.trim() === '' ? null : Math.max(0, Math.round(Number(s))))

function initial(r: Recipe | null | undefined, draft: RecipeDraft | undefined): RecipeInput {
  const base: RecipeInput = {
    title: '',
    kind: 'food',
    is_idea: false,
    emoji: '🍽️',
    description: '',
    photo_path: null,
    ingredients: [],
    steps: [],
    prep_minutes: null,
    cook_minutes: null,
    servings: 4,
    tags: [],
    notes: '',
    source_url: null,
  }
  if (r) return { ...base, ...Object.fromEntries(Object.keys(base).map((k) => [k, r[k as keyof Recipe]])) } as RecipeInput
  return { ...base, ...draft }
}

export function RecipeSheet({ open, onClose, recipe, draft, onSaved }: Props) {
  const { family } = useCurrentFamily()
  const save = useSaveRecipe()
  const toast = useToast()
  const [d, setD] = useState<RecipeInput>(() => initial(recipe, draft))
  const [ingredientsText, setIngredientsText] = useState('')
  const [stepsText, setStepsText] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const photo = usePhotoUrls([d.photo_path]).data?.[d.photo_path ?? ""]

  useEffect(() => {
    if (!open) return
    const init = initial(recipe, draft)
    setD(init)
    setIngredientsText(linesToText(init.ingredients))
    setStepsText(linesToText(init.steps))
    setErrors({})
  }, [open, recipe, draft])

  const set = <K extends keyof RecipeInput>(k: K, v: RecipeInput[K]) => setD((s) => ({ ...s, [k]: v }))
  const tagOptions = d.kind === 'drink' ? DRINK_TAGS : FOOD_TAGS

  async function onPhoto(file: File | undefined) {
    if (!file) return
    setUploading(true)
    try {
      const path = await uploadRecipePhoto(family.id, file)
      set('photo_path', path)
    } catch (e) {
      toast(friendlyError(e), 'error')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  async function submit() {
    const parsed = recipeSchema.safeParse({
      ...d,
      ingredients: textToLines(ingredientsText),
      steps: textToLines(stepsText),
      source_url: d.source_url ?? '',
    })
    if (!parsed.success) return setErrors(fieldErrors(parsed.error))
    setErrors({})
    try {
      const id = await save.mutateAsync({ id: recipe?.id, data: parsed.data, oldPhoto: recipe?.photo_path })
      toast(recipe ? 'Saved' : d.is_idea ? 'Idea saved' : d.kind === 'drink' ? 'Drink added' : 'Recipe added')
      onSaved?.(id)
      onClose()
    } catch (e) {
      toast(friendlyError(e), 'error')
    }
  }

  const title = recipe ? (d.is_idea ? 'Edit idea' : 'Edit recipe') : d.is_idea ? 'New idea' : d.kind === 'drink' ? 'New drink' : 'New recipe'

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <Button full onClick={submit} loading={save.isPending} disabled={uploading}>
          {recipe ? 'Save changes' : 'Save'}
        </Button>
      }
    >
      <div className="flex flex-col gap-5 pb-2">
        <Field label="Name" placeholder={d.kind === 'drink' ? 'e.g. Mango smoothie' : 'e.g. Spaghetti bolognese'} value={d.title} onChange={(e) => set('title', e.target.value)} error={errors.title} maxLength={100} data-autofocus />

        {!d.is_idea && (
          <div role="radiogroup" aria-label="Food or drink" className="grid grid-cols-2 gap-1 rounded-2xl bg-card-2 p-1">
            {(
              [
                ['food', '🍽️ Food'],
                ['drink', '🥤 Drink'],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={d.kind === k}
                onClick={() => setD((s) => ({ ...s, kind: k, tags: [], emoji: k === 'drink' && s.emoji === '🍽️' ? '🥤' : s.emoji }))}
                className={clsx('min-h-11 rounded-xl font-semibold', d.kind === k ? 'bg-card shadow-sm' : 'text-ink-3')}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* Photo */}
        <div className="flex items-center gap-4">
          <RecipeImage recipe={{ id: recipe?.id ?? d.title, emoji: d.emoji, title: d.title }} url={photo} className="size-24 shrink-0 rounded-2xl" />
          <div className="flex flex-col gap-2">
            <input ref={fileRef} type="file" accept="image/*" className="sr-only" id="recipe-photo" onChange={(e) => onPhoto(e.target.files?.[0])} />
            <Button variant="secondary" size="md" loading={uploading} icon={<Camera className="size-5" />} onClick={() => fileRef.current?.click()}>
              {d.photo_path ? 'Change photo' : 'Add photo'}
            </Button>
            {d.photo_path && (
              <Button variant="ghost" size="md" icon={<Trash2 className="size-4" />} onClick={() => set('photo_path', null)}>
                Remove photo
              </Button>
            )}
          </div>
        </div>

        <div>
          <p className="mb-2 text-sm font-semibold text-ink-2">Emoji (shown when there’s no photo)</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group" aria-label="Recipe emoji">
            {(d.kind === 'drink' ? DRINK_EMOJI : FOOD_EMOJI).map((e) => (
              <button
                key={e}
                type="button"
                aria-label={`Choose ${e}`}
                aria-pressed={d.emoji === e}
                onClick={() => set('emoji', e)}
                className={clsx('flex size-12 shrink-0 items-center justify-center rounded-2xl text-2xl', d.emoji === e ? 'bg-brand-100 ring-3 ring-brand-500 dark:bg-brand-700/40' : 'bg-card-2')}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        {recipe?.is_idea && (
          <div className="-mx-4 rounded-2xl bg-card-2">
            <Toggle
              label="Move to the recipe book"
              description="Tried it and loved it? Make it a proper recipe."
              checked={!d.is_idea}
              onChange={(v) => set('is_idea', !v)}
            />
          </div>
        )}

        {d.is_idea && (
          <Field
            label="Link (optional)"
            type="url"
            inputMode="url"
            placeholder="https://…"
            value={d.source_url ?? ''}
            onChange={(e) => set('source_url', e.target.value || null)}
            error={errors.source_url}
          />
        )}

        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-ink-2">Tags</legend>
          <div className="flex flex-wrap gap-2">
            {tagOptions.map((t) => {
              const on = d.tags.includes(t)
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set('tags', on ? d.tags.filter((x) => x !== t) : [...d.tags, t])}
                  className={clsx('inline-flex min-h-10 items-center gap-1 rounded-full border-2 px-3.5 text-[15px] font-semibold capitalize', on ? 'border-transparent bg-brand-500 text-white' : 'border-line bg-card text-ink-2')}
                >
                  {on && <Check className="size-4" strokeWidth={3} aria-hidden />}
                  {t}
                </button>
              )
            })}
          </div>
        </fieldset>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Prep (min)" type="number" inputMode="numeric" min={0} value={d.prep_minutes ?? ''} onChange={(e) => set('prep_minutes', num(e.target.value))} />
          <Field label="Cook (min)" type="number" inputMode="numeric" min={0} value={d.cook_minutes ?? ''} onChange={(e) => set('cook_minutes', num(e.target.value))} />
          <Field label="Serves" type="number" inputMode="numeric" min={1} value={d.servings ?? ''} onChange={(e) => set('servings', num(e.target.value) || null)} />
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink-2">Ingredients</span>
          <textarea
            value={ingredientsText}
            onChange={(e) => setIngredientsText(e.target.value)}
            rows={6}
            placeholder={'One per line, e.g.\n400g spaghetti\n2 onions\n1 tin chopped tomatoes'}
            className="rounded-xl border border-line bg-card px-4 py-3 placeholder:text-ink-3 focus:border-brand-500 focus:outline-none"
          />
          <span className="text-sm text-ink-3">Writing the amount first (like “400g pasta”) lets the shopping list add things up.</span>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink-2">Steps</span>
          <textarea
            value={stepsText}
            onChange={(e) => setStepsText(e.target.value)}
            rows={6}
            placeholder={'One step per line'}
            className="rounded-xl border border-line bg-card px-4 py-3 placeholder:text-ink-3 focus:border-brand-500 focus:outline-none"
          />
        </label>

        {!d.is_idea && (
          <Field label="Link to original (optional)" type="url" inputMode="url" placeholder="https://…" value={d.source_url ?? ''} onChange={(e) => set('source_url', e.target.value || null)} error={errors.source_url} />
        )}

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink-2">Notes (optional)</span>
          <textarea
            value={d.notes}
            onChange={(e) => set('notes', e.target.value)}
            rows={3}
            maxLength={2000}
            placeholder="Tips, swaps, who likes it…"
            className="rounded-xl border border-line bg-card px-4 py-3 placeholder:text-ink-3 focus:border-brand-500 focus:outline-none"
          />
        </label>
      </div>
    </Sheet>
  )
}
