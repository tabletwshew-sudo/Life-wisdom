import type { RealtimeChannel } from '@supabase/supabase-js'

/**
 * Listen for changes to a family's rows.
 *
 * Supabase Realtime can filter INSERT/UPDATE by family_id, but DELETE events
 * can't be filtered (the deleted row's data is gone; only its id is sent). So
 * we also listen to unfiltered DELETEs and simply refetch. A delete event
 * carries nothing but a random id, and the refetch still goes through RLS.
 */
export function onFamilyChanges(ch: RealtimeChannel, table: string, filter: string, onChange: () => void): RealtimeChannel {
  return ch
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table, filter }, onChange)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table, filter }, onChange)
    .on('postgres_changes', { event: 'DELETE', schema: 'public', table }, onChange)
}
