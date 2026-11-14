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
import { taskKeys, useCategories, type Category } from '@/features/tasks/api'
import { useCurrentFamily } from '@/family/FamilyProvider'
import { tint } from '@/lib/colours'
import { friendlyError } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { cleanText } from '@/lib/validation'

const CATEGORY_EMOJI = ['🧹', '🍽️', '🐾', '🎒', '🛏️', '🌳', '🚗', '🛒', '💪', '🎵', '⚽', '🏠', '🧺', '📚', '💊', '🎨', '🧒', '❤️']

export default function Categories() {
  const { family, me, isAdmin, can } = useCurrentFamily()
  const categories = useCategories().data ?? []
  const [editing, setEditing] = useState<Partial<Category> | null>(null)
  const canEdit = (c: Category) => isAdmin || (c.created_by === me.userId && can('addTasks'))

  return (
    <>
      <PageHeader
        title="Categories"
        subtitle="Colours for tasks (and events)"
        action={
          can('addTasks') && (
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
      <CategorySheet familyId={family.id} value={editing} onClose={() => setEditing(null)} />
    </>
  )
}

function CategorySheet({ familyId, value, onClose }: { familyId: string; value: Partial<Category> | null; onClose: () => void }) {
  const [draft, setDraft] = useState<Partial<Category>>({})
  const [lastId, setLastId] = useState<string | undefined | null>(null)
  if (value && (value.id ?? 'new') !== lastId) {
    setDraft(value)
    setLastId(value.id ?? 'new')
  }
  const qc = useQueryClient()
  const toast = useToast()
  const done = () => {
    qc.invalidateQueries({ queryKey: taskKeys.categories(familyId) })
    setLastId(null)
    onClose()
  }
  const save = useMutation({
    mutationFn: async () => {
      const name = cleanText(draft.name ?? '', 30)
      if (!name) throw new Error('Give the category a name')
      const row = { name, emoji: draft.emoji ?? '🏷️', colour: draft.colour ?? '#0072B2' }
      const { error } = draft.id
        ? await supabase.from('categories').update(row).eq('id', draft.id)
        : await supabase.from('categories').insert({ ...row, family_id: familyId, created_by: (await supabase.auth.getUser()).data.user!.id })
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
      const { error } = await supabase.from('categories').delete().eq('id', draft.id!)
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
      title={draft.id ? 'Edit category' : 'New category'}
      footer={
        <div className="flex gap-2">
          {draft.id && (
            <Button
              variant="secondary"
              className="text-red-600!"
              loading={remove.isPending}
              onClick={() => confirm('Delete this category? Tasks keep working, just without a category.') && remove.mutate()}
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
        <EmojiPicker value={draft.emoji ?? '🏷️'} onChange={(emoji) => setDraft({ ...draft, emoji })} options={CATEGORY_EMOJI} />
        <ColourPicker value={draft.colour ?? '#0072B2'} onChange={(colour) => setDraft({ ...draft, colour })} />
      </div>
    </Sheet>
  )
}
