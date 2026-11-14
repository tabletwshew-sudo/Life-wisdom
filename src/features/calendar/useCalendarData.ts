import { useCallback, useMemo } from 'react'
import { useCategories } from '@/features/tasks/api'
import { useNewItems, useNewTracker } from '@/features/tasks/useNewTracker'
import { useOccurrences } from '@/features/tasks/useOccurrences'
import { useCurrentFamily } from '@/family/FamilyProvider'
import { eventsOnDay, expandEvents, isEventNewFor, type CalEvent, type EventOccurrence } from '@/lib/calendar/events'
import type { ISODate } from '@/lib/dates'
import type { Occurrence } from '@/lib/tasks/model'
import { SLOTS, useMealPlans, useRecipes, type Slot } from '@/features/food/api'
import { useEventTypes, useEvents } from './api'
import type { ColourMode } from './prefs'

const FALLBACK = '#0072B2'

export interface CalendarMeal {
  key: string
  date: ISODate
  slot: Slot
  title: string
  emoji: string
  recipeId: string | null
}

export function useCalendarData(from: ISODate, to: ISODate, today: ISODate, showTasks: boolean, colourMode: ColourMode, showMeals = true) {
  const { memberById } = useCurrentFamily()
  const eventsQ = useEvents()
  const types = useEventTypes().data ?? []
  const categories = useCategories().data ?? []
  const { occurrences: taskOccs, tasks } = useOccurrences(from, to, today)
  const mealRows = useMealPlans().data
  const recipeRows = useRecipes().data
  const meals = useMemo<CalendarMeal[]>(() => {
    if (!showMeals) return []
    const byId = new Map((recipeRows ?? []).map((r) => [r.id, r]))
    const order = { breakfast: 0, lunch: 1, dinner: 2 }
    return (mealRows ?? [])
      .filter((m) => m.plan_date >= from && m.plan_date <= to)
      .map((m) => {
        const r = m.recipe_id ? byId.get(m.recipe_id) : undefined
        return { key: m.id, date: m.plan_date, slot: m.slot as Slot, title: r?.title ?? m.custom_title ?? '', emoji: r?.emoji ?? SLOTS.find((s) => s.slot === m.slot)!.emoji, recipeId: r?.id ?? null }
      })
      .sort((a, b) => order[a.slot] - order[b.slot])
  }, [showMeals, mealRows, recipeRows, from, to])

  const eventOccs = useMemo(() => expandEvents(eventsQ.data ?? [], from, to), [eventsQ.data, from, to])
  const tasksShown = useMemo(() => (showTasks ? taskOccs : []), [showTasks, taskOccs])

  const typeById = useMemo(() => new Map(types.map((t) => [t.id, t])), [types])
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories])

  const visibleEvents = useMemo(() => [...new Map(eventOccs.map((o) => [o.event.id, o.event])).values()], [eventOccs])
  const isEventNew = useNewItems<CalEvent>('event', visibleEvents, isEventNewFor)
  const isTaskNew = useNewTracker(
    tasks,
    useMemo(() => [...new Map(tasksShown.map((o) => [o.task.id, o.task])).values()], [tasksShown]),
  )

  /** Colours for an event: each attendee's colour (by person) or the type colour (by category). */
  const eventColours = useCallback(
    (e: CalEvent): string[] => {
      const categoryColour = e.colour ?? (e.typeId ? typeById.get(e.typeId)?.colour : undefined) ?? FALLBACK
      if (colourMode === 'category') return [categoryColour]
      const people = e.attendees.map((a) => memberById(a.userId)?.colour).filter((c): c is string => !!c)
      return people.length ? people : [categoryColour]
    },
    [colourMode, typeById, memberById],
  )

  const taskColour = useCallback(
    (o: Occurrence): string => {
      const categoryColour = o.task.colour ?? (o.task.categoryId ? catById.get(o.task.categoryId)?.colour : undefined) ?? '#7B61FF'
      if (colourMode === 'category') return categoryColour
      const who = o.forUser ?? o.task.assignees[0]?.userId
      return memberById(who)?.colour ?? categoryColour
    },
    [colourMode, catById, memberById],
  )

  const eventsOn = useCallback((day: ISODate): EventOccurrence[] => eventsOnDay(eventOccs, day), [eventOccs])
  const mealsOn = useCallback((day: ISODate) => meals.filter((m) => m.date === day), [meals])
  const tasksOn = useCallback((day: ISODate): Occurrence[] => tasksShown.filter((o) => o.date === day), [tasksShown])

  /** 'missed' → the whole day gets crossed out. */
  const dayStatus = useCallback(
    (day: ISODate): 'done' | 'missed' | 'todo' | null => {
      const list = tasksOn(day)
      if (!list.length) return null
      if (list.some((o) => o.status === 'missed')) return 'missed'
      if (list.every((o) => o.status === 'done')) return 'done'
      return 'todo'
    },
    [tasksOn],
  )

  return {
    loading: eventsQ.isPending,
    eventOccs,
    eventsOn,
    tasksOn,
    mealsOn,
    dayStatus,
    eventColours,
    taskColour,
    typeById,
    catById,
    isEventNew,
    isTaskNew,
  }
}

export type CalendarData = ReturnType<typeof useCalendarData>
