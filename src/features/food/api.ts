import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { useFamily } from '@/family/FamilyProvider'
import type { Database } from '@/lib/database.types'
import type { ISODate } from '@/lib/dates'
import { aisleFor, type ShoppingLine } from '@/lib/food/ingredients'
import { addQuantities } from '@/lib/food/quantity'
import { compressImage } from '@/lib/image'
import { onFamilyChanges } from '@/lib/realtime'
import { supabase } from '@/lib/supabase'

export type Recipe = Database['public']['Tables']['recipes']['Row']
export type MealPlan = Database['public']['Tables']['meal_plans']['Row']
export type ShoppingItem = Database['public']['Tables']['shopping_items']['Row']
export type Slot = 'breakfast' | 'lunch' | 'dinner'
export type RecipeInput = Pick<
  Recipe,
  'title' | 'kind' | 'is_idea' | 'emoji' | 'description' | 'photo_path' | 'ingredients' | 'steps' | 'prep_minutes' | 'cook_minutes' | 'servings' | 'tags' | 'notes' | 'source_url'
>

export const SLOTS: { slot: Slot; label: string; emoji: string }[] = [
  { slot: 'breakfast', label: 'Breakfast', emoji: '🥣' },
  { slot: 'lunch', label: 'Lunch', emoji: '🥪' },
  { slot: 'dinner', label: 'Dinner', emoji: '🍽️' },
]

export const foodKeys = {
  recipes: (fid: string) => ['recipes', fid] as const,
  favourites: (fid: string) => ['recipe_favourites', fid] as const,
  meals: (fid: string) => ['meal_plans', fid] as const,
  shopping: (fid: string) => ['shopping', fid] as const,
}

const useFid = () => useFamily().family?.id ?? ''

export function useRecipes() {
  const fid = useFid()
  return useQuery({
    queryKey: foodKeys.recipes(fid),
    enabled: !!fid,
    queryFn: async () => {
      const { data, error } = await supabase.from('recipes').select('*').eq('family_id', fid).order('title')
      if (error) throw error
      return data
    },
  })
}

/** Everyone's favourites: recipe id → list of user ids. */
export function useFavourites() {
  const fid = useFid()
  return useQuery({
    queryKey: foodKeys.favourites(fid),
    enabled: !!fid,
    queryFn: async () => {
      const { data, error } = await supabase.from('recipe_favourites').select('recipe_id, user_id').eq('family_id', fid)
      if (error) throw error
      const out: Record<string, string[]> = {}
      for (const r of data) (out[r.recipe_id] ??= []).push(r.user_id)
      return out
    },
  })
}

/** All planned meals (a family plans a few hundred a year, so load them all). */
export function useMealPlans() {
  const fid = useFid()
  return useQuery({
    queryKey: foodKeys.meals(fid),
    enabled: !!fid,
    queryFn: async () => {
      const { data, error } = await supabase.from('meal_plans').select('*').eq('family_id', fid).order('plan_date')
      if (error) throw error
      return data
    },
  })
}

export function useShopping() {
  const fid = useFid()
  return useQuery({
    queryKey: foodKeys.shopping(fid),
    enabled: !!fid,
    queryFn: async () => {
      const { data, error } = await supabase.from('shopping_items').select('*').eq('family_id', fid).order('created_at')
      if (error) throw error
      return data
    },
  })
}

/** Short-lived private links for recipe photos (the bucket is not public). */
export function usePhotoUrls(paths: (string | null | undefined)[]) {
  const list = [...new Set(paths.filter((p): p is string => !!p))].sort()
  return useQuery({
    queryKey: ['photo-urls', list],
    enabled: list.length > 0,
    staleTime: 50 * 60 * 1000,
    gcTime: 55 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.storage.from('recipe-photos').createSignedUrls(list, 3600)
      if (error) throw error
      return Object.fromEntries(data.filter((d) => d.signedUrl && d.path).map((d) => [d.path!, d.signedUrl])) as Record<string, string>
    },
  })
}

