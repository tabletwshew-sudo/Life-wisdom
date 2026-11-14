/**
 * Turns free-text ingredient lines ("200g pasta", "2 onions", "½ tsp salt")
 * into structured pieces, merges duplicates for the shopping list and sorts
 * items into supermarket aisles.
 */

export interface Ingredient {
  qty: number | null
  unit: string
  item: string
}

const UNIT_ALIASES: Record<string, string> = {
  g: 'g', gram: 'g', grams: 'g', gr: 'g',
  kg: 'kg', kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg',
  ml: 'ml', millilitre: 'ml', millilitres: 'ml', milliliter: 'ml', milliliters: 'ml',
  l: 'l', litre: 'l', litres: 'l', liter: 'l', liters: 'l',
  tsp: 'tsp', teaspoon: 'tsp', teaspoons: 'tsp',
  tbsp: 'tbsp', tablespoon: 'tbsp', tablespoons: 'tbsp',
  cup: 'cup', cups: 'cup',
  oz: 'oz', lb: 'lb', lbs: 'lb',
  pinch: 'pinch', pinches: 'pinch',
  clove: 'clove', cloves: 'clove',
  slice: 'slice', slices: 'slice',
  tin: 'tin', tins: 'tin', can: 'tin', cans: 'tin',
  pack: 'pack', packs: 'pack', packet: 'pack', packets: 'pack',
  handful: 'handful', handfuls: 'handful',
  bunch: 'bunch', bunches: 'bunch',
}

const FRACTIONS: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1 / 3, '⅔': 2 / 3, '⅛': 0.125 }

function parseNumber(s: string): number | null {
  s = s.trim()
  if (!s) return null
  // "1½" or "1 1/2"
  const mixed = /^(\d+)\s*([½¼¾⅓⅔⅛])$/.exec(s)
  if (mixed) return Number(mixed[1]) + FRACTIONS[mixed[2]]
  if (FRACTIONS[s] !== undefined) return FRACTIONS[s]
  const mixedSlash = /^(\d+)\s+(\d+)\/(\d+)$/.exec(s)
  if (mixedSlash) return Number(mixedSlash[1]) + Number(mixedSlash[2]) / Number(mixedSlash[3])
  const frac = /^(\d+)\/(\d+)$/.exec(s)
  if (frac) return Number(frac[1]) / Number(frac[2])
  const n = Number(s.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

export function parseIngredient(line: string): Ingredient {
  const text = line.trim().replace(/\s+/g, ' ')
  // quantity (number, fraction or mixed), optional unit, then the item
  const m = /^((?:\d+(?:[.,]\d+)?)(?:\s*[½¼¾⅓⅔⅛]|\s+\d+\/\d+)?|\d+\/\d+|[½¼¾⅓⅔⅛])\s*(?:x\s+)?([a-zA-Z]+\.?)?\s*(?:of\s+)?(.*)$/.exec(text)
  if (!m) return { qty: null, unit: '', item: text }
  const qty = parseNumber(m[1])
  const rawUnit = (m[2] ?? '').replace(/\.$/, '').toLowerCase()
  const unit = UNIT_ALIASES[rawUnit]
  if (unit) return { qty, unit, item: m[3].trim() || rawUnit }
  // The "unit" was actually the first word of the item ("2 onions").
  const item = [m[2], m[3]].filter(Boolean).join(' ').trim()
  return { qty, unit: '', item: item || text }
}

/** Lower-case singular-ish key so "Onions" and "onion" merge. */
export function itemKey(item: string): string {
  return item
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/,.*$/, '')
    .replace(/[^a-z\s]/g, '')
    .trim()
    .split(/\s+/)
    .map((w) => (w.length > 3 && w.endsWith('oes') ? w.slice(0, -2) : w.length > 3 && w.endsWith('ies') ? w.slice(0, -3) + 'y' : w.length > 3 && w.endsWith('s') && !w.endsWith('ss') ? w.slice(0, -1) : w))
    .join(' ')
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100))

export function formatQuantity(qty: number | null, unit: string): string {
  if (qty === null) return ''
  // Tidy big metric amounts: 1500 g → 1.5 kg
  if (unit === 'g' && qty >= 1000) return `${fmt(qty / 1000)} kg`
  if (unit === 'ml' && qty >= 1000) return `${fmt(qty / 1000)} l`
  return unit ? `${fmt(qty)} ${unit}` : fmt(qty)
}

export interface ShoppingLine {
  name: string
  quantity: string
  aisle: string
  forRecipes: string[]
}

