import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '@/auth/AuthProvider'
import type { Database } from '@/lib/database.types'
import { supabase } from '@/lib/supabase'

export type Family = Database['public']['Tables']['families']['Row']
export type Role = Database['public']['Enums']['family_role']

export interface Member {
  userId: string
  role: Role
  colour: string
  joinedAt: string
  displayName: string
  emoji: string
}

export type Permission = 'addTasks' | 'addEvents' | 'addRecipes' | 'addShopping' | 'manageFamily'

interface FamilyState {
  loading: boolean
  /** Couldn't load and nothing cached (e.g. first open while offline). */
  loadError: boolean
  families: Family[]
  family: Family | null
  members: Member[]
  me: Member | null
  isAdmin: boolean
  can: (p: Permission) => boolean
  memberById: (id: string | null | undefined) => Member | undefined
  switchFamily: (id: string) => void
  refresh: () => Promise<void>
}

const FamilyContext = createContext<FamilyState | null>(null)
const STORAGE_KEY = 'fh-family'

function readStoredFamily(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

export function FamilyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const qc = useQueryClient()
  const [selected, setSelected] = useState<string | null>(readStoredFamily)

  const familiesQ = useQuery({
    queryKey: ['families', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('family_members')
        .select('family_id, families(*)')
        .eq('user_id', user!.id)
        .order('joined_at')
      if (error) throw error
      return (data ?? []).map((r) => r.families).filter((f): f is Family => !!f)
    },
  })

  const families = useMemo(() => familiesQ.data ?? [], [familiesQ.data])
  const family = families.find((f) => f.id === selected) ?? families[0] ?? null

  const membersQ = useQuery({
    queryKey: ['members', family?.id],
    enabled: !!family,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('family_members')
        .select('user_id, role, colour, joined_at, profiles(display_name, emoji)')
        .eq('family_id', family!.id)
        .order('joined_at')
      if (error) throw error
      return (data ?? []).map<Member>((r) => ({
        userId: r.user_id,
        role: r.role,
        colour: r.colour,
        joinedAt: r.joined_at,
        displayName: r.profiles?.display_name || 'Someone',
        emoji: r.profiles?.emoji || '🙂',
      }))
    },
  })

  // Live updates: when anyone in the family changes something, refetch.
  useEffect(() => {
    if (!family || !user) return
    const channel = supabase
      .channel(`family-core:${family.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'family_members', filter: `family_id=eq.${family.id}` }, () => {
        qc.invalidateQueries({ queryKey: ['members', family.id] })
        qc.invalidateQueries({ queryKey: ['families', user.id] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'families', filter: `id=eq.${family.id}` }, () => {
        qc.invalidateQueries({ queryKey: ['families', user.id] })
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, () => {
        qc.invalidateQueries({ queryKey: ['members', family.id] })
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          qc.invalidateQueries({ queryKey: ['members', family.id] })
          qc.invalidateQueries({ queryKey: ['families', user.id] })
        }
      })
    return () => {
      supabase.removeChannel(channel)
    }
  }, [family, user, qc])

  const members = useMemo(() => membersQ.data ?? [], [membersQ.data])
  const me = members.find((m) => m.userId === user?.id) ?? null
  const isAdmin = me?.role === 'admin'

  const can = useCallback(
    (p: Permission) => {
      if (!family || !me) return false
      if (isAdmin) return true
      switch (p) {
        case 'addTasks':
          return family.members_can_add_tasks
        case 'addEvents':
          return family.members_can_add_events
        case 'addRecipes':
          return family.members_can_add_recipes
        case 'addShopping':
          return family.members_can_add_shopping
        default:
          return false
      }
    },
    [family, me, isAdmin],
  )

  const memberById = useCallback((id: string | null | undefined) => members.find((m) => m.userId === id), [members])

  const switchFamily = useCallback((id: string) => {
    setSelected(id)
    try {
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      /* private mode: ignore */
    }
  }, [])

  const refresh = useCallback(async () => {
    await qc.invalidateQueries({ queryKey: ['families'] })
    await qc.invalidateQueries({ queryKey: ['members'] })
  }, [qc])

  const value: FamilyState = {
    loading: (familiesQ.isPending && familiesQ.fetchStatus !== 'paused') || (!!family && membersQ.isPending && membersQ.fetchStatus !== 'paused'),
    loadError: (familiesQ.isError || familiesQ.fetchStatus === 'paused') && !familiesQ.data,
    families,
    family,
    members,
    me,
    isAdmin,
    can,
    memberById,
    switchFamily,
    refresh,
  }
  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>
}

export function useFamily(): FamilyState {
  const ctx = useContext(FamilyContext)
  if (!ctx) throw new Error('useFamily must be used inside <FamilyProvider>')
  return ctx
}

/** For pages that only render once a family is loaded (inside RequireFamily). */
export function useCurrentFamily() {
  const state = useFamily()
  if (!state.family || !state.me) throw new Error('No family loaded')
  return { ...state, family: state.family, me: state.me }
}