export function useFoodRealtime() {
  const { family } = useFamily()
  const qc = useQueryClient()
  useEffect(() => {
    if (!family) return
    const fid = family.id
    const filter = `family_id=eq.${fid}`
    const ch = supabase.channel(`family-food:${fid}`)
    const pairs = [
      ['recipes', foodKeys.recipes(fid)],
      ['recipe_favourites', foodKeys.favourites(fid)],
      ['meal_plans', foodKeys.meals(fid)],
      ['shopping_items', foodKeys.shopping(fid)],
    ] as const
    for (const [table, key] of pairs) onFamilyChanges(ch, table, filter, () => qc.invalidateQueries({ queryKey: key }))
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') for (const [, key] of pairs) qc.invalidateQueries({ queryKey: key })
    })
    return () => {
      supabase.removeChannel(ch)
    }
  }, [family, qc])
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export async function uploadRecipePhoto(familyId: string, file: File): Promise<string> {
  const blob = await compressImage(file)
  const path = `${familyId}/${crypto.randomUUID()}.jpg`
  const { error } = await supabase.storage.from('recipe-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false })
  if (error) throw error
  return path
}

export function useSaveRecipe() {
  const fid = useFid()
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data, oldPhoto }: { id?: string; data: RecipeInput; oldPhoto?: string | null }) => {
      const res = id
        ? await supabase.from('recipes').update(data).eq('id', id).select('id').single()
        : await supabase.from('recipes').insert({ ...data, family_id: fid, created_by: user!.id }).select('id').single()
      if (res.error) throw res.error
      if (oldPhoto && oldPhoto !== data.photo_path) await supabase.storage.from('recipe-photos').remove([oldPhoto])
      return res.data.id
    },
    onSettled: () => qc.invalidateQueries({ queryKey: foodKeys.recipes(fid) }),
  })
}

export function useDeleteRecipe() {
  const fid = useFid()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (r: Recipe) => {
      const { error } = await supabase.from('recipes').delete().eq('id', r.id)
      if (error) throw error
      if (r.photo_path) await supabase.storage.from('recipe-photos').remove([r.photo_path])
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: foodKeys.recipes(fid) })
      qc.invalidateQueries({ queryKey: foodKeys.meals(fid) })
    },
  })
}

export function useToggleFavourite() {
  const fid = useFid()
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ recipeId, on }: { recipeId: string; on: boolean }) => {
      const { error } = on
        ? await supabase.from('recipe_favourites').insert({ recipe_id: recipeId, user_id: user!.id, family_id: fid })
        : await supabase.from('recipe_favourites').delete().eq('recipe_id', recipeId).eq('user_id', user!.id)
      if (error) throw error
    },
    onMutate: ({ recipeId, on }) => {
      qc.setQueryData<Record<string, string[]>>(foodKeys.favourites(fid), (old = {}) => {
        const list = (old[recipeId] ?? []).filter((u) => u !== user!.id)
        return { ...old, [recipeId]: on ? [...list, user!.id] : list }
      })
    },
    onSettled: () => qc.invalidateQueries({ queryKey: foodKeys.favourites(fid) }),
  })
}

export function useSetMeal() {
  const fid = useFid()
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { date: ISODate; slot: Slot; recipeId?: string | null; customTitle?: string | null } | { date: ISODate; slot: Slot; clear: true }) => {
      if ('clear' in v) {
        const { error } = await supabase.from('meal_plans').delete().eq('family_id', fid).eq('plan_date', v.date).eq('slot', v.slot)
        if (error) throw error
        return
      }
      const { error } = await supabase.from('meal_plans').upsert(
        { family_id: fid, plan_date: v.date, slot: v.slot, recipe_id: v.recipeId ?? null, custom_title: v.customTitle ?? null, created_by: user!.id },
        { onConflict: 'family_id,plan_date,slot' },
      )
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: foodKeys.meals(fid) }),
  })
}

