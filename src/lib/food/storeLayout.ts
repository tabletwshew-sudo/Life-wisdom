/**
 * The family's own shop layout: Woolworths (Eastgardens), in walking order,
 * copied from the printed list. Shopping items are grouped by these sections,
 * and the quick-add checklist shows every item.
 *
 * To change the layout, edit this file: sections are in walking order; `dir`
 * is the arrow from the printed sheet; `regular` items (bold on the sheet) are
 * starred; `keywords` help sort typed items and recipe ingredients into the
 * right aisle (the item name itself is always a keyword).
 */

export type Direction = 'left' | 'right' | 'up' | 'down'

export interface StoreItem {
  name: string
  regular?: boolean
  /** Extra words that mean this item (lower case, singular is fine: "apple" matches "apples"). */
  keywords?: string[]
}

export interface StoreSection {
  id: string
  title: string
  dir?: Direction
  items: StoreItem[]
}

export const STORE_NAME = 'Woolworths (Eastgardens)'
export const OTHER_ID = 'other'

const i = (name: string, keywords?: string[], regular?: boolean): StoreItem => ({ name, keywords, regular })
const r = (name: string, keywords?: string[]): StoreItem => ({ name, keywords, regular: true })

export const STORE_SECTIONS: StoreSection[] = [
  {
    id: '0.1',
    title: 'Berries, avo & bakery',
    dir: 'left',
    items: [r('Strawberries', ['strawb', 'berry', 'berries', 'raspberr', 'blueberr']), r('Avocado', ['avo']), r('Grapes'), i('Bakery', ['bread roll', 'roll', 'bun', 'croissant', 'muffin', 'bagel', 'baguette']), i('Sourdough')],
  },
  {
    id: '0.2',
    title: 'Deli, cakes & bananas',
    dir: 'right',
    items: [i('Hummus', ['houmous', 'dip']), i('Deli meats', ['salami', 'prosciutto', 'deli']), i('Cookies'), i('Cakes', ['cake']), r('Bananas', ['banana'])],
  },
  {
    id: '0.3',
    title: 'Broccoli & apples',
    dir: 'left',
    items: [r('Broccoli', ['broccolini', 'cauliflower']), r('Apples', ['apple'])],
  },
  {
    id: '0.4',
    title: 'Cheeses & citrus',
    dir: 'right',
    items: [i('Cheeses (deli)', ['brie', 'camembert', 'blue cheese', 'feta', 'parmesan']), i('Meredith', ['meredith']), i('Oranges', ['orange', 'mandarin']), i('Lemons', ['lemon']), i('Limes', ['lime']), i('Watermelon', ['melon', 'rockmelon']), r('Carrots', ['carrot'])],
  },
  {
    id: '0.5',
    title: 'Herbs, cucumber & tomatoes',
    dir: 'left',
    items: [i('Fresh herbs', ['parsley', 'basil', 'coriander', 'mint', 'chive', 'dill', 'fresh herb']), r('Cucumber', ['cucumber']), i('Tomatoes', ['tomato', 'cherry tomato']), i('BBQ chicken', ['bbq chicken', 'roast chicken'])],
  },
  {
    id: '0.6',
    title: 'Potatoes, onions & salad',
    dir: 'right',
    items: [
      i('Potatoes', ['potato']),
      i('Sweet potato', ['sweet potato']),
      i('Onions', ['onion', 'shallot', 'spring onion', 'leek']),
      i('Garlic'),
      i('Ginger'),
      i('Corn', ['sweetcorn', 'corn cob']),
      r('Salad leaves', ['leaves', 'mesclun', 'rocket', 'spinach', 'iceberg', 'lettuce', 'salad', 'kale', 'cabbage', 'capsicum', 'pepper', 'zucchini', 'courgette', 'mushroom', 'celery', 'beans', 'green bean', 'bok choy', 'pumpkin', 'eggplant', 'aubergine', 'chilli']),
    ],
  },
  {
    id: '0.7',
    title: 'Health food, salmon & milk',
    dir: 'left',
    items: [i('Health food'), i('Energy bars', ['energy bar', 'muesli bar']), i('Salmon (fresh / smoked)', ['salmon', 'fish', 'prawn', 'cod', 'barramundi']), r('Milk', ['milk'])],
  },
  {
    id: '1',
    title: 'Meat, eggs & soup',
    dir: 'down',
    items: [
      i('Chicken (breast / thigh / tenderloins)', ['chicken', 'chicken breast', 'chicken thigh', 'tenderloin', 'drumstick']),
      r('Mince', ['mince', 'beef mince']),
      i('Sausages', ['sausage', 'snag']),
      i('Steak', ['steak', 'beef', 'lamb', 'pork', 'chop', 'roast']),
      i('Cooked chicken breast', ['cooked chicken']),
      i('Ham'),
      i('Bacon'),
      i('Soup (fresh)', ['soup']),
      r('Eggs', ['egg']),
    ],
  },
  {
    id: '2',
    title: 'Spreads, dairy & bread',
    dir: 'up',
    items: [
      i('Honey'),
      i('Jam', ['nutella']),
      i('Peanut butter', ['peanut butter']),
      i('Vegemite'),
      i('OJ', ['orange juice']),
      i('Pikelets', ['pikelet', 'crumpet']),
      r('Butter (spreadable)', ['butter', 'spreadable']),
      r('Butter (block)', ['butter block']),
      r('W bread', ['bread', 'loaf', 'wholemeal']),
      i('Cream', ['thickened cream', 'cream']),
      i('Sour cream', ['sour cream']),
      r('Keffir', ['kefir', 'keffir']),
      i('Yoghurt', ['yogurt', 'yoghurt']),
      i('Wraps', ['wrap', 'tortilla', 'pita', 'pitta']),
      i('Cheese (haloumi / mozz / cream / pizza)', ['cheese', 'haloumi', 'halloumi', 'mozzarella', 'mozz', 'cream cheese', 'pizza cheese', 'cheddar']),
      r('Cheese (grated)', ['grated cheese']),
      r('Cheese (sliced)', ['sliced cheese', 'cheese slice']),
    ],
  },
  {
    id: '3',
    title: 'Breakfast, juice & coffee',
    dir: 'down',
    items: [i('Juices', ['juice']), r('Noshu dbl choc', ['noshu']), r('Milo bars', ['milo bar']), i('A2 powder', ['a2 powder', 'milk powder']), i('Milo'), i('Oats', ['oat', 'porridge', 'muesli', 'granola']), r('Spec K', ['special k', 'spec k', 'cereal']), i('Tea'), i('Coffee')],
  },
  {
    id: '4',
    title: 'Biscuits, nuts & chips',
    dir: 'up',
    items: [
      i('Sweet biscuits', ['biscuit', 'tim tam']),
      i('Raw popcorn', ['popcorn kernel']),
      i('Dry biscuits', ['dry biscuit']),
      i('Jatz'),
      r('Crackers (WW blue label)', ['cracker', 'rice cracker']),
      i('Crackers (Sakata WG)', ['sakata']),
      i('Cashews', ['cashew']),
      i('Macadamias', ['macadamia']),
      r('Chips', ['chip', 'crisps']),
      i('Popcorn packets', ['popcorn']),
      i('Party gear', ['party', 'balloon', 'candle']),
      i('Stationery', ['pen', 'pencil', 'notebook', 'tape', 'glue']),
      i('Fish fingers', ['fish finger']),
    ],
  },
  {
    id: '5',
    title: 'Drinks & chocolate',
    dir: 'down',
    items: [i('Water', ['water', 'sparkling water', 'soda water']), i('Soft drink', ['soft drink', 'cola', 'lemonade', 'coke', 'squash']), i('Chocolate', ['chocolate', 'choc']), r('Tonic', ['tonic']), i('Gift cards', ['gift card'])],
  },
  {
    id: '6',
    title: 'Pasta, rice & Asian',
    dir: 'up',
    items: [
      r('Pasta (spirals / spaghetti / penne / rigatoni)', ['pasta', 'spaghetti', 'penne', 'spiral', 'fusilli', 'rigatoni', 'macaroni', 'lasagne', 'noodle']),
      i('Taco kit', ['taco', 'fajita', 'burrito']),
      i('Corn chips', ['corn chip', 'nacho']),
      i('Tamari'),
      i('Soy sauce', ['soy']),
      i('Kewpie', ['kewpie']),
      i('Panko crumbs', ['panko']),
      i('Coconut cream / milk', ['coconut cream', 'coconut milk']),
      i('Tomato paste', ['tom paste', 'tomato paste', 'tomato puree']),
      r('Rice cups (white / brown / basmati)', ['rice', 'rice cup', 'basmati']),
      i('Butter chicken sauce', ['butter chick', 'curry paste', 'curry sauce', 'curry']),
      i('Naan', ['naan']),
      i('Tennis biscuits', ['tennis']),
      i('Stock', ['stock', 'gravy']),
      i('Dried herbs', ['dried herb', 'oregano', 'thyme', 'paprika', 'cumin', 'cinnamon', 'spice']),
      i('Breadcrumbs', ['breadcrumb']),
      i('Dukkah'),
      i('MCT oil', ['mct']),
      i('Olive oil', ['oil', 'olive oil', 'vinegar']),
    ],
  },
  {
    id: '7',
    title: 'Frozen, tins & baking',
    dir: 'down',
    items: [
      i('Frozen veg', ['frozen veg', 'frozen peas', 'peas']),
      i('Tinned food (tuna / toms)', ['tin', 'tinned', 'tuna', 'toms', 'chopped tomato', 'passata', 'chickpea', 'lentil', 'kidney bean', 'black bean']),
      i('Baked beans', ['baked bean']),
      i('Tinned spag', ['tinned spag']),
      i('Maple syrup', ['maple']),
      i('Ice magic', ['ice magic']),
      r('Big red soup', ['big red', 'tinned soup']),
      i('Nuts', ['nut', 'almond', 'peanut', 'walnut']),
      i('Shredded coconut', ['shredded coconut', 'desiccated']),
      i('Mayo', ['mayo', 'mayonnaise']),
      i('Dressings', ['dressing']),
      i('Canned fruit', ['canned fruit']),
      i('Cake mix', ['cake mix']),
      i('Bicarb soda', ['bicarb', 'baking powder', 'yeast', 'cocoa', 'vanilla']),
      i('Sugar (white / brown / caster / icing)', ['sugar']),
      i('Golden syrup', ['golden syrup']),
      i('Monkfruit', ['monkfruit']),
      i('Flour (plain / SR)', ['flour']),
      i('Mustard (french / dijon / hot English)', ['mustard', 'dijon']),
      i('Sauce (BBQ / tomato / Worcestershire)', ['sauce', 'ketchup', 'worcestershire', 'bbq sauce', 'tomato sauce']),
    ],
  },
  {
    id: '8',
    title: 'Medicine & kitchenware',
    dir: 'up',
    items: [
      i('Panadol', ['paracetamol']),
      i('Nurofen', ['ibuprofen']),
      i('Strepsils'),
      i('Band aids', ['band aid', 'bandaid', 'plaster']),
      i('Cooking (pans etc)', ['saucepan', 'frying pan', 'utensil']),
      i('Water bottles', ['water bottle']),
      i('Décor', ['decor']),
      i('Bags (freezer / zip)', ['freezer bag', 'zip bag', 'sandwich bag']),
      i('Glad wrap', ['glad wrap', 'cling']),
      i('Baking paper', ['baking paper']),
      i('Al foil', ['foil']),
      i('Socks', ['sock']),
    ],
  },
  {
    id: '9',
    title: 'Toiletries',
    dir: 'down',
    items: [
      i('Tampons (super / reg)', ['tampon', 'sanitary pad']),
      i('Toothpaste', ['toothpaste']),
      i('Toothbrush', ['toothbrush']),
      i('Oral B heads', ['oral b', 'brush head']),
      i('Soap', ['soap', 'body wash', 'shampoo', 'conditioner']),
      i('Sunscreen', ['sunscreen', 'suncream']),
      i('Nails (polish / remover)', ['nail polish', 'nail']),
      i('Deodorant', ['deo', 'deodorant']),
      i('Cotton (buds / wool / rounds)', ['cotton']),
    ],
  },
  {
    id: '10',
    title: 'Hardware & pet food',
    dir: 'up',
    items: [i('Hardware', ['hardware']), i('Batteries (CR42 / AA / AAA)', ['batter']), i('Globes', ['globe', 'light bulb', 'bulb']), i('Pest control', ['pest', 'fly spray', 'mortein']), i('Pet food', ['pet food', 'dog food', 'cat food'])],
  },
  {
    id: '11',
    title: 'Cleaning',
    dir: 'down',
    items: [
      i('Dish wands (green / blue)', ['dish wand', 'sponge', 'scourer']),
      i('Bags (green / small handled)', ['bin bag', 'rubbish bag', 'green bag']),
      i('Dish liquid', ['dish liquid', 'dishwashing', 'dishwasher tablet']),
      i('Cleaning spray', ['spray', 'cleaner', 'wipes']),
      i('Toilet cleaner', ['toilet cleaner']),
      i('Domestos', ['domestos']),
      i('Exit Mould', ['mould']),
      i('Bleach'),
      i('Smellies', ['air freshener', 'smellies']),
    ],
  },
  {
    id: '12',
    title: 'Ice cream & paper',
    dir: 'up',
    items: [i('Ice cream', ['ice cream', 'icecream', 'ice-cream']), i('Toilet paper', ['toilet paper', 'toilet roll', 'loo roll']), i('Tissues (large / mini)', ['tissue']), i('Frozen blueberries', ['frozen blueberr', 'frozen berr']), i('Paper towel', ['paper towel', 'kitchen roll'])],
  },
  {
    id: 'coles',
    title: 'Coles',
    items: [i('Protein bars (Coles)', ['protein bar']), i('Ice-cream (Coles)', []), i('Soup (Coles)', [])],
  },
  { id: OTHER_ID, title: 'Other', items: [] },
]

