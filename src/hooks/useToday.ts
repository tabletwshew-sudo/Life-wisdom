import { useEffect, useState } from 'react'
import { todayIn } from '@/lib/dates'
import { useFamily } from '@/family/FamilyProvider'

/** Today's date in the family's time zone. Updates itself at midnight. */
export function useToday(): string {
  const { family } = useFamily()
  const tz = family?.timezone ?? 'Europe/London'
  const [today, setToday] = useState(() => todayIn(tz))
  useEffect(() => {
    setToday(todayIn(tz))
    const id = setInterval(() => setToday(todayIn(tz)), 60_000)
    return () => clearInterval(id)
  }, [tz])
  return today
}

/** Current wall-clock time 'HH:MM' in the family time zone (updates each minute). */
export function useNowTime(): string {
  const { family } = useFamily()
  const tz = family?.timezone ?? 'Europe/London'
  const calc = () =>
    new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date())
  const [t, setT] = useState(calc)
  useEffect(() => {
    const id = setInterval(() => setT(calc()), 60_000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tz])
  return t
}
