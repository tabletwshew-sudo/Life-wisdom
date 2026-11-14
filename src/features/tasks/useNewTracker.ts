import { useCallback, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import { isNewFor, type Task } from '@/lib/tasks/model'
import { useMarkSeen, useSeen } from './api'

type ItemType = 'task' | 'event' | 'recipe'

/**
 * Works out which items are NEW for the signed-in person, and records that
 * they've seen the ones actually shown on screen. The badge stays visible for
 * the rest of this visit and is gone next time.
 */
export function useNewItems<T extends { id: string }>(
  type: ItemType,
  visible: T[],
  isNewFn: (item: T, userId: string, seenAt: string | undefined) => boolean,
) {
  const { user } = useAuth()
  const seenQ = useSeen(type)
  const markSeen = useMarkSeen(type)
  // Freeze the "seen" snapshot when the page opens so badges don't vanish instantly.
  const [snapshot, setSnapshot] = useState<Record<string, string> | null>(null)
  // Wait for fresh data from the server (or offline) rather than a stale cached copy.
  const ready = !!seenQ.data && (seenQ.isFetchedAfterMount || seenQ.fetchStatus !== 'fetching')
  useEffect(() => {
    if (ready && !snapshot) setSnapshot(seenQ.data!)
  }, [ready, seenQ.data, snapshot])

  const isNew = useCallback(
    (item: T) => (snapshot && user ? isNewFn(item, user.id, snapshot[item.id]) : false),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [snapshot, user],
  )

  const marked = useRef(new Set<string>())
  // A stable string so re-renders with the same items on screen don't restart the timer.
  const pendingKey = [...new Set(visible.filter((t) => isNew(t) && !marked.current.has(t.id)).map((t) => t.id))].sort().join(',')
  useEffect(() => {
    if (!snapshot || !pendingKey) return
    const ids = pendingKey.split(',')
    const timer = setTimeout(() => {
      ids.forEach((id) => marked.current.add(id))
      markSeen.mutate(ids)
    }, 1500)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, pendingKey])

  return isNew
}

/** `visible` = the tasks actually shown on screen; only those count as viewed. */
export function useNewTracker(_all: Task[], visible: Task[]) {
  return useNewItems('task', visible, (t, uid, seen) => isNewFor(t, uid, seen))
}
