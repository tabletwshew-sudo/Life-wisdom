import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { useFamily } from '@/family/FamilyProvider'
import { addDays, type ISODate } from '@/lib/dates'
import type { Database } from '@/lib/database.types'
import { onFamilyChanges } from '@/lib/realtime'
import { supabase } from '@/lib/supabase'
import type { Completion, Task } from '@/lib/tasks/model'
import type { Repeat } from '@/lib/tasks/recurrence'

type TaskRow = Database['public']['Tables']['tasks']['Row'] & {
  task_assignees: { user_id: string; assigned_by: string | null; assigned_at: string }[]
}
type CompletionRow = Database['public']['Tables']['task_completions']['Row']
export type Category = Database['public']['Tables']['categories']['Row']

export function mapTask(r: TaskRow): Task {
  return {
    id: r.id,
    familyId: r.family_id,
    title: r.title,
    notes: r.notes,
    emoji: r.emoji,
    categoryId: r.category_id,
    colour: r.colour,
    startDate: r.start_date,
    dueTime: r.due_time,
    repeat: r.repeat as Repeat,
    repeatDays: r.repeat_days ?? [],
    repeatUntil: r.repeat_until,
    completionMode: r.completion_mode as 'any' | 'each',
    points: r.points,
    reminderMinutes: r.reminder_minutes,
    archivedAt: r.archived_at,
    createdBy: r.created_by,
    createdAt: r.created_at,
    assignees: (r.task_assignees ?? []).map((a) => ({ userId: a.user_id, assignedBy: a.assigned_by, assignedAt: a.assigned_at })),
  }
}

const mapCompletion = (r: CompletionRow): Completion => ({
  id: r.id,
  taskId: r.task_id,
  occurrenceDate: r.occurrence_date,
  forUser: r.for_user,
  completedBy: r.completed_by,
  completedAt: r.completed_at,
  points: r.points,
})

export const taskKeys = {
  tasks: (fid: string) => ['tasks', fid] as const,
  completions: (fid: string, from?: string, to?: string) => (from ? (['completions', fid, from, to] as const) : (['completions', fid] as const)),
  categories: (fid: string) => ['categories', fid] as const,
  seen: (fid: string, uid: string) => ['seen', fid, uid] as const,
}

/** All current tasks, plus ended/deleted ones that still have recent history. */
export function useTasks() {
  const { family } = useFamily()
  const fid = family?.id ?? ''
  return useQuery({
    queryKey: taskKeys.tasks(fid),
    enabled: !!fid,
    queryFn: async () => {
      const cutoff = addDays(new Date().toISOString().slice(0, 10), -120)
      const { data, error } = await supabase
        .from('tasks')
        .select('*, task_assignees(user_id, assigned_by, assigned_at)')
        .eq('family_id', fid)
        .or(`repeat_until.is.null,repeat_until.gte.${cutoff}`)
        .order('created_at')
      if (error) throw error
      return (data as TaskRow[]).map(mapTask)
    },
  })
}

export function useCompletions(from: ISODate, to: ISODate) {
  const { family } = useFamily()
  const fid = family?.id ?? ''
  return useQuery({
    queryKey: taskKeys.completions(fid, from, to),
    enabled: !!fid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('task_completions')
        .select('*')
        .eq('family_id', fid)
        .gte('occurrence_date', from)
        .lte('occurrence_date', to)
      if (error) throw error
      return data.map(mapCompletion)
    },
  })
}

export function useCategories() {
  const { family } = useFamily()
  const fid = family?.id ?? ''
  return useQuery({
    queryKey: taskKeys.categories(fid),
    enabled: !!fid,
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').eq('family_id', fid).order('sort').order('name')
      if (error) throw error
      return data
    },
  })
}

/** item_id → when this person last viewed it. */
export function useSeen(type: 'task' | 'event' | 'recipe') {
  const { family } = useFamily()
  const { user } = useAuth()
  const fid = family?.id ?? ''
  return useQuery({
    queryKey: [...taskKeys.seen(fid, user?.id ?? ''), type],
    enabled: !!fid && !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('seen_items').select('item_id, seen_at').eq('family_id', fid).eq('item_type', type)
      if (error) throw error
      // Plain object (not a Map) so it survives the offline cache (JSON).
      return Object.fromEntries(data.map((r) => [r.item_id, r.seen_at])) as Record<string, string>
    },
  })
}

