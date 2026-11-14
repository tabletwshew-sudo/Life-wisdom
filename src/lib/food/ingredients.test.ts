import { describe, expect, it } from 'vitest'
import { aggregateIngredients, aisleFor, itemKey, parseIngredient } from './ingredients'

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

describe('aisleFor', () => {
  it('sorts items into supermarket aisles', () => {
    expect(aisleFor('Bananas')).toBe('Fruit & veg')
    expect(aisleFor('chicken thighs')).toBe('Meat & fish')
    expect(aisleFor('Greek yoghurt')).toBe('Dairy & eggs')
    expect(aisleFor('spaghetti')).toBe('Cupboard')
    expect(aisleFor('frozen peas')).toBe('Frozen')
    expect(aisleFor('toilet roll')).toBe('Household')
    expect(aisleFor('birthday candles')).toBe('Other')
    expect(aisleFor('Chopped tomatoes')).toBe('Cupboard')
    expect(aisleFor('tomatoes')).toBe('Fruit & veg')
  })
})
