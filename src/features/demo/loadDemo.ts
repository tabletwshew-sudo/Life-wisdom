import type { Member } from '@/family/FamilyProvider'
import { addDemoRecipes } from '@/features/food/demo'
import { addDemoTasks } from '@/features/tasks/demo'
import { addDays } from '@/lib/dates'
import { aggregateIngredients } from '@/lib/food/ingredients'
import { supabase } from '@/lib/supabase'

/**
 * Fills a family with example chores, events, recipes, a meal plan and a
 * shopping list so it can be tried out straight away. Skips anything that
 * already has data. (No notes or locations, so nothing unencrypted is added.)
 */
export async function loadDemoData(familyId: string, me: Member, members: Member[], today: string): Promise<string[]> {
  const done: string[] = []
  const count = async (table: 'tasks' | 'events' | 'recipes' | 'meal_plans') =>
    (await supabase.from(table).select('id', { count: 'exact', head: true }).eq('family_id', familyId)).count ?? 0

  if (!(await count('tasks'))) {
    const { data: categories } = await supabase.from('categories').select('*').eq('family_id', familyId)
    await addDemoTasks(familyId, members, categories ?? [], today)
    done.push('chores')
  }

  if (!(await count('events'))) {
    const { data: types } = await supabase.from('event_types').select('id, name').eq('family_id', familyId)
    const type = (n: string) => types?.find((t) => t.name === n)?.id ?? null
    const kid = members.find((m) => m.role === 'member') ?? me
    const birth = `${Number(today.slice(0, 4)) - 9}${addDays(today, 6).slice(4)}`
    const events = [
      { data: { title: `${kid.displayName}’s birthday`, type_id: type('Birthday'), start_date: birth, end_date: birth, all_day: true, repeat: 'yearly' }, who: [kid.userId] },
      { data: { title: 'Football practice', type_id: type('Sport'), start_date: addDays(today, 1), all_day: false, start_time: '17:00', end_time: '18:00', repeat: 'weekly', reminder_minutes: 60 }, who: [kid.userId] },
      { data: { title: 'Dentist check-up', type_id: type('Appointment'), start_date: addDays(today, 3), all_day: false, start_time: '15:30', end_time: '16:00', reminder_minutes: 1440 }, who: members.map((m) => m.userId).slice(0, 2) },
      { data: { title: 'Family film night', type_id: type('Party'), start_date: addDays(today, 5), all_day: false, start_time: '19:00', end_time: '21:00' }, who: members.map((m) => m.userId) },
    ]
    for (const e of events) {
      const { error } = await supabase.rpc('create_event', { p_family: familyId, p_data: e.data as never, p_attendees: e.who })
      if (error) throw error
    }
    done.push('events')
  }

  if (!(await count('recipes'))) {
    await addDemoRecipes(familyId, me.userId)
    done.push('recipes')
  }

  if (!(await count('meal_plans'))) {
    const { data: recipes } = await supabase.from('recipes').select('id, title, ingredients, kind').eq('family_id', familyId).eq('kind', 'food').eq('is_idea', false).limit(3)
    const plan = (recipes ?? []).map((r, i) => ({ family_id: familyId, plan_date: addDays(today, i), slot: 'dinner', recipe_id: r.id, created_by: me.userId }))
    if (plan.length) {
      const { error } = await supabase.from('meal_plans').insert(plan)
      if (error) throw error
      const lines = aggregateIngredients((recipes ?? []).map((r) => ({ recipe: r.title, lines: r.ingredients })))
      const { error: e2 } = await supabase.from('shopping_items').insert(
        lines.map((l) => ({ family_id: familyId, name: l.name, quantity: l.quantity, aisle: l.aisle, source: 'meal_plan', for_recipes: l.forRecipes, added_by: me.userId })),
      )
      if (e2) throw e2
      done.push('meal plan', 'shopping list')
    }
  }
  return done
}