/** Add items to the shopping list, merging with anything already on it (unticked). */
export function useAddShopping() {
  const fid = useFid()
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ lines, source }: { lines: (ShoppingLine | { name: string; quantity?: string })[]; source: 'manual' | 'meal_plan' | 'recipe' }) => {
      const current = qc.getQueryData<ShoppingItem[]>(foodKeys.shopping(fid)) ?? []
      const open = new Map(current.filter((i) => !i.checked).map((i) => [i.name.toLowerCase(), i]))
      let added = 0
      let increased = 0
      const inserts = []
      for (const l of lines) {
        const existing = open.get(l.name.toLowerCase())
        const forRecipes = 'forRecipes' in l ? l.forRecipes : []
        if (existing) {
          if (source === 'manual') {
            // Added again by hand: increase how many ("milk" twice → 2 milk).
            const sum = addQuantities(existing.quantity, l.quantity ?? '')
            if (sum !== null) {
              const { error } = await supabase.from('shopping_items').update({ quantity: sum }).eq('id', existing.id)
              if (error) throw error
              increased++
            }
            continue
          }
          // From a recipe/meal plan: just note which recipe needs it too.
          const merged = [...new Set([...existing.for_recipes, ...forRecipes])]
          if (merged.length !== existing.for_recipes.length) await supabase.from('shopping_items').update({ for_recipes: merged }).eq('id', existing.id)
          continue
        }
        inserts.push({
          family_id: fid,
          name: l.name,
          quantity: l.quantity ?? '',
          aisle: 'aisle' in l ? l.aisle : aisleFor(l.name),
          source,
          for_recipes: forRecipes,
          added_by: user!.id,
        })
        added++
      }
      if (inserts.length) {
        const { error } = await supabase.from('shopping_items').insert(inserts)
        if (error) throw error
      }
      return { added, increased, alreadyThere: lines.length - added - increased }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: foodKeys.shopping(fid) }),
  })
}

export function useTickShopping() {
  const fid = useFid()
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, checked }: { id: string; checked: boolean }) => {
      const { error } = await supabase.from('shopping_items').update({ checked }).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, checked }) => {
      await qc.cancelQueries({ queryKey: foodKeys.shopping(fid) })
      const prev = qc.getQueryData<ShoppingItem[]>(foodKeys.shopping(fid))
      qc.setQueryData<ShoppingItem[]>(foodKeys.shopping(fid), (old) =>
        old?.map((i) => (i.id === id ? { ...i, checked, checked_by: checked ? (user?.id ?? null) : null } : i)),
      )
      return { prev }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(foodKeys.shopping(fid), ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: foodKeys.shopping(fid) }),
  })
}

export function useDeleteShopping() {
  const fid = useFid()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('shopping_items').delete().in('id', ids)
      if (error) throw error
    },
    onMutate: (ids) => {
      qc.setQueryData<ShoppingItem[]>(foodKeys.shopping(fid), (old) => old?.filter((i) => !ids.includes(i.id)))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: foodKeys.shopping(fid) }),
  })
}

/** Move a shopping item to another aisle of the shop. */
export function useMoveShopping() {
  const fid = useFid()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, aisle }: { id: string; aisle: string }) => {
      const { error } = await supabase.from('shopping_items').update({ aisle }).eq('id', id)
      if (error) throw error
    },
    onMutate: ({ id, aisle }) => {
      qc.setQueryData<ShoppingItem[]>(foodKeys.shopping(fid), (old) => old?.map((i) => (i.id === id ? { ...i, aisle } : i)))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: foodKeys.shopping(fid) }),
  })
}

/** Change how many of an item (instant for everyone). */
export function useSetQuantity() {
  const fid = useFid()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, quantity }: { id: string; quantity: string }) => {
      const { error } = await supabase.from('shopping_items').update({ quantity }).eq('id', id)
      if (error) throw error
    },
    onMutate: ({ id, quantity }) => {
      qc.setQueryData<ShoppingItem[]>(foodKeys.shopping(fid), (old) => old?.map((i) => (i.id === id ? { ...i, quantity } : i)))
    },
    onSettled: () => qc.invalidateQueries({ queryKey: foodKeys.shopping(fid) }),
  })
}
