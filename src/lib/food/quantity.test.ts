import { describe, expect, it } from 'vitest'
import { addQuantities, parseCount, stepQuantity } from './quantity'

describe('shopping quantities', () => {
  it('reads counts', () => {
    expect(parseCount('')).toEqual({ n: 1, unit: '' })
    expect(parseCount('3')).toEqual({ n: 3, unit: '' })
    expect(parseCount('600 g')).toEqual({ n: 1, unit: '600 g' })
    expect(parseCount('2 × 600 g')).toEqual({ n: 2, unit: '600 g' })
  })

  it('steps up and down, never below 1', () => {
    expect(stepQuantity('', 1)).toBe('2')
    expect(stepQuantity('2', 1)).toBe('3')
    expect(stepQuantity('2', -1)).toBe('')
    expect(stepQuantity('', -1)).toBe('')
    expect(stepQuantity('600 g', 1)).toBe('2 × 600 g')
    expect(stepQuantity('2 × 600 g', -1)).toBe('600 g')
    expect(stepQuantity('99', 1)).toBe('99')
  })

  it('adds the same item together', () => {
    expect(addQuantities('', '2')).toBe('3')
    expect(addQuantities('2', '2')).toBe('4')
    expect(addQuantities('600 g', '600 g')).toBe('2 × 600 g')
    expect(addQuantities('600 g', '2')).toBeNull()
  })
})
