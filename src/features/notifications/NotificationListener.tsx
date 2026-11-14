import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/components/ui/Toast'
import { useEvents } from '@/features/calendar/api'
import { useCompletions, useTasks } from '@/features/tasks/api'
import { useCurrentFamily } from '@/family/FamilyProvider'
import { useToday } from '@/hooks/useToday'
import { addDays, todayIn } from '@/lib/dates'
import { dueReminders, wallMinutes } from '@/lib/reminders'
import { useNotificationRealtime } from './api'

const SHOWN_KEY = 'fh-reminders-shown'
const LOOKBACK_MIN = 15

function loadShown(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(SHOWN_KEY) ?? '[]') as string[])
  } catch {
    return new Set()
  }
}
function saveShown(s: Set<string>) {
  try {
    localStorage.setItem(SHOWN_KEY, JSON.stringify([...s].slice(-300)))
  } catch {
    /* ignore */
  }
}

/** Current wall-clock minute in the family's time zone. */
function nowMinutes(tz: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
  return wallMinutes(todayIn(tz), parts)
}

/**
 * Runs while the app is open:
 *  - pops up anything new from the server (assignments, reminders, …), and
 *  - shows chore/event reminders itself, so reminders work in a normal browser
 *    tab and even before push has been set up. A reminder is never shown twice.
 */
export function NotificationListener() {
  const { me, family } = useCurrentFamily()
  const toast = useToast()
  const navigate = useNavigate()
  const today = useToday()
  const shown = useRef(loadShown())
  const tasks = useTasks().data
  const completions = useCompletions(today, addDays(today, 7)).data
  const events = useEvents().data

  const show = (key: string | null, text: string, link?: string) => {
    if (key && shown.current.has(key)) return
    if (key) {
      shown.current.add(key)
      saveShown(shown.current)
    }
    toast(text, 'success', link ? { label: 'Open', onClick: () => navigate(link) } : undefined)
  }

  // From the server (realtime).
  useNotificationRealtime((n) => show(n.dedupe_key, n.body ? `${n.title} — ${n.body}` : n.title, n.link))

  // Local reminders, checked every 20 seconds while the app is open.
  useEffect(() => {
    if (!tasks || !events || !completions) return
    const tick = () => {
      if (document.visibilityState !== 'visible') return
      // Always look back a few minutes; the "shown" list stops repeats. (A
      // minute-by-minute window would miss reminders added mid-minute.)
      const now = nowMinutes(family.timezone)
      for (const r of dueReminders({ userId: me.userId, tasks, completions, events, today, fromMin: now - LOOKBACK_MIN, toMin: now })) {
        show(r.key, `${r.title} — ${r.body}`, r.link)
      }
    }
    tick()
    const id = setInterval(tick, 20_000)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tasks, events, completions, today, family.timezone, me.userId])

  return null
}
