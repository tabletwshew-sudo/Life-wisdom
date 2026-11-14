import clsx from 'clsx'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, ListChecks, Minus, Plus, Search, Star, Trash2 } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useMemo, useState, type FormEvent } from 'react'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Sheet } from '@/components/ui/Sheet'
import { Spinner } from '@/components/ui/Spinner'
import { useToast } from '@/components/ui/Toast'
import { useCurrentFamily } from '@/family/FamilyProvider'
import { friendlyError } from '@/lib/errors'
import { sectionFor, sectionLabel, sectionOfItem, STORE_NAME, STORE_SECTIONS, type Direction } from '@/lib/food/storeLayout'
import { cleanText } from '@/lib/validation'
import { addQuantities, parseCount, stepQuantity } from '@/lib/food/quantity'
import { useAddShopping, useDeleteShopping, useMoveShopping, useSetQuantity, useShopping, useTickShopping, type ShoppingItem } from '../api'

/** "2 x milk" / "milk x2" / "3 apples" → name + quantity */
export function splitQuantity(input: string): { name: string; quantity: string } {
  const t = cleanText(input, 120)
  let m = /^(\d+(?:[.,]\d+)?\s*(?:x|kg|g|l|ml|pack|packs|tins?|bottles?|loaf|loaves)?)\s+(.+)$/i.exec(t)
  if (m) return { quantity: m[1].replace(/\s*x$/i, '').trim(), name: m[2] }
  m = /^(.+?)\s+x\s*(\d+)$/i.exec(t)
  if (m) return { name: m[1], quantity: m[2] }
  return { name: t, quantity: '' }
}

/** − 2 + for how many of an item. */
function Stepper({ item, small }: { item: ShoppingItem; small?: boolean }) {
  const setQty = useSetQuantity()
  const toast = useToast()
  const c = parseCount(item.quantity)
  const change = (d: number) =>
    setQty.mutate({ id: item.id, quantity: stepQuantity(item.quantity, d) }, { onError: (e) => toast(friendlyError(e), 'error') })
  const btn = clsx('flex shrink-0 items-center justify-center rounded-full bg-card-2 disabled:opacity-40', small ? 'size-8' : 'size-9')
  return (
    <span className="flex shrink-0 items-center gap-1" role="group" aria-label={`How many ${item.name}`}>
      <button type="button" className={btn} onClick={() => change(-1)} disabled={c.n <= 1} aria-label={`One less ${item.name}`}>
        <Minus className="size-4" aria-hidden />
      </button>
      <span className="min-w-6 text-center font-bold tabular-nums" aria-live="polite">
        {c.n}
      </span>
      <button type="button" className={btn} onClick={() => change(1)} disabled={c.n >= 99} aria-label={`One more ${item.name}`}>
        <Plus className="size-4" aria-hidden />
      </button>
    </span>
  )
}

const ARROWS: Record<Direction, typeof ArrowUp> = { left: ArrowLeft, right: ArrowRight, up: ArrowUp, down: ArrowDown }

function SectionHeader({ id, count }: { id: string; count: number }) {
  const s = STORE_SECTIONS.find((x) => x.id === id)
  const Arrow = s?.dir ? ARROWS[s.dir] : null
  return (
    <h3 className="mb-2 flex items-center gap-2 px-1 text-sm font-bold tracking-wide text-ink-3 uppercase">
      {Arrow && (
        <span className="flex size-6 items-center justify-center rounded-md bg-sky-600 text-white" aria-label={`Turn ${s!.dir}`}>
          <Arrow className="size-4" strokeWidth={3} aria-hidden />
        </span>
      )}
      <span className="flex-1">{sectionLabel(id)}</span>
      <span className="font-semibold normal-case">{count}</span>
    </h3>
  )
}

