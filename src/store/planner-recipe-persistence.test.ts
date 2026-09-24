/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from 'vitest'
import { usePlannerStore } from './planner.store'

/** Explicit recipe choices must survive normal session hydration. */
describe('planner recipe selection persistence', () => {
  beforeEach(() => {
    sessionStorage.clear()
    usePlannerStore.setState({
      targetId: '',
      targetIpm: 0,
      supplyCountByItem: {},
      recipeIdByItemId: {},
    })
  })

  it('persists exact recipe IDs', async () => {
    usePlannerStore.getState().setRecipeForItem('plate', 'enriched_plates')
    expect(usePlannerStore.getState().recipeIdByItemId).toEqual({ plate: 'enriched_plates' })

    await usePlannerStore.persist.rehydrate()
    expect(usePlannerStore.getState().recipeIdByItemId).toEqual({ plate: 'enriched_plates' })
    usePlannerStore.getState().setRecipeForItem('plate', '')
    expect(usePlannerStore.getState().recipeIdByItemId).toEqual({})
  })

  it('hydrates older snapshots lacking the recipe selection field', async () => {
    sessionStorage.setItem(
      'zstore.planner',
      JSON.stringify({ state: { targetId: 'plate', targetIpm: 20, supplyCountByItem: {} }, version: 0 }),
    )
    await usePlannerStore.persist.rehydrate()
    expect(usePlannerStore.getState().recipeIdByItemId).toEqual({})
  })
})
