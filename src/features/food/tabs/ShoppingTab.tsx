import clsx from 'clsx'
import { Check, Plus, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card, SectionTitle } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { useCurrentFamily } from '@/family/FamilyProvider'
import { friendlyError } from '@/lib/errors'
import { AISLES } from '@/lib/food/ingredients'
import { cleanText } from '@/lib/validation'
import { useAddShopping, useDeleteShopping, useShopping, useTickShopping, type ShoppingItem } from '../api'

/** "2 x milk" / "milk x2" / "3 apples" → name + quantity */
function splitQuantity(input: string): { name: string; quantity: string } {
  const t = cleanText(input, 120)
  let m = /^(\d+(?:[.,]\d+)?\s*(?:x|kg|g|l|ml|pack|packs|tins?|bottles?|loaf|loaves)?)\s+(.+)$/i.exec(t)
  if (m) return { quantity: m[1].replace(/\s*x$/i, '').trim(), name: m[2] }
  m = /^(.+?)\s+x\s*(\d+)$/i.exec(t)
  if (m) return { name: m[1], quantity: m[2] }
  return { name: t, quantity: '' }
}

export function ShoppingTab() {
  const { can, memberById } = useCurrentFamily()
  const q = useShopping()
  const add = useAddShopping()
  const tick = useTickShopping()
  const del = useDeleteShopping()
  const toast = useToast()
  const [text, setText] = useState('')
  const items = q.data ?? []
  const open = items.filter((i) => !i.checked)
  const done = items.filter((i) => i.checked)

  async function onAdd(e: FormEvent) {
    e.preventDefault()
    const parsed = splitQuantity(text)
    if (!parsed.name) return
    setText('')
    try {
      const res = await add.mutateAsync({ lines: [parsed], source: 'manual' })
      if (!res.added) toast(`${parsed.name} is already on the list`)
    } catch (err) {
      toast(friendlyError(err), 'error')
      setText(text)
    }
  }

  const grouped = AISLES.map((aisle) => [aisle, open.filter((i) => (i.aisle || 'Other') === aisle)] as const).filter(([, list]) => list.length)
  // Items with an aisle we don't know about (e.g. typed by an older version)
  const known = new Set<string>(AISLES)
  const odd = open.filter((i) => !known.has(i.aisle))
  if (odd.length) grouped.push(['Other', odd])

  const row = (i: ShoppingItem) => {
    const by = memberById(i.checked_by)
    return (
      <motion.li key={i.id} layout initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, height: 0 }}>
        <div className="flex min-h-14 items-center gap-3 px-3">
          <button
            onClick={() => tick.mutate({ id: i.id, checked: !i.checked }, { onError: (e) => toast(friendlyError(e), 'error') })}
            aria-pressed={i.checked}
            aria-label={i.checked ? `Untick ${i.name}` : `Tick ${i.name}`}
            className={clsx('flex size-9 shrink-0 items-center justify-center rounded-full border-[2.5px] transition', i.checked ? 'border-done bg-done text-white' : 'border-ink-3')}
          >
            {i.checked && <Check className="size-5" strokeWidth={3.5} aria-hidden />}
          </button>
          <div className="min-w-0 flex-1">
            <p className={clsx('font-semibold', i.checked && 'text-ink-3 line-through')}>
              {i.name} {i.quantity && <span className="font-normal text-ink-3">· {i.quantity}</span>}
            </p>
            {i.for_recipes.length > 0 && <p className="truncate text-xs text-ink-3">For {i.for_recipes.join(', ')}</p>}
          </div>
          {i.checked && by && <Avatar emoji={by.emoji} colour={by.colour} name={`Got by ${by.displayName}`} size="sm" />}
          {can('addShopping') && !i.checked && (
            <button onClick={() => del.mutate([i.id])} aria-label={`Remove ${i.name}`} className="flex size-10 items-center justify-center rounded-full text-ink-3 hover:bg-card-2">
              <Trash2 className="size-4" aria-hidden />
            </button>
          )}
        </div>
      </motion.li>
    )
  }

  return (
    <>
      {can('addShopping') && (
        <form onSubmit={onAdd} className="sticky top-[max(0.5rem,env(safe-area-inset-top))] z-20 mb-4 flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add an item, e.g. 2 milk"
            aria-label="Add an item"
            maxLength={120}
            enterKeyHint="done"
            className="min-h-13 flex-1 rounded-2xl border border-line bg-card px-4 shadow-[var(--shadow-card)] focus:border-brand-500 focus:outline-none"
          />
          <Button type="submit" size="lg" icon={<Plus className="size-5" />} disabled={!text.trim()} aria-label="Add item">
            <span className="hidden sm:inline">Add</span>
          </Button>
        </form>
      )}

      {q.isPending ? (
        <Spinner />
      ) : !items.length ? (
        <Card>
          <EmptyState emoji="🛒" title="The list is empty">
            Add items above, or fill it from the meal plan (Plan tab) or a recipe.
          </EmptyState>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="px-1 font-semibold text-ink-2" aria-live="polite">
            {open.length} to get{done.length ? ` · ${done.length} in the trolley` : ''}
          </p>
          {grouped.map(([aisle, list]) => (
            <section key={aisle}>
              <SectionTitle>{aisle}</SectionTitle>
              <Card className="overflow-hidden">
                <ul className="divide-y divide-line">
                  <AnimatePresence initial={false}>{list.map(row)}</AnimatePresence>
                </ul>
              </Card>
            </section>
          ))}
          {done.length > 0 && (
            <section>
              <SectionTitle
                action={
                  can('addShopping') && (
                    <button onClick={() => del.mutate(done.map((i) => i.id))} className="min-h-9 text-sm font-semibold text-red-600 dark:text-red-400">
                      Clear ticked ({done.length})
                    </button>
                  )
                }
              >
                In the trolley
              </SectionTitle>
              <Card className="overflow-hidden opacity-80">
                <ul className="divide-y divide-line">
                  <AnimatePresence initial={false}>{done.map(row)}</AnimatePresence>
                </ul>
              </Card>
            </section>
          )}
        </div>
      )}
    </>
  )
}
