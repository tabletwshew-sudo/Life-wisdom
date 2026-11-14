import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { useFamily } from '@/family/FamilyProvider'
import type { Database } from '@/lib/database.types'
import { setAppBadge } from '@/lib/push'
import { supabase } from '@/lib/supabase'

export type AppNotification = Database['public']['Tables']['notifications']['Row']
export type NotificationPrefs = Database['public']['Tables']['notification_prefs']['Row']

export const notifKeys = {
  list: (uid: string, fid: string) => ['notifications', uid, fid] as const,
  prefs: (uid: string, fid: string) => ['notification_prefs', uid, fid] as const,
  devices: (uid: string) => ['push_subscriptions', uid] as const,
}

export const DEFAULT_PREFS = {
  daily_summary: true,
  daily_summary_time: '07:30:00',
  assignment_alerts: true,
  task_reminders: true,
  event_reminders: true,
  new_recipe_alerts: false,
}

function useIds() {
  const { user } = useAuth()
  const { family } = useFamily()
  return { uid: user?.id ?? '', fid: family?.id ?? '' }
}

export function useNotifications() {
  const { uid, fid } = useIds()
  return useQuery({
    queryKey: notifKeys.list(uid, fid),
    enabled: !!uid && !!fid,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('family_id', fid)
        .order('created_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return data
    },
  })
}

export function useUnreadCount(): number {
  return (useNotifications().data ?? []).filter((n) => !n.read_at).length
}

export function useMarkRead() {
  const { uid, fid } = useIds()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[] | 'all') => {
      const now = new Date().toISOString()
      const q = supabase.from('notifications').update({ read_at: now }).is('read_at', null).eq('family_id', fid)
      const { error } = ids === 'all' ? await q : await q.in('id', ids)
      if (error) throw error
    },
    onMutate: (ids) => {
      const now = new Date().toISOString()
      qc.setQueryData<AppNotification[]>(notifKeys.list(uid, fid), (old) =>
        old?.map((n) => (!n.read_at && (ids === 'all' || ids.includes(n.id)) ? { ...n, read_at: now } : n)),
      )
    },
    onSettled: () => qc.invalidateQueries({ queryKey: notifKeys.list(uid, fid) }),
  })
}

export function useClearNotifications() {
  const { uid, fid } = useIds()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from('notifications').delete().eq('family_id', fid).not('read_at', 'is', null)
      if (error) throw error
    },
    onSettled: () => qc.invalidateQueries({ queryKey: notifKeys.list(uid, fid) }),
  })
}

export function usePrefs() {
  const { uid, fid } = useIds()
  return useQuery({
    queryKey: notifKeys.prefs(uid, fid),
    enabled: !!uid && !!fid,
    queryFn: async () => {
      const { data, error } = await supabase.from('notification_prefs').select('*').eq('user_id', uid).eq('family_id', fid).maybeSingle()
      if (error) throw error
      return { ...DEFAULT_PREFS, ...(data ?? {}) }
    },
  })
}

export function useSavePrefs() {
  const { uid, fid } = useIds()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Partial<typeof DEFAULT_PREFS>) => {
      const current = qc.getQueryData<typeof DEFAULT_PREFS>(notifKeys.prefs(uid, fid)) ?? DEFAULT_PREFS
      const { error } = await supabase
        .from('notification_prefs')
        .upsert({ ...DEFAULT_PREFS, ...current, ...patch, user_id: uid, family_id: fid, updated_at: new Date().toISOString() })
      if (error) throw error
    },
    onMutate: (patch) => qc.setQueryData(notifKeys.prefs(uid, fid), (old: typeof DEFAULT_PREFS | undefined) => ({ ...(old ?? DEFAULT_PREFS), ...patch })),
    onSettled: () => qc.invalidateQueries({ queryKey: notifKeys.prefs(uid, fid) }),
  })
}

export function useDevices() {
  const { uid } = useIds()
  return useQuery({
    queryKey: notifKeys.devices(uid),
    enabled: !!uid,
    queryFn: async () => {
      const { data, error } = await supabase.from('push_subscriptions').select('id, endpoint, device_label, created_at, last_used_at').order('created_at')
      if (error) throw error
      return data
    },
  })
}

/**
 * Live notifications: refetch when a new one arrives, show it as a pop-up if
 * the app is open, and keep the app-icon badge in sync with the unread count.
 */
export function useNotificationRealtime(onNew: (n: AppNotification) => void) {
  const { uid, fid } = useIds()
  const qc = useQueryClient()
  const cb = useRef(onNew)
  cb.current = onNew
  const unread = useUnreadCount()

  useEffect(() => setAppBadge(unread), [unread])

  useEffect(() => {
    if (!uid || !fid) return
    const ch = supabase
      .channel(`notifications:${uid}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, (payload) => {
        const n = payload.new as AppNotification
        if (n.family_id === fid) cb.current(n)
        qc.invalidateQueries({ queryKey: notifKeys.list(uid, fid) })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` }, () =>
        qc.invalidateQueries({ queryKey: notifKeys.list(uid, fid) }),
      )
      .subscribe((status) => status === 'SUBSCRIBED' && qc.invalidateQueries({ queryKey: notifKeys.list(uid, fid) }))
    return () => {
      supabase.removeChannel(ch)
    }
  }, [uid, fid, qc])
}
