import { describe, expect, it } from 'vitest'
import { OTHER_ID, sectionLabel, sectionOfItem, STORE_SECTIONS } from './storeLayout'

describe('store layout', () => {
  it('has every aisle from the printed sheet, in order, plus Coles and Other', () => {
    expect(STORE_SECTIONS.map((s) => s.id)).toEqual(['0.1', '0.2', '0.3', '0.4', '0.5', '0.6', '0.7', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', 'coles', 'other'])
  })

  it('keeps an item where someone moved it', () => {
    expect(sectionOfItem({ name: 'Ice cream', aisle: 'coles' })).toBe('coles')
  })

  it('re-sorts items saved before the layout existed (old aisle names)', () => {
    expect(sectionOfItem({ name: 'Bananas', aisle: 'Fruit & veg' })).toBe('0.2')
    expect(sectionOfItem({ name: 'Mystery', aisle: 'Other' })).toBe(OTHER_ID)
  })

  it('labels sections nicely', () => {
    expect(sectionLabel('6')).toBe('6 · Pasta, rice & Asian')
    expect(sectionLabel('coles')).toBe('Coles')
  })
})
