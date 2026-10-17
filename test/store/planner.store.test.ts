/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it } from 'vitest'
import { usePlannerStore } from '@/store/planner.store'
import { buildProductionPlan } from '@/features/planner/lib/production-plan'
import { buildings, items, producerBuildingsByItemId } from '@/shared/data'

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
    actions.setTargetIpm(60)
    expect(usePlannerStore.getState()).toMatchObject({ targetId: 'ceramics', targetIpm: 60 })
    actions.setTargetIpm(0)
    expect(usePlannerStore.getState().targetIpm).toBe(1)

    actions.setTargetId('')
    expect(usePlannerStore.getState().targetIpm).toBe(0)
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

  it('increments supply and removes exhausted, invalid or explicitly cleared deliveries', () => {
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

    actions.setSupply('ceramics', 4)
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

  it.each(['removed_recipe', 'titanium_synthesis'])('keeps raw demand safe after restoring recipe %s', async (recipeId) => {
    sessionStorage.setItem(
      'zstore.planner',
      JSON.stringify({
        state: { targetId: 'T_NickelPlates1', targetIpm: 20, supplyCountByItem: {}, recipeIdByItemId: { T_NickelOre: recipeId } },
        version: 0,
      }),
    )
    await usePlannerStore.persist.rehydrate()
    const state = usePlannerStore.getState()
    expect(state.recipeIdByItemId).toEqual({ T_NickelOre: recipeId })
    const plan = buildProductionPlan({
      buildings,
      producerBuildingsByItemId,
      targetId: state.targetId,
      targetIpm: state.targetIpm,
      isRawTarget: false,
      rawItemIds: new Set(items.filter((item) => item.type === 'raw').map((item) => item.id)),
      supplyCountByItem: state.supplyCountByItem,
      recipeIdByItemId: state.recipeIdByItemId,
    })
    expect(plan.issues).toEqual([])
    expect(plan.rawInputs).toEqual([{ itemId: 'T_NickelOre', amountPerMinute: 20 }])
    expect(plan.stats).toEqual({ buildings: 1, power: 4.5 })
  })
})

/** Builds the observable plan after selection, using the authoritative catalog and saved inputs. */
const buildSelectedPlan = () => {
  const state = usePlannerStore.getState()
  return buildProductionPlan({
    buildings,
    producerBuildingsByItemId,
    targetId: state.targetId,
    targetIpm: state.targetIpm,
    isRawTarget: items.find((item) => item.id === state.targetId)?.type === 'raw',
    rawItemIds: new Set(items.filter((item) => item.type === 'raw').map((item) => item.id)),
    supplyCountByItem: state.supplyCountByItem,
    recipeIdByItemId: state.recipeIdByItemId,
  })
}

