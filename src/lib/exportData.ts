import { supabase } from './supabase'

/**
 * Collects everything the signed-in user can see about one family.
 * RLS guarantees this is only that family's data.
 */
export async function exportFamilyData(familyId: string) {
  const [family, members, categories, tasks, assignees, completions] = await Promise.all([
    supabase.from('families').select('*').eq('id', familyId).single(),
    supabase.from('family_members').select('role, colour, joined_at, profiles(display_name, emoji)').eq('family_id', familyId),
    supabase.from('categories').select('*').eq('family_id', familyId),
    supabase.from('tasks').select('*').eq('family_id', familyId),
    supabase.from('task_assignees').select('*').eq('family_id', familyId),
    supabase.from('task_completions').select('*').eq('family_id', familyId),
  ])
  for (const r of [family, members, categories, tasks, assignees, completions]) if (r.error) throw r.error
  return {
    exported_at: new Date().toISOString(),
    format: 'family-hub-export/2',
    family: family.data,
    members: members.data,
    categories: categories.data,
    tasks: tasks.data,
    task_assignees: assignees.data,
    task_completions: completions.data,
  }
}
