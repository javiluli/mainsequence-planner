import type { Building } from '@/shared/@types/building.type'
import { buildings, externallyAcquiredItemIds, indexProducerBuildingsByItemId, items, producerBuildingsByItemId } from '@/shared/data'
import { describe, expect, it } from 'vitest'
import { getRecipeChoicesForItem } from '@/features/planner/lib/recipe-options'
import { buildProductionPlan } from '@/features/planner/lib/production-plan/build-production-plan'

const machines: Building[] = [
  {
    id: 'refinery',
    name: 'Refinery',
    type: 'production',
    power: 10,
    recipes: [
      { id: 'standard', output: { id: 'plate', amount_per_minute: 30 }, inputs: [{ id: 'ore', amount_per_minute: 30 }] },
      { id: 'enriched', output: { id: 'plate', amount_per_minute: 60 }, inputs: [{ id: 'enriched_ore', amount_per_minute: 20 }] },
    ],
  },
  {
    id: 'assembler',
    name: 'Assembler',
    type: 'production',
    power: 20,
    recipes: [{ id: 'assembly', output: { id: 'plate', amount_per_minute: 20 }, inputs: [{ id: 'parts', amount_per_minute: 10 }] }],
  },
]

const build = (recipeId?: string) =>
  buildProductionPlan({
    buildings: machines,
    producerBuildingsByItemId: indexProducerBuildingsByItemId(machines),
    targetId: 'plate',
    targetIpm: 60,
    isRawTarget: false,
    rawItemIds: new Set(['ore', 'enriched_ore', 'parts']),
    supplyCountByItem: {},
    recipeIdByItemId: recipeId ? { plate: recipeId } : {},
  })

describe('explicit production recipe selection', () => {
  it('exposes distinct IDs for every valid alternative', () => {
    expect(getRecipeChoicesForItem(machines, 'plate').map(({ id }) => id)).toEqual(['standard', 'enriched', 'assembly'])
  })

  it('uses the selected recipe rates and inputs, not the first matching output', () => {
    const plan = build('enriched')
    expect(plan.steps).toEqual([expect.objectContaining({ itemId: 'plate', buildingId: 'refinery', buildingCount: 1 })])
  })

  it('allows an alternative machine when its exact recipe is selected', () => {
    const plan = build('assembly')
    expect(plan.steps[0]).toEqual(expect.objectContaining({ itemId: 'plate', buildingId: 'assembler', buildingCount: 3 }))
  })

  it('rejects a stale recipe choice', () => {
    expect(build('missing').steps[0]).toEqual(expect.objectContaining({ itemId: 'plate', buildingId: 'refinery', buildingCount: 2 }))
  })
})

describe('exact raw recipe authorization and presentation (F02/F16)', () => {
  const rawItemIds = new Set(items.filter((item) => item.type === 'raw').map((item) => item.id))
  const buildCatalog = (targetId: string, recipeIdByItemId: Record<string, string> = {}, supplyCountByItem: Record<string, number> = {}) =>
    buildProductionPlan({
      buildings,
      producerBuildingsByItemId,
      targetId,
      targetIpm: 20,
      isRawTarget: rawItemIds.has(targetId),
      rawItemIds,
      externalItemIds: externallyAcquiredItemIds,
      supplyCountByItem,
      recipeIdByItemId,
    })

  it.each([
    ['T_CobaltOre', 'T_CobaltPlates'],
    ['T_NickelOre', 'T_NickelPlates1'],
  ])('keeps %s external when its raw recipe is absent or belongs to another output', (itemId, targetId) => {
    const expected = buildCatalog(targetId)
    expect(expected.rawInputs).toContainEqual({ itemId, amountPerMinute: 20 })
    for (const selectedId of ['removed_recipe', 'titanium_synthesis', 'cobalt_plates', '']) {
      expect(buildCatalog(targetId, { [itemId]: selectedId })).toEqual(expected)
    }
  })

  it('retains source-backed Nickel synthesis only when explicitly selected for Nickel Ore', () => {
    const plan = buildCatalog('T_NickelPlates1', { T_NickelOre: 'nickel_synthesis' })
    expect(plan.issues).toEqual([])
    expect(plan.steps).toEqual(
      expect.arrayContaining([expect.objectContaining({ itemId: 'T_NickelOre', recipeId: 'nickel_synthesis', buildingId: 'enrichment' })]),
    )
    expect(plan.rawInputs.some((input) => input.itemId === 'T_NickelOre')).toBe(false)
    expect(plan.steps).toEqual(
      expect.arrayContaining([expect.objectContaining({ itemId: 'T_Protomatter', recipeId: 'protomatter', targetIpm: 20 })]),
    )
  })

  it.each([
    ['T_NickelOre', 'nickel_synthesis'],
    ['T_TitaniumOre', 'titanium_synthesis'],
  ])('presents the production chain for %s only after an exact synthesis selection', (itemId, recipeId) => {
    const external = buildCatalog(itemId)
    expect(external.isRawTarget).toBe(true)
    expect(external.steps).toEqual([])
    const synthesized = buildCatalog(itemId, { [itemId]: recipeId })
    expect(synthesized.isRawTarget).toBe(false)
    expect(synthesized.issues).toEqual([])
    expect(synthesized.steps).toContainEqual(expect.objectContaining({ itemId, recipeId, buildingId: 'enrichment', targetIpm: 20 }))
    for (const invalidId of ['removed_recipe', 'cobalt_plates', '']) {
      expect(buildCatalog(itemId, { [itemId]: invalidId })).toEqual(external)
    }
  })

  it('retains the production presentation for a valid raw route fully covered by supply', () => {
    const supply = { T_NickelOre: 20 }
    const synthesized = buildCatalog('T_NickelOre', { T_NickelOre: 'nickel_synthesis' }, supply)
    expect(synthesized.isRawTarget).toBe(false)
    expect(synthesized.steps).toEqual([])
    expect(synthesized.stats.buildings).toBe(0)
    expect(synthesized.supplyCountByItem).toEqual(supply)
    expect(buildCatalog('T_NickelOre', {}, supply).isRawTarget).toBe(true)
  })
})
