import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Wand2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field } from '@/components/ui/Field'
import { Toggle } from '@/components/ui/Toggle'
import { useToast } from '@/components/ui/Toast'
import { loadDemoData } from '@/features/demo/loadDemo'
import { useCurrentFamily, type Family } from '@/family/FamilyProvider'
import { useToday } from '@/hooks/useToday'
import { friendlyError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { familyNameSchema } from '@/lib/validation'
import { SettingsGroup } from './SettingsList'

type Editable = Pick<
  Family,
  | 'name'
  | 'timezone'
  | 'week_starts_on'
  | 'members_can_add_tasks'
  | 'members_can_add_events'
  | 'members_can_add_recipes'
  | 'members_can_add_shopping'
  | 'points_enabled'
>

export default function FamilySettings() {
  const { family, isAdmin, refresh, me, members } = useCurrentFamily()
  const qc = useQueryClient()
  const today = useToday()
  const [demoBusy, setDemoBusy] = useState(false)
  const toast = useToast()
  const [name, setName] = useState(family.name)
  const zones = useMemo(() => {
    try {
      return Intl.supportedValuesOf('timeZone')
    } catch {
      return [family.timezone]
    }
  }, [family.timezone])

  const save = useMutation({
    mutationFn: async (patch: Partial<Editable>) => {
      const { error } = await supabase.from('families').update(patch).eq('id', family.id)
      if (error) throw error
    },
    onSuccess: () => {
      refresh()
      toast('Saved')
    },
    onError: (e) => toast(friendlyError(e), 'error'),
  })

  if (!isAdmin) return <Navigate to="/more" replace />

  return (
    <>
      <PageHeader title="Family settings" />
      <Card className="mb-5 flex flex-col gap-3 p-5">
        <Field label="Family name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        <Button
          variant="secondary"
          disabled={name === family.name}
          onClick={() => {
            const parsed = familyNameSchema.safeParse(name)
            if (!parsed.success) return toast(parsed.error.issues[0].message, 'error')
            save.mutate({ name: parsed.data })
          }}
        >
          Save name
        </Button>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink-2">Time zone</span>
          <select
            value={family.timezone}
            onChange={(e) => save.mutate({ timezone: e.target.value })}
            className="min-h-12 rounded-xl border border-line bg-card px-3"
          >
            {zones.map((z) => (
              <option key={z} value={z}>
                {z.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
          <span className="text-sm text-ink-3">Used to decide when a day ends (for missed chores) and for reminders.</span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink-2">Week starts on</span>
          <select
            value={family.week_starts_on}
            onChange={(e) => save.mutate({ week_starts_on: Number(e.target.value) })}
            className="min-h-12 rounded-xl border border-line bg-card px-3"
          >
            <option value={1}>Monday</option>
            <option value={0}>Sunday</option>
            <option value={6}>Saturday</option>
          </select>
        </label>
      </Card>

      <SettingsGroup title="What members (kids) can add">
        <Toggle label="Tasks" description="Create chores and assign them" checked={family.members_can_add_tasks} onChange={(v) => save.mutate({ members_can_add_tasks: v })} />
        <Toggle label="Calendar events" checked={family.members_can_add_events} onChange={(v) => save.mutate({ members_can_add_events: v })} />
        <Toggle label="Recipes & ideas" checked={family.members_can_add_recipes} onChange={(v) => save.mutate({ members_can_add_recipes: v })} />
        <Toggle label="Shopping list items" checked={family.members_can_add_shopping} onChange={(v) => save.mutate({ members_can_add_shopping: v })} />
      </SettingsGroup>

      <SettingsGroup title="Try it out">
        <div className="flex flex-col gap-2 p-4">
          <p className="text-ink-2">Add example chores, events, recipes, a meal plan and a shopping list, so you can see how everything works. Only fills empty sections.</p>
          <Button
            variant="secondary"
            loading={demoBusy}
            icon={<Wand2 className="size-5" />}
            onClick={async () => {
              setDemoBusy(true)
              try {
                const added = await loadDemoData(family.id, me, members, today)
                await qc.invalidateQueries()
                toast(added.length ? `Added example ${added.join(', ')}` : 'You already have data in every section')
              } catch (e) {
                toast(friendlyError(e), 'error')
              } finally {
                setDemoBusy(false)
              }
            }}
          >
            Load demo data
          </Button>
        </div>
      </SettingsGroup>

      <SettingsGroup title="Fun">
        <Toggle label="Points & streaks" description="Earn points for finished chores" checked={family.points_enabled} onChange={(v) => save.mutate({ points_enabled: v })} />
      </SettingsGroup>
    </>
  )
}
