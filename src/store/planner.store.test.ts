/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from 'vitest'
import { usePlannerStore } from './planner.store'

const resetStore = () => {
  sessionStorage.clear()
  usePlannerStore.setState({
    targetId: '',
    targetIpm: 0,
    supplyCountByItem: {},
    recipeIdByItemId: {},
  })
}

describe('planner store', () => {
  beforeEach(resetStore)

  it('keeps rate at zero without a target and at least one with a target', () => {
    const actions = usePlannerStore.getState()

    actions.setTargetIpm(40)
    expect(usePlannerStore.getState().targetIpm).toBe(0)

    actions.setTargetId('ceramics')
    actions.setTargetIpm(0)
    expect(usePlannerStore.getState().targetIpm).toBe(1)

    actions.setTargetId('')
    expect(usePlannerStore.getState().targetIpm).toBe(0)
  })

  it('updates the production target', () => {
    const actions = usePlannerStore.getState()

    actions.setTargetId('ceramics')
    actions.setTargetIpm(60)

    expect(usePlannerStore.getState()).toMatchObject({
      targetId: 'ceramics',
      targetIpm: 60,
    })
  })

  it('sets only finite positive supply rates, including fractional items/min', () => {
    const actions = usePlannerStore.getState()

    actions.setSupply('calcium_block', 15)
    actions.setSupply('wolfram_bar', 8)
    actions.setSupply('slow_delivery', 0.5)
    actions.setSupply('calcium_block', Number.NaN)
    actions.setSupply('zero', 0)
    actions.setSupply('negative', -1)
    actions.setSupply('infinite', Number.POSITIVE_INFINITY)

    expect(usePlannerStore.getState().supplyCountByItem).toEqual({ wolfram_bar: 8, slow_delivery: 0.5 })
  })

  it('increments from one and removes exhausted or invalid supply', () => {
    const actions = usePlannerStore.getState()

    actions.setSupply('ceramics', 1)
    actions.incrementSupply('ceramics', 4)
    expect(usePlannerStore.getState().supplyCountByItem).toEqual({ ceramics: 5 })

    actions.incrementSupply('ceramics', -5)
    expect(usePlannerStore.getState().supplyCountByItem).toEqual({})

    actions.incrementSupply('ore', 1)
    expect(usePlannerStore.getState().supplyCountByItem).toEqual({ ore: 1 })

    actions.incrementSupply('ore', Number.NaN)
    expect(usePlannerStore.getState().supplyCountByItem).toEqual({})
  })

  it('removes supply explicitly', () => {
    const actions = usePlannerStore.getState()

    actions.setSupply('ceramics', 4)
    expect(usePlannerStore.getState().supplyCountByItem).toEqual({ ceramics: 4 })

    actions.removeSupply('ceramics')
    expect(usePlannerStore.getState().supplyCountByItem).toEqual({})
  })

  it('rehydrates legacy items/min rates without interpreting unrelated starting stock as perpetual supply', async () => {
    sessionStorage.setItem(
      'zstore.planner',
      JSON.stringify({
        state: {
          targetId: 'ceramics',
          targetIpm: 10,
          supplyCountByItem: { valid: 4, fractional: 0.5, zero: 0, negative: -2, missing: null, text: '3' },
          stockByItem: { stored_only: 150 },
        },
        version: 0,
      }),
    )

    await usePlannerStore.persist.rehydrate()

    expect(usePlannerStore.getState().supplyCountByItem).toEqual({ valid: 4, fractional: 0.5 })
    expect(usePlannerStore.getState().supplyCountByItem).not.toHaveProperty('stored_only')
  })
})
