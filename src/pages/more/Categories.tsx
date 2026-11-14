import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useState } from 'react'
import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ColourPicker } from '@/components/ui/ColourPicker'
import { EmojiPicker } from '@/components/ui/EmojiPicker'
import { Field } from '@/components/ui/Field'
import { Sheet } from '@/components/ui/Sheet'
import { useToast } from '@/components/ui/Toast'
import { eventKeys, useEventTypes } from '@/features/calendar/api'
import { taskKeys, useCategories } from '@/features/tasks/api'
import type { Permission } from '@/family/FamilyProvider'
import { useCurrentFamily } from '@/family/FamilyProvider'
import { tint } from '@/lib/colours'
import { friendlyError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { cleanText } from '@/lib/validation'

const CATEGORY_EMOJI = ['🧹', '🍽️', '🐾', '🎒', '🛏️', '🌳', '🚗', '🛒', '💪', '🎵', '⚽', '🏠', '🧺', '📚', '💊', '🎨', '🧒', '❤️']

interface Item {
  id: string
  name: string
  emoji: string
  colour: string
  created_by: string | null
}

interface Config {
  table: 'categories' | 'event_types'
  title: string
  subtitle: string
  permission: Permission
  queryKey: (fid: string) => readonly unknown[]
  emojis: string[]
}

const EVENT_EMOJI = ['🎂', '🎉', '🍽️', '✈️', '🩺', '🏫', '⚽', '📌', '💍', '🎭', '🎬', '🏊', '🎹', '🐶', '💇', '🦷', '🚗', '⛪']

export default function Categories() {
  const items = useCategories().data ?? []
  return (
    <ItemManager
      items={items}
      config={{ table: 'categories', title: 'Categories', subtitle: 'Colours for chores', permission: 'addTasks', queryKey: taskKeys.categories, emojis: CATEGORY_EMOJI }}
    />
  )
}

export function EventTypesManager() {
  const items = useEventTypes().data ?? []
  return (
    <ItemManager
      items={items}
      config={{ table: 'event_types', title: 'Event types', subtitle: 'Birthdays, parties, school… or your own', permission: 'addEvents', queryKey: eventKeys.types, emojis: EVENT_EMOJI }}
    />
  )
}

function ItemManager({ items: categories, config }: { items: Item[]; config: Config }) {
  const { family, me, isAdmin, can } = useCurrentFamily()
  const [editing, setEditing] = useState<Partial<Item> | null>(null)
  const canEdit = (c: Item) => isAdmin || (c.created_by === me.userId && can(config.permission))

  return (
    <>
      <PageHeader
        title={config.title}
        subtitle={config.subtitle}
        action={
          can(config.permission) && (
            <Button size="md" icon={<Plus className="size-5" />} onClick={() => setEditing({ name: '', emoji: '🏠', colour: '#0072B2' })}>
              Add
            </Button>
          )
        }
      />
      <Card className="divide-y divide-line overflow-hidden">
        {categories.map((c) => (
          <button
            key={c.id}
            disabled={!canEdit(c)}
            onClick={() => setEditing(c)}
            className="flex min-h-16 w-full items-center gap-3 px-4 text-left enabled:hover:bg-card-2"
          >
            <span className="flex size-11 items-center justify-center rounded-2xl text-2xl" style={{ background: tint(c.colour, 0.2) }} aria-hidden>
              {c.emoji}
            </span>
            <span className="flex-1 font-semibold">{c.name}</span>
            <span className="size-5 rounded-full" style={{ background: c.colour }} aria-hidden />
          </button>
        ))}
      </Card>
      <CategorySheet familyId={family.id} value={editing} config={config} onClose={() => setEditing(null)} />
    </>
  )
}

function CategorySheet({ familyId, value, config, onClose }: { familyId: string; value: Partial<Item> | null; config: Config; onClose: () => void }) {
  const [draft, setDraft] = useState<Partial<Item>>({})
  const [lastId, setLastId] = useState<string | undefined | null>(null)
  if (value && (value.id ?? 'new') !== lastId) {
    setDraft(value)
    setLastId(value.id ?? 'new')
  }
  const qc = useQueryClient()
  const toast = useToast()
  const done = () => {
    qc.invalidateQueries({ queryKey: config.queryKey(familyId) })
    setLastId(null)
    onClose()
  }
  const save = useMutation({
    mutationFn: async () => {
      const name = cleanText(draft.name ?? '', 30)
      if (!name) throw new Error('Please give it a name')
      const row = { name, emoji: draft.emoji ?? '🏷️', colour: draft.colour ?? '#0072B2' }
      const { error } = draft.id
        ? await supabase.from(config.table).update(row).eq('id', draft.id)
        : await supabase.from(config.table).insert({ ...row, family_id: familyId, created_by: (await supabase.auth.getUser()).data.user!.id })
      if (error) throw error
    },
    onSuccess: () => {
      toast('Saved')
      done()
    },
    onError: (e) => toast(friendlyError(e), 'error'),
  })
  const remove = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from(config.table).delete().eq('id', draft.id!)
      if (error) throw error
    },
    onSuccess: () => {
      toast('Category deleted')
      done()
    },
    onError: (e) => toast(friendlyError(e), 'error'),
  })

  return (
    <Sheet
      open={!!value}
      onClose={() => {
        setLastId(null)
        onClose()
      }}
      title={draft.id ? 'Edit' : 'Add new'}
      footer={
        <div className="flex gap-2">
          {draft.id && (
            <Button
              variant="secondary"
              className="text-red-600!"
              loading={remove.isPending}
              onClick={() => confirm('Delete this? Items using it keep working, just without it.') && remove.mutate()}
            >
              Delete
            </Button>
          )}
          <Button full onClick={() => save.mutate()} loading={save.isPending}>
            Save
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="Name" value={draft.name ?? ''} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={30} />
        <EmojiPicker value={draft.emoji ?? '🏷️'} onChange={(emoji) => setDraft({ ...draft, emoji })} options={config.emojis} />
        <ColourPicker value={draft.colour ?? '#0072B2'} onChange={(colour) => setDraft({ ...draft, colour })} />
      </div>
    </Sheet>
  )
}
