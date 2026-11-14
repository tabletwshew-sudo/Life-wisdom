import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useFamily } from '@/family/FamilyProvider'
import type { CalEvent, EventRepeat } from '@/lib/calendar/events'
import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

type EventRow = Database['public']['Tables']['events']['Row'] & {
  event_attendees: { user_id: string; added_by: string | null; added_at: string }[]
  event_exceptions: { skip_date: string }[]
}
export type EventType = Database['public']['Tables']['event_types']['Row']

export const eventKeys = {
  events: (fid: string) => ['events', fid] as const,
  types: (fid: string) => ['event_types', fid] as const,
}

export function mapEvent(r: EventRow): CalEvent {
  return {
    id: r.id,
    familyId: r.family_id,
    title: r.title,
    typeId: r.type_id,
    startDate: r.start_date,
    endDate: r.end_date,
    allDay: r.all_day,
    startTime: r.start_time,
    endTime: r.end_time,
    location: r.location,
    notes: r.notes,
    colour: r.colour,
    repeat: r.repeat as EventRepeat,
    repeatUntil: r.repeat_until,
    reminderMinutes: r.reminder_minutes,
    createdBy: r.created_by,
    createdAt: r.created_at,
    attendees: (r.event_attendees ?? []).map((a) => ({ userId: a.user_id, addedBy: a.added_by, addedAt: a.added_at })),
    skipped: (r.event_exceptions ?? []).map((x) => x.skip_date),
  }
}

/** All the family's events (a family has hundreds at most, so we load them all). */
export function useEvents() {
  const { family } = useFamily()
  const fid = family?.id ?? ''
  return useQuery({
    queryKey: eventKeys.events(fid),
    enabled: !!fid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('events')
        .select('*, event_attendees(user_id, added_by, added_at), event_exceptions(skip_date)')
        .eq('family_id', fid)
        .order('start_date')
      if (error) throw error
      return (data as EventRow[]).map(mapEvent)
    },
  })
}

export function useEventTypes() {
  const { family } = useFamily()
  const fid = family?.id ?? ''
  return useQuery({
    queryKey: eventKeys.types(fid),
    enabled: !!fid,
    queryFn: async () => {
      const { data, error } = await supabase.from('event_types').select('*').eq('family_id', fid).order('sort').order('name')
      if (error) throw error
      return data
    },
  })
}

export function useEventRealtime() {
  const { family } = useFamily()
  const qc = useQueryClient()
  useEffect(() => {
    if (!family) return
    const fid = family.id
    const filter = `family_id=eq.${fid}`
    const refresh = () => qc.invalidateQueries({ queryKey: eventKeys.events(fid) })
    const ch = supabase.channel(`family-events:${fid}`)
    for (const table of ['events', 'event_attendees', 'event_exceptions'] as const)
      ch.on('postgres_changes', { event: '*', schema: 'public', table, filter }, refresh)
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'event_types', filter }, () =>
      qc.invalidateQueries({ queryKey: eventKeys.types(fid) }),
    )
    ch.subscribe((status) => status === 'SUBSCRIBED' && refresh())
    return () => {
      supabase.removeChannel(ch)
    }
  }, [family, qc])
}

export interface EventInput {
  title: string
  type_id: string | null
  start_date: string
  end_date: string
  all_day: boolean
  start_time: string | null
  end_time: string | null
  location: string
  notes: string
  colour: string | null
  repeat: EventRepeat
  repeat_until: string | null
  reminder_minutes: number | null
}

function useInvalidateEvents() {
  const { family } = useFamily()
  const qc = useQueryClient()
  return () => family && qc.invalidateQueries({ queryKey: eventKeys.events(family.id) })
}

export function useSaveEvent() {
  const { family } = useFamily()
  const invalidate = useInvalidateEvents()
  return useMutation({
    mutationFn: async ({ id, data, attendees }: { id?: string; data: EventInput; attendees: string[] }) => {
      if (!family) throw new Error('No family')
      const res = id
        ? await supabase.rpc('update_event', { p_event: id, p_data: data as never, p_attendees: attendees })
        : await supabase.rpc('create_event', { p_family: family.id, p_data: data as never, p_attendees: attendees })
      if (res.error) throw res.error
      return res.data as string
    },
    onSettled: invalidate,
  })
}

/** Delete a whole event, or (for repeating events) just one date. */
export function useDeleteEvent() {
  const { family } = useFamily()
  const invalidate = useInvalidateEvents()
  return useMutation({
    mutationFn: async ({ id, onlyDate }: { id: string; onlyDate?: string }) => {
      const { error } = onlyDate
        ? await supabase.from('event_exceptions').insert({ event_id: id, skip_date: onlyDate, family_id: family!.id })
        : await supabase.from('events').delete().eq('id', id)
      if (error) throw error
    },
    onSettled: invalidate,
  })
}
