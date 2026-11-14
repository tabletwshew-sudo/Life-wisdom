import { SUGGESTIONS } from '@/lib/food/suggestions'
import { supabase } from '@/lib/supabase'

const PICKS = ['Spaghetti bolognese', 'Chicken fajitas', 'Veggie chilli', 'Jacket potatoes', 'Pancakes', 'Apple crumble', 'Strawberry banana smoothie', 'Virgin mojito', 'Hot chocolate']

/** Adds a few example recipes and drinks so a new family can try things out. */
export async function addDemoRecipes(familyId: string, userId: string) {
  const rows = SUGGESTIONS.filter((s) => PICKS.includes(s.title)).map((s) => ({
    family_id: familyId,
    created_by: userId,
    title: s.title,
    kind: s.kind,
    emoji: s.emoji,
    tags: s.tags.filter((t) => t !== 'drink'),
    ingredients: s.ingredients,
    steps: ['Get everything ready.', 'Follow your usual method (edit this recipe to add your own steps).', 'Enjoy together!'],
    servings: 4,
    prep_minutes: 10,
    cook_minutes: s.kind === 'drink' ? 0 : 30,
  }))
  const { error } = await supabase.from('recipes').insert(rows)
  if (error) throw error
}