const SECTION_BY_ID = new Map(STORE_SECTIONS.map((s) => [s.id, s]))
export const sectionById = (id: string) => SECTION_BY_ID.get(id)
export const sectionLabel = (id: string) => {
  const s = SECTION_BY_ID.get(id)
  if (!s) return 'Other'
  return /^\d/.test(s.id) ? `${s.id} · ${s.title}` : s.title
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

/** Base words of an item name: "Pasta (spirals / spaghetti)" → "pasta". */
const baseName = (name: string) => norm(name.replace(/\(.*?\)/g, ''))

// Every keyword → its section, longest first so "chopped tomato" beats "tomato".
const KEYWORDS: { kw: string; section: string }[] = (() => {
  const seen = new Set<string>()
  const out: { kw: string; section: string }[] = []
  for (const s of STORE_SECTIONS) {
    for (const item of s.items) {
      for (const k of [baseName(item.name), ...(item.keywords ?? []).map(norm)]) {
        if (!k || seen.has(k)) continue // the first (earliest in the walk) wins
        seen.add(k)
        out.push({ kw: k, section: s.id })
      }
    }
  }
  return out.sort((a, b) => b.kw.length - a.kw.length)
})()

/** Which section of the shop an item belongs in ("other" if we can't tell). */
export function sectionFor(itemName: string): string {
  const text = ` ${norm(itemName)} `
  for (const { kw, section } of KEYWORDS) {
    // Match at the start of a word, so "egg" matches "eggs" but not "nutmeg".
    if (text.includes(` ${kw}`)) return section
  }
  return OTHER_ID
}

/** The section a saved shopping item is shown in: its saved aisle if that's one of ours, else worked out from the name. */
export function sectionOfItem(item: { name: string; aisle: string }): string {
  return SECTION_BY_ID.has(item.aisle) ? item.aisle : sectionFor(item.name)
}

export const sectionOrder = (id: string) => {
  const idx = STORE_SECTIONS.findIndex((s) => s.id === id)
  return idx === -1 ? STORE_SECTIONS.length : idx
}