export function ShoppingTab() {
  const { can, memberById } = useCurrentFamily()
  const q = useShopping()
  const add = useAddShopping()
  const tick = useTickShopping()
  const del = useDeleteShopping()
  const move = useMoveShopping()
  const toast = useToast()
  const [text, setText] = useState('')
  const [moving, setMoving] = useState<ShoppingItem | null>(null)
  const [listOpen, setListOpen] = useState(false)
  const items = q.data ?? []
  const open = items.filter((i) => !i.checked)
  const done = items.filter((i) => i.checked)

  // Group the open items by the shop's aisles, in walking order.
  const grouped = useMemo(() => {
    const map = new Map<string, ShoppingItem[]>()
    for (const i of open) {
      const s = sectionOfItem(i)
      map.set(s, [...(map.get(s) ?? []), i])
    }
    return STORE_SECTIONS.filter((s) => map.has(s.id)).map((s) => [s.id, map.get(s.id)!.sort((a, b) => a.name.localeCompare(b.name))] as const)
  }, [open])

  async function onAdd(e: FormEvent) {
    e.preventDefault()
    const parsed = splitQuantity(text)
    if (!parsed.name) return
    const before = open.find((x) => x.name.toLowerCase() === parsed.name.toLowerCase())
    setText('')
    try {
      const res = await add.mutateAsync({ lines: [{ ...parsed, aisle: sectionFor(parsed.name), forRecipes: [] }], source: 'manual' })
      if (res.increased && before) {
        const total = parseCount(addQuantities(before.quantity, parsed.quantity) ?? '').n
        toast(`${before.name}: now ${total}`)
      }
    } catch (err) {
      toast(friendlyError(err), 'error')
      setText(text)
    }
  }

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
          <button className="min-w-0 flex-1 py-2 text-left" onClick={() => !i.checked && setMoving(i)} aria-label={i.checked ? i.name : `${i.name} — move to another aisle`}>
            <span className={clsx('block font-semibold', i.checked && 'text-ink-3 line-through')}>
              {i.name}{' '}
              {i.checked
                ? i.quantity && <span className="font-normal text-ink-3">· {i.quantity}</span>
                : parseCount(i.quantity).unit && <span className="font-normal text-ink-3">· {parseCount(i.quantity).unit}</span>}
            </span>
            {i.for_recipes.length > 0 && <span className="block truncate text-xs text-ink-3">For {i.for_recipes.join(', ')}</span>}
          </button>
          {!i.checked && <Stepper item={i} />}
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
        <div className="sticky top-[max(0.5rem,env(safe-area-inset-top))] z-20 mb-4 flex flex-col gap-2">
          <form onSubmit={onAdd} className="flex gap-2">
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
          <Button variant="secondary" icon={<ListChecks className="size-5" />} onClick={() => setListOpen(true)}>
            {STORE_NAME} list
          </Button>
        </div>
      )}

      {q.isPending ? (
        <Spinner />
      ) : !items.length ? (
        <Card>
          <EmptyState emoji="🛒" title="The list is empty">
            Tick what you need on the {STORE_NAME} list, type items above, or fill it from the meal plan.
          </EmptyState>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="px-1 font-semibold text-ink-2" aria-live="polite">
            {open.length} to get{done.length ? ` · ${done.length} in the trolley` : ''} · in {STORE_NAME} order
          </p>
          {grouped.map(([id, list]) => (
            <section key={id}>
              <SectionHeader id={id} count={list.length} />
              <Card className="overflow-hidden">
                <ul className="divide-y divide-line">
                  <AnimatePresence initial={false}>{list.map(row)}</AnimatePresence>
                </ul>
              </Card>
            </section>
          ))}
          {done.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between px-1">
                <h3 className="text-sm font-bold tracking-wide text-ink-3 uppercase">In the trolley</h3>
                {can('addShopping') && (
                  <button onClick={() => del.mutate(done.map((i) => i.id))} className="min-h-9 text-sm font-semibold text-red-600 dark:text-red-400">
                    Clear ticked ({done.length})
                  </button>
                )}
              </div>
              <Card className="overflow-hidden opacity-80">
                <ul className="divide-y divide-line">
                  <AnimatePresence initial={false}>{done.map(row)}</AnimatePresence>
                </ul>
              </Card>
            </section>
          )}
        </div>
      )}

      {/* Move an item to another aisle */}
      <Sheet open={!!moving} onClose={() => setMoving(null)} title={moving ? `Where is “${moving.name}”?` : ''}>
        {moving && (
          <ul className="flex flex-col gap-1 pb-2">
            {STORE_SECTIONS.map((s) => {
              const current = sectionOfItem(moving) === s.id
              return (
                <li key={s.id}>
                  <button
                    onClick={() => {
                      move.mutate({ id: moving.id, aisle: s.id }, { onError: (e) => toast(friendlyError(e), 'error') })
                      setMoving(null)
                    }}
                    aria-pressed={current}
                    className={clsx('flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left', current ? 'bg-brand-100 font-bold dark:bg-brand-700/40' : 'hover:bg-card-2')}
                  >
                    <span className="flex-1">{sectionLabel(s.id)}</span>
                    {current && <Check className="size-5" aria-hidden />}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </Sheet>

      <StoreListSheet open={listOpen} onClose={() => setListOpen(false)} items={items} />
    </>
  )
}

/** The whole printed list as a checklist: tick what you need and it goes on the shopping list. */
function StoreListSheet({ open, onClose, items }: { open: boolean; onClose: () => void; items: ShoppingItem[] }) {
  const add = useAddShopping()
  const del = useDeleteShopping()
  const toast = useToast()
  const [query, setQuery] = useState('')
  const [regularsOnly, setRegularsOnly] = useState(false)
  // Ticks show straight away; the list catches up a moment later.
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const onList = new Map(items.filter((i) => !i.checked).map((i) => [i.name.toLowerCase(), i]))
  const qy = query.trim().toLowerCase()

  async function toggle(name: string, section: string) {
    const key = name.toLowerCase()
    const existing = onList.get(key)
    setPending((p) => ({ ...p, [key]: !existing }))
    try {
      if (existing) await del.mutateAsync([existing.id])
      else await add.mutateAsync({ lines: [{ name, quantity: '', aisle: section, forRecipes: [] }], source: 'manual' })
    } catch (e) {
      toast(friendlyError(e), 'error')
    } finally {
      setPending((p) => {
        const { [key]: _done, ...rest } = p
        void _done
        return rest
      })
    }
  }

  const sections = STORE_SECTIONS.map((s) => ({
    ...s,
    items: s.items.filter((it) => (!regularsOnly || it.regular) && (!qy || it.name.toLowerCase().includes(qy) || it.keywords?.some((k) => k.includes(qy)))),
  })).filter((s) => s.items.length)

  return (
    <Sheet open={open} onClose={onClose} title={`${STORE_NAME} list`} footer={<Button full onClick={onClose}>Done ({onList.size} on the list)</Button>}>
      <div className="sticky top-0 z-10 -mx-5 mb-3 flex flex-col gap-2 bg-card px-5 pb-2">
        <div className="relative">
          <Search className="pointer-events-none absolute top-3.5 left-3 size-5 text-ink-3" aria-hidden />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search the list" aria-label="Search the list" className="min-h-12 w-full rounded-xl border border-line bg-card pr-4 pl-10" />
        </div>
        <button
          aria-pressed={regularsOnly}
          onClick={() => setRegularsOnly(!regularsOnly)}
          className={clsx('inline-flex min-h-10 items-center gap-1 self-start rounded-full px-3 text-sm font-semibold', regularsOnly ? 'bg-amber-400 text-black' : 'bg-card-2 text-ink-2')}
        >
          <Star className={clsx('size-4', regularsOnly && 'fill-current')} aria-hidden /> Regulars only
        </button>
      </div>
      <div className="flex flex-col gap-4 pb-2">
        {sections.map((s) => (
          <section key={s.id}>
            <SectionHeader id={s.id} count={s.items.length} />
            <ul className="flex flex-col">
              {s.items.map((it) => {
                const on = pending[it.name.toLowerCase()] ?? onList.has(it.name.toLowerCase())
                return (
                  <li key={it.name}>
                    <label className="flex min-h-12 cursor-pointer items-center gap-3 rounded-xl px-2 hover:bg-card-2">
                      <input type="checkbox" className="size-6 shrink-0 accent-[var(--color-done)]" checked={on} onChange={() => toggle(it.name, s.id)} />
                      <span className={clsx('flex-1', on && 'font-semibold')}>{it.name}</span>
                      {it.regular && <Star className="size-4 fill-amber-400 text-amber-500" aria-label="Regular" />}
                    </label>
                    {on && onList.get(it.name.toLowerCase()) && (
                      <div className="-mt-1 mb-1 flex justify-end pr-2">
                        <Stepper item={onList.get(it.name.toLowerCase())!} small />
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}
        {!sections.length && <p className="py-6 text-center text-ink-3">Nothing matches “{query}”. Close this and type it in the box instead.</p>}
      </div>
    </Sheet>
  )
}
