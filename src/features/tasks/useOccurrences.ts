import { useMemo } from 'react'
import type { ISODate } from '@/lib/dates'
import { buildOccurrences } from '@/lib/tasks/model'
import { useCompletions, useTasks } from './api'

export function useOccurrences(from: ISODate, to: ISODate, today: ISODate) {
  const tasksQ = useTasks()
  const compQ = useCompletions(from, to)
  const occurrences = useMemo(
    () => buildOccurrences(tasksQ.data ?? [], compQ.data ?? [], from, to, today),
    [tasksQ.data, compQ.data, from, to, today],
  )
  return {
    occurrences,
    tasks: tasksQ.data ?? [],
    completions: compQ.data ?? [],
    loading: tasksQ.isPending || compQ.isPending,
  }
}
