import { describe, expect, it } from 'vitest'
import { aggregateIngredients, AISLES, aisleFor, itemKey, parseIngredient } from './ingredients'

describe('parseIngredient', () => {
  it.each([
    ['200g pasta', { qty: 200, unit: 'g', item: 'pasta' }],
    ['200 g pasta', { qty: 200, unit: 'g', item: 'pasta' }],
    ['2 onions', { qty: 2, unit: '', item: 'onions' }],
    ['½ tsp salt', { qty: 0.5, unit: 'tsp', item: 'salt' }],
    ['1 1/2 cups of milk', { qty: 1.5, unit: 'cup', item: 'milk' }],
    ['1.5kg potatoes', { qty: 1.5, unit: 'kg', item: 'potatoes' }],
    ['2 tins chopped tomatoes', { qty: 2, unit: 'tin', item: 'chopped tomatoes' }],
    ['3 cloves garlic', { qty: 3, unit: 'clove', item: 'garlic' }],
    ['Salt and pepper', { qty: null, unit: '', item: 'Salt and pepper' }],
  ])('%s', (line, expected) => {
    expect(parseIngredient(line)).toEqual(expected)
  })
})

describe('itemKey', () => {
  it('matches singular and plural', () => {
    expect(itemKey('Onions')).toBe(itemKey('onion'))
    expect(itemKey('tomatoes')).toBe(itemKey('tomato'))
    expect(itemKey('berries')).toBe(itemKey('berry'))
    expect(itemKey('grass')).toBe('grass')
  })
})

describe('aggregateIngredients', () => {
  it('adds up the same ingredient across recipes and remembers which recipes need it', () => {
    const list = aggregateIngredients([
      { recipe: 'Spaghetti', lines: ['400g pasta', '1 onion', '2 tins chopped tomatoes'] },
      { recipe: 'Pasta bake', lines: ['300 g pasta', '2 onions', '100g cheddar'] },
      { recipe: 'Chilli', lines: ['1kg beef mince', '1 tin chopped tomatoes'] },
    ])
    const by = Object.fromEntries(list.map((l) => [l.name, l]))
    expect(by['Pasta'].quantity).toBe('700 g')
    expect(by['Onion'].quantity).toBe('3')
    expect(by['Chopped tomatoes'].quantity).toBe('3 tin')
    expect(by['Beef mince'].quantity).toBe('1 kg')
    expect(by['Pasta'].forRecipes).toEqual(['Spaghetti', 'Pasta bake'])
  })

  it('keeps different units separate rather than guessing', () => {
    const [milk] = aggregateIngredients([{ recipe: 'A', lines: ['200ml milk'] }, { recipe: 'B', lines: ['1 cup milk'] }])
    expect(milk.quantity).toBe('200 ml + 1 cup')
  })
})

describe('aisleFor (Woolworths Eastgardens layout)', () => {
  it.each([
    ['Bananas', '0.2'],
    ['Granny Smith apples', '0.3'],
    ['Strawberries', '0.1'],
    ['carrots', '0.4'],
    ['Cherry tomatoes', '0.5'],
    ['2 red onions', '0.6'],
    ['Baby spinach', '0.6'],
    ['milk', '0.7'],
    ['Beef mince', '1'],
    ['eggs', '1'],
    ['Wholemeal bread', '2'],
    ['Greek yoghurt', '2'],
    ['grated cheese', '2'],
    ['Tortilla wraps', '2'],
    ['Nutella', '2'],
    ['coffee', '3'],
    ['Chips', '4'],
    ['Tonic', '5'],
    ['Spaghetti', '6'],
    ['Coconut milk', '6'],
    ['Tomato paste', '6'],
    ['Chopped tomatoes', '7'],
    ['Plain flour', '7'],
    ['Peanuts', '7'],
    ['Al foil', '8'],
    ['Toothpaste', '9'],
    ['AA batteries', '10'],
    ['Dish liquid', '11'],
    ['Toilet paper', '12'],
    ['Ice cream', '12'],
    ['Protein bars', 'coles'],
    ['Pad thai sauce', '7'],
    ['Birthday candles', '4'],
    ['Something unusual', 'other'],
  ])('%s → aisle %s', (item, aisle) => {
    expect(aisleFor(item)).toBe(aisle)
  })

  it('every section in the layout is reachable and in walking order', () => {
    expect(AISLES[0]).toBe('0.1')
    expect(AISLES.at(-1)).toBe('other')
  })
})
