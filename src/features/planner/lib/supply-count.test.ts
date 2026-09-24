import { describe, expect, it } from 'vitest'
import { getSteadyStateSupplyRates, getSupplyCountItemIds, isPositiveSupplyCount, normalizeSupplyCountByItem } from './supply-count'

describe('continuous external supply', () => {
  it('accepts finite fractional rates but not zero, negative or nonfinite values', () => {
    expect(isPositiveSupplyCount(0.5)).toBe(true)
    expect(isPositiveSupplyCount(0.01)).toBe(true)
    for (const value of [0, -0.1, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, '7.5', null]) {
      expect(isPositiveSupplyCount(value)).toBe(false)
    }
    expect(normalizeSupplyCountByItem({ ore: 7.5, slow: 0.01, zero: 0, invalid: Number.NaN, text: '15', '': 3 })).toEqual({
      ore: 7.5,
      slow: 0.01,
    })
    expect(getSupplyCountItemIds({ ore: 7.5, slow: 0.01, invalid: 0 })).toEqual(['ore', 'slow'])
  })

  it('does not convert a finite starting stock into a permanent delivery rate', () => {
    expect(getSteadyStateSupplyRates({ kind: 'starting-stock', quantities: { ore: 150 } })).toEqual({})
    expect(getSteadyStateSupplyRates({ kind: 'continuous-rate', rates: { ore: 7.5 } })).toEqual({ ore: 7.5 })
  })
})
