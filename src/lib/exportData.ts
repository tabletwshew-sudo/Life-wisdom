import { supabase } from './supabase'

/**
 * Collects everything the signed-in user can see about one family.
 * RLS guarantees this is only that family's data.
 */
export async function exportFamilyData(familyId: string) {
  const [family, members, categories, tasks, assignees, completions, eventTypes, events, attendees, exceptions, recipes, favourites, meals, shopping, prefs] = await Promise.all([
    supabase.from('families').select('*').eq('id', familyId).single(),
    supabase.from('family_members').select('role, colour, joined_at, profiles(display_name, emoji)').eq('family_id', familyId),
    supabase.from('categories').select('*').eq('family_id', familyId),
    supabase.from('tasks').select('*').eq('family_id', familyId),
    supabase.from('task_assignees').select('*').eq('family_id', familyId),
    supabase.from('task_completions').select('*').eq('family_id', familyId),
    supabase.from('event_types').select('*').eq('family_id', familyId),
    supabase.from('events').select('*').eq('family_id', familyId),
    supabase.from('event_attendees').select('*').eq('family_id', familyId),
    supabase.from('event_exceptions').select('*').eq('family_id', familyId),
    supabase.from('recipes').select('*').eq('family_id', familyId),
    supabase.from('recipe_favourites').select('*').eq('family_id', familyId),
    supabase.from('meal_plans').select('*').eq('family_id', familyId),
    supabase.from('shopping_items').select('*').eq('family_id', familyId),
    supabase.from('notification_prefs').select('*').eq('family_id', familyId),
  ])
  for (const r of [family, members, categories, tasks, assignees, completions, eventTypes, events, attendees, exceptions, recipes, favourites, meals, shopping, prefs]) if (r.error) throw r.error
  return {
    exported_at: new Date().toISOString(),
    format: 'family-hub-export/5',
    family: family.data,
    members: members.data,
    categories: categories.data,
    tasks: tasks.data,
    task_assignees: assignees.data,
    task_completions: completions.data,
    event_types: eventTypes.data,
    events: events.data,
    event_attendees: attendees.data,
    event_exceptions: exceptions.data,
    recipes: recipes.data,
    recipe_favourites: favourites.data,
    meal_plans: meals.data,
    shopping_items: shopping.data,
    my_notification_settings: prefs.data,
    note: 'Recipe photos are not included in this file; they stay in your Supabase storage.',
  }
}

/** Removes all of a family's recipe photos from storage (used before deleting the family). */
export async function deleteFamilyPhotos(familyId: string) {
  for (;;) {
    const { data, error } = await supabase.storage.from('recipe-photos').list(familyId, { limit: 100 })
    if (error || !data?.length) return
    const { error: e2 } = await supabase.storage.from('recipe-photos').remove(data.map((f) => `${familyId}/${f.name}`))
    if (e2) return
  }
}