/** Merge ingredient lines from several recipes into a shopping list. */
export function aggregateIngredients(sources: { recipe: string; lines: string[] }[]): ShoppingLine[] {
  const groups = new Map<string, { item: string; byUnit: Map<string, number | null>; recipes: Set<string> }>()
  for (const { recipe, lines } of sources) {
    for (const line of lines) {
      const ing = parseIngredient(line)
      if (!ing.item) continue
      const key = itemKey(ing.item)
      const g = groups.get(key) ?? { item: ing.item, byUnit: new Map(), recipes: new Set<string>() }
      // Convert kg→g and l→ml so they add up.
      let { qty, unit } = ing
      if (unit === 'kg' && qty !== null) [qty, unit] = [qty * 1000, 'g']
      if (unit === 'l' && qty !== null) [qty, unit] = [qty * 1000, 'ml']
      const prev = g.byUnit.get(unit)
      g.byUnit.set(unit, prev === undefined ? qty : prev === null || qty === null ? null : prev + qty)
      g.recipes.add(recipe)
      groups.set(key, g)
    }
  }
  return [...groups.values()]
    .map((g) => ({
      name: capitalise(g.item),
      quantity: [...g.byUnit.entries()]
        .map(([u, q]) => formatQuantity(q, u))
        .filter(Boolean)
        .join(' + '),
      aisle: aisleFor(g.item),
      forRecipes: [...g.recipes],
    }))
    .sort((a, b) => a.aisle.localeCompare(b.aisle) || a.name.localeCompare(b.name))
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

export const AISLES = [
  'Fruit & veg',
  'Meat & fish',
  'Dairy & eggs',
  'Bakery',
  'Cupboard',
  'Frozen',
  'Drinks',
  'Snacks',
  'Household',
  'Other',
] as const

const AISLE_WORDS: [string, string[]][] = [
  ['Household', ['toilet', 'kitchen roll', 'washing', 'detergent', 'soap', 'shampoo', 'toothpaste', 'bin bag', 'foil', 'cling', 'sponge', 'bleach', 'nappies', 'wipes']],
  // Tinned/dried things go to the cupboard even if they're a vegetable.
  ['Cupboard', ['chopped tomatoes', 'tinned', 'tin of', 'can of', 'passata', 'tomato puree', 'dried', 'baked beans', 'sweetcorn tin']],
  ['Frozen', ['frozen', 'ice cream', 'peas', 'fish fingers', 'ice']],
  ['Fruit & veg', ['apple', 'banana', 'orange', 'lemon', 'lime', 'berry', 'berries', 'grape', 'melon', 'mango', 'pear', 'peach', 'pineapple', 'kiwi', 'avocado', 'tomato', 'potato', 'onion', 'garlic', 'carrot', 'pepper', 'lettuce', 'salad', 'cucumber', 'spinach', 'broccoli', 'cauliflower', 'courgette', 'mushroom', 'leek', 'celery', 'ginger', 'herb', 'basil', 'coriander', 'parsley', 'mint', 'chilli', 'sweetcorn', 'cabbage', 'kale', 'squash', 'sweet potato', 'spring onion', 'beansprout', 'aubergine']],
  ['Meat & fish', ['chicken', 'beef', 'mince', 'pork', 'lamb', 'bacon', 'sausage', 'ham', 'turkey', 'salmon', 'tuna', 'cod', 'fish', 'prawn', 'steak', 'chorizo']],
  ['Dairy & eggs', ['milk', 'cheese', 'cheddar', 'mozzarella', 'parmesan', 'feta', 'butter', 'yoghurt', 'yogurt', 'cream', 'egg', 'creme fraiche', 'halloumi']],
  ['Bakery', ['bread', 'roll', 'bagel', 'wrap', 'tortilla', 'pitta', 'naan', 'croissant', 'bun', 'muffin', 'crumpet']],
  ['Drinks', ['juice', 'squash', 'lemonade', 'cola', 'water', 'tea', 'coffee', 'wine', 'beer', 'gin', 'rum', 'vodka', 'tonic', 'soda', 'prosecco']],
  ['Snacks', ['crisps', 'chocolate', 'biscuit', 'sweets', 'popcorn', 'cereal bar']],
  ['Cupboard', ['pasta', 'spaghetti', 'rice', 'noodle', 'flour', 'sugar', 'salt', 'oil', 'vinegar', 'stock', 'tin', 'beans', 'lentil', 'chickpea', 'sauce', 'ketchup', 'mayo', 'mustard', 'honey', 'jam', 'cereal', 'oats', 'porridge', 'spice', 'paprika', 'cumin', 'curry', 'cinnamon', 'oregano', 'baking', 'yeast', 'cocoa', 'peanut', 'nut', 'raisin', 'syrup', 'soy', 'coconut milk', 'passata', 'puree']],
]

export function aisleFor(item: string): string {
  const s = item.toLowerCase()
  // Match at the start of a word, so "roll" doesn't match "trolley".
  for (const [aisle, words] of AISLE_WORDS) if (words.some((w) => new RegExp(`(^|[^a-z])${w}`).test(s))) return aisle
  return 'Other'
}