export function useMarkSeen(type: 'task' | 'event' | 'recipe') {
  const { family } = useFamily()
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (!family || !ids.length) return
      const { error } = await supabase.rpc('mark_seen', { p_family: family.id, p_type: type, p_ids: ids })
      if (error) throw error
    },
    // Update the cached list (used next visit). The page on screen keeps its
    // badges until the person leaves, so they notice what was new.
    onSuccess: (_d, ids) => {
      if (!family || !user) return
      const now = new Date().toISOString()
      qc.setQueryData<Record<string, string>>([...taskKeys.seen(family.id, user.id), type], (old) => ({
        ...(old ?? {}),
        ...Object.fromEntries(ids.map((id) => [id, now])),
      }))
    },
  })
}

/** Live updates: refetch when anyone in the family changes tasks or ticks. */
export function useTaskRealtime() {
  const { family } = useFamily()
  const qc = useQueryClient()
  useEffect(() => {
    if (!family) return
    const fid = family.id
    const filter = `family_id=eq.${fid}`
    const invalidate = (key: readonly unknown[]) => () => qc.invalidateQueries({ queryKey: key })
    const ch = supabase.channel(`family-tasks:${fid}`)
    for (const table of ['tasks', 'task_assignees'] as const) onFamilyChanges(ch, table, filter, invalidate(taskKeys.tasks(fid)))
    onFamilyChanges(ch, 'task_completions', filter, invalidate(taskKeys.completions(fid)))
    onFamilyChanges(ch, 'categories', filter, invalidate(taskKeys.categories(fid)))
    // (Re)connected: catch up on anything we missed while offline or asleep.
    ch.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        qc.invalidateQueries({ queryKey: taskKeys.tasks(fid) })
        qc.invalidateQueries({ queryKey: taskKeys.completions(fid) })
      }
    })
    return () => {
      supabase.removeChannel(ch)
    }
  }, [family, qc])
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export interface TaskInput {
  title: string
  notes: string
  emoji: string
  category_id: string | null
  colour: string | null
  start_date: string
  due_time: string | null
  repeat: Repeat
  repeat_days: number[]
  repeat_until: string | null
  completion_mode: 'any' | 'each'
  points: number
  reminder_minutes: number | null
}

export function useSaveTask() {
  const { family } = useFamily()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, data, assignees }: { id?: string; data: TaskInput; assignees: string[] }) => {
      if (!family) throw new Error('No family')
      if (id) {
        const { data: newId, error } = await supabase.rpc('update_task', { p_task: id, p_data: data as never, p_assignees: assignees })
        if (error) throw error
        return newId as string
      }
      const { data: newId, error } = await supabase.rpc('create_task', { p_family: family.id, p_data: data as never, p_assignees: assignees })
      if (error) throw error
      return newId as string
    },
    onSettled: () => {
      if (!family) return
      qc.invalidateQueries({ queryKey: taskKeys.tasks(family.id) })
      qc.invalidateQueries({ queryKey: taskKeys.completions(family.id) })
    },
  })
}

export function useDeleteTask() {
  const { family } = useFamily()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, keepHistory }: { id: string; keepHistory: boolean }) => {
      const { error } = await supabase.rpc('delete_task', { p_task: id, p_keep_history: keepHistory })
      if (error) throw error
    },
    onSettled: () => {
      if (!family) return
      qc.invalidateQueries({ queryKey: taskKeys.tasks(family.id) })
      qc.invalidateQueries({ queryKey: taskKeys.completions(family.id) })
    },
  })
}

/** Tick / untick with an instant (optimistic) update. */
export function useToggleCompletion() {
  const { family } = useFamily()
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (v: { taskId: string; date: string; forUser: string | null; existing: Completion | null }) => {
      if (v.existing) {
        const { error } = await supabase.from('task_completions').delete().eq('id', v.existing.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('task_completions')
          .insert({ task_id: v.taskId, occurrence_date: v.date, for_user: v.forUser, family_id: family!.id })
        if (error) throw error
      }
    },
    onMutate: async (v) => {
      if (!family) return
      const key = taskKeys.completions(family.id)
      await qc.cancelQueries({ queryKey: key })
      const snapshot = qc.getQueriesData<Completion[]>({ queryKey: key })
      qc.setQueriesData<Completion[]>({ queryKey: key }, (old) => {
        if (!old) return old
        if (v.existing) return old.filter((c) => c.id !== v.existing!.id)
        return [
          ...old,
          {
            id: `optimistic-${v.taskId}-${v.date}-${v.forUser}`,
            taskId: v.taskId,
            occurrenceDate: v.date,
            forUser: v.forUser,
            completedBy: user?.id ?? null,
            completedAt: new Date().toISOString(),
            points: 0,
          },
        ]
      })
      return { snapshot }
    },
    onError: (_e, _v, ctx) => ctx?.snapshot.forEach(([k, d]) => qc.setQueryData(k, d)),
    onSettled: () => family && qc.invalidateQueries({ queryKey: taskKeys.completions(family.id) }),
  })
}
