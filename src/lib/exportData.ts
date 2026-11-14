import { supabase } from './supabase'

/**
 * Collects everything the signed-in user can see about one family.
 * RLS guarantees this is only that family's data. Later phases add tables here.
 */
export async function exportFamilyData(familyId: string) {
  const [family, members] = await Promise.all([
    supabase.from('families').select('*').eq('id', familyId).single(),
    supabase.from('family_members').select('role, colour, joined_at, profiles(display_name, emoji)').eq('family_id', familyId),
  ])
  for (const r of [family, members]) if (r.error) throw r.error
  return {
    exported_at: new Date().toISOString(),
    format: 'family-hub-export/1',
    family: family.data,
    members: members.data,
  }
}
