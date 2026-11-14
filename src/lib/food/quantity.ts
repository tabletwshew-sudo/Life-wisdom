/**
 * How many of a shopping item. The list stores quantity as text so recipes can
 * say "600 g"; this turns it into a count you can step up and down:
 *   ""          → 1
 *   "3"         → 3
 *   "600 g"     → 1 × 600 g
 *   "2 × 600 g" → 2 × 600 g
 */
export interface Count {
  n: number
  unit: string
}

export function parseCount(quantity: string | null | undefined): Count {
  const q = (quantity ?? '').trim()
  if (!q) return { n: 1, unit: '' }
  let m = /^(\d+)$/.exec(q)
  if (m) return { n: Math.max(1, Number(m[1])), unit: '' }
  m = /^(\d+)\s*[×x]\s+(.+)$/i.exec(q)
  if (m) return { n: Math.max(1, Number(m[1])), unit: m[2].trim() }
  return { n: 1, unit: q }
}

export function formatCount({ n, unit }: Count): string {
  const count = Math.max(1, Math.min(99, Math.round(n)))
  if (unit) return count === 1 ? unit : `${count} × ${unit}`
  return count === 1 ? '' : String(count)
}

/** Change the count by `delta` (never below 1, never above 99). */
export function stepQuantity(quantity: string, delta: number): string {
  const c = parseCount(quantity)
  return formatCount({ ...c, n: c.n + delta })
}

/** Add two quantities of the same item, if they're the same kind (else null). */
export function addQuantities(a: string, b: string): string | null {
  const x = parseCount(a)
  const y = parseCount(b)
  if (x.unit.toLowerCase() !== y.unit.toLowerCase()) return null
  return formatCount({ n: x.n + y.n, unit: x.unit })
}
