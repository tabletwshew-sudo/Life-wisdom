import { useCallback, useState } from 'react'

export type ColourMode = 'person' | 'category'

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key)
    return v === null ? fallback : (JSON.parse(v) as T)
  } catch {
    return fallback
  }
}

/** Per-device calendar preferences (colour by person/category, show tasks). */
export function useCalendarPrefs() {
  const [colourMode, setColourModeState] = useState<ColourMode>(() => read('fh-cal-colour', 'person'))
  const [showTasks, setShowTasksState] = useState<boolean>(() => read('fh-cal-tasks', true))
  const [showMeals, setShowMealsState] = useState<boolean>(() => read('fh-cal-meals', true))
  const save = (k: string, v: unknown) => {
    try {
      localStorage.setItem(k, JSON.stringify(v))
    } catch {
      /* ignore */
    }
  }
  const setColourMode = useCallback((m: ColourMode) => (setColourModeState(m), save('fh-cal-colour', m)), [])
  const setShowTasks = useCallback((v: boolean) => (setShowTasksState(v), save('fh-cal-tasks', v)), [])
  const setShowMeals = useCallback((v: boolean) => (setShowMealsState(v), save('fh-cal-meals', v)), [])
  return { colourMode, setColourMode, showTasks, setShowTasks, showMeals, setShowMeals }
}