describe('catalog target presets and exact recipe opening (F15)', () => {
  beforeEach(resetStore)

  it.each([
    ['T_NickelPlates1', 'nickel_plates'],
    ['T_TitaniumPlates1', 'titanium_plates'],
  ])('presets the neutral recipe of %s rather than the first recipe in the file', (itemId, recipeId) => {
    expect(usePlannerStore.getState().selectTargetItem(itemId)).toBe(true)
    expect(usePlannerStore.getState().targetIpm).toBe(20)
    expect(usePlannerStore.getState().recipeIdByItemId).toEqual({})
    expect(buildSelectedPlan().steps).toContainEqual(expect.objectContaining({ itemId, recipeId, buildingCount: 1, buildingLoad: 1 }))
  })

  it.each([
    ['T_NickelPlates1', 'enriched_nickel_plates'],
    ['T_TitaniumPlates1', 'enriched_titanium_plates'],
  ])('uses the restored choice of %s when selecting an item without specifying a recipe', async (itemId, recipeId) => {
    sessionStorage.setItem(
      'zstore.planner',
      JSON.stringify({
        state: { targetId: '', targetIpm: 0, supplyCountByItem: {}, recipeIdByItemId: { [itemId]: recipeId } },
        version: 0,
      }),
    )
    await usePlannerStore.persist.rehydrate()
    usePlannerStore.getState().selectTargetItem(itemId)
    expect(usePlannerStore.getState().targetIpm).toBe(30)
    expect(buildSelectedPlan().steps).toContainEqual(expect.objectContaining({ itemId, recipeId, buildingCount: 1, buildingLoad: 1 }))
  })

  it.each([
    ['T_NickelPlates1', 'nickel_plates', 20],
    ['T_NickelPlates1', 'enriched_nickel_plates', 30],
    ['T_Xenoeukarya', 'xeno_eukarya_recycling', 30],
  ])('opens exact recipe %s / %s at its net one-machine rate', (itemId, recipeId, rate) => {
    expect(usePlannerStore.getState().selectTargetItem(itemId, recipeId)).toBe(true)
    expect(usePlannerStore.getState()).toMatchObject({ targetId: itemId, targetIpm: rate, recipeIdByItemId: { [itemId]: recipeId } })
    const plan = buildSelectedPlan()
    expect(plan.issues).toEqual([])
    expect(plan.steps).toContainEqual(expect.objectContaining({ itemId, recipeId, buildingCount: 1, buildingLoad: 1 }))
  })

  it('publishes and persists a complete selection once, preserving other recipe choices and supplies', async () => {
    const actions = usePlannerStore.getState()
    actions.setRecipeForItem('T_NickelPlates1', 'enriched_nickel_plates')
    actions.setRecipeForItem('T_TitaniumPlates1', 'enriched_titanium_plates')
    actions.setSupply('T_LeavesIcon', 2.5)
    const notifications: unknown[] = []
    const unsubscribe = usePlannerStore.subscribe((state) =>
      notifications.push({
        targetId: state.targetId,
        targetIpm: state.targetIpm,
        recipeIdByItemId: state.recipeIdByItemId,
      }),
    )
    actions.selectTargetItem('T_NickelPlates1', 'nickel_plates')
    unsubscribe()
    const expected = {
      targetId: 'T_NickelPlates1',
      targetIpm: 20,
      recipeIdByItemId: { T_NickelPlates1: 'nickel_plates', T_TitaniumPlates1: 'enriched_titanium_plates' },
    }
    expect(notifications).toEqual([expected])
    expect(usePlannerStore.getState()).toMatchObject({ ...expected, supplyCountByItem: { T_LeavesIcon: 2.5 } })
    expect(JSON.parse(sessionStorage.getItem('zstore.planner') ?? '{}').state).toMatchObject(expected)
    await usePlannerStore.persist.rehydrate()
    expect(usePlannerStore.getState()).toMatchObject({ ...expected, supplyCountByItem: { T_LeavesIcon: 2.5 } })
  })

  it.each(['removed_recipe', 'titanium_plates', ''])(
    'rejects explicit invalid recipe %s without changing or persisting state',
    (recipeId) => {
      usePlannerStore.getState().selectTargetItem('T_TitaniumPlates1', 'enriched_titanium_plates')
      const before = usePlannerStore.getState()
      const persisted = sessionStorage.getItem('zstore.planner')
      expect(before.selectTargetItem('T_NickelPlates1', recipeId)).toBe(false)
      expect(usePlannerStore.getState()).toBe(before)
      expect(sessionStorage.getItem('zstore.planner')).toBe(persisted)
    },
  )

  it('uses the neutral preset for a stale saved choice without deleting the saved record', () => {
    const actions = usePlannerStore.getState()
    actions.setRecipeForItem('T_NickelPlates1', 'removed_recipe')
    actions.selectTargetItem('T_NickelPlates1')
    expect(usePlannerStore.getState()).toMatchObject({ targetIpm: 20, recipeIdByItemId: { T_NickelPlates1: 'removed_recipe' } })
    expect(buildSelectedPlan().steps).toContainEqual(expect.objectContaining({ recipeId: 'nickel_plates', buildingCount: 1 }))
  })

  it.each([undefined, 'removed_recipe', 'titanium_synthesis'])(
    'keeps raw targets external without a valid saved selection (%s)',
    (recipeId) => {
      const actions = usePlannerStore.getState()
      if (recipeId) actions.setRecipeForItem('T_NickelOre', recipeId)
      actions.selectTargetItem('T_NickelOre')
      expect(usePlannerStore.getState().targetIpm).toBe(1)
      expect(buildSelectedPlan()).toMatchObject({ steps: [], rawInputs: [{ itemId: 'T_NickelOre', amountPerMinute: 1 }] })
    },
  )

  it('retains a valid saved raw recipe without exposing new synthesis controls', () => {
    const actions = usePlannerStore.getState()
    actions.setRecipeForItem('T_NickelOre', 'nickel_synthesis')
    actions.selectTargetItem('T_NickelOre')
    expect(usePlannerStore.getState().targetIpm).toBe(60)
    expect(buildSelectedPlan().steps).toContainEqual(
      expect.objectContaining({ itemId: 'T_NickelOre', recipeId: 'nickel_synthesis', buildingCount: 1 }),
    )
  })

  it('keeps manual rate editing and clearing a target independent of saved choices and supply', () => {
    const actions = usePlannerStore.getState()
    actions.setSupply('T_NickelOre', 2)
    actions.selectTargetItem('T_NickelPlates1', 'enriched_nickel_plates')
    actions.setTargetIpm(45)
    expect(usePlannerStore.getState().targetIpm).toBe(45)
    actions.selectTargetItem('')
    expect(usePlannerStore.getState()).toMatchObject({
      targetId: '',
      targetIpm: 0,
      recipeIdByItemId: { T_NickelPlates1: 'enriched_nickel_plates' },
      supplyCountByItem: { T_NickelOre: 2 },
    })
  })
})
