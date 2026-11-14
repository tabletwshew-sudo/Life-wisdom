import { CalendarDays, CheckSquare, Home, Menu, UtensilsCrossed, type LucideIcon } from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Today', icon: Home },
  { to: '/tasks', label: 'Tasks', icon: CheckSquare },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/food', label: 'Food', icon: UtensilsCrossed },
  { to: '/more', label: 'More', icon: Menu },
]
