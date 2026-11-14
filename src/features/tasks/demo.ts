import type { Member } from '@/family/FamilyProvider'
import { supabase } from '@/lib/supabase'
import type { Category } from './api'

/** Adds a handful of example chores so a new family can try things out. */
export async function addDemoTasks(familyId: string, members: Member[], categories: Category[], today: string) {
  const cat = (name: string) => categories.find((c) => c.name === name)?.id ?? null
  const kids = members.filter((m) => m.role === 'member')
  const people = kids.length ? kids : members
  const everyone = people.map((m) => m.userId)
  const first = people[0]?.userId
  const second = people[1]?.userId ?? first
  const demo: { data: Record<string, unknown>; assignees: string[] }[] = [
    { data: { title: 'Make the bed', emoji: '🛏️', category_id: cat('Bedroom'), repeat: 'daily', completion_mode: 'each' }, assignees: everyone },
    { data: { title: 'Put dishes away', emoji: '🍽️', category_id: cat('Kitchen'), repeat: 'daily', due_time: '18:30' }, assignees: [first] },
    { data: { title: 'Pick up clothes', emoji: '👕', category_id: cat('Bedroom'), repeat: 'weekdays', repeat_days: [1, 2, 3, 4, 5] }, assignees: everyone },
    { data: { title: 'Put the dishwasher on', emoji: '🫧', category_id: cat('Kitchen'), repeat: 'daily', due_time: '20:00', completion_mode: 'any' }, assignees: everyone },
    { data: { title: 'Feed the pet', emoji: '🐶', category_id: cat('Pets'), repeat: 'daily', due_time: '07:30', points: 2 }, assignees: [second] },
    { data: { title: 'Take out the bins', emoji: '🗑️', category_id: cat('Outdoors'), repeat: 'weekly', points: 3 }, assignees: [] },
  ]
  for (const t of demo) {
    const { error } = await supabase.rpc('create_task', {
      p_family: familyId,
      p_data: { start_date: today, ...t.data } as never,
      p_assignees: t.assignees.filter(Boolean) as string[],
    })
    if (error) throw error
  }
}
