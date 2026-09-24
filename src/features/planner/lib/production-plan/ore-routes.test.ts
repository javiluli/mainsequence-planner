import { buildings, indexProducerBuildingsByItemId } from '@/shared/data'
import { describe, expect, it } from 'vitest'
import { getRecipeChoicesForItem } from '../recipe-options'
import { buildProductionPlan } from './build-production-plan'

/** Assert the game-backed choice: enriched ore is optional for plates, mandatory for Superalloy. */
describe('normal and enriched ore routes', () => {
  it.each([
    ['T_CobaltPlates', 'cobalt_plates', 'enriched_cobalt_plates', 'T_CobaltOre'],
    ['T_NickelPlates1', 'nickel_plates', 'enriched_nickel_plates', 'T_NickelOre'],
    ['T_TitaniumPlates1', 'titanium_plates', 'enriched_titanium_plates', 'T_TitaniumOre'],
  ])('defaults %s to normal ore while exposing enrichment explicitly', (itemId, ordinaryId, enrichedId, oreId) => {
    expect(getRecipeChoicesForItem(buildings, itemId).map((choice) => choice.id)).toEqual([ordinaryId, enrichedId])
    const build = (recipeIdByItemId: Record<string, string>) =>
      buildProductionPlan({
        buildings,
        producerBuildingsByItemId: indexProducerBuildingsByItemId(buildings),
        targetId: itemId,
        targetIpm: 15,
        isRawTarget: false,
        rawItemIds: new Set(['T_CobaltOre', 'T_NickelOre', 'T_TitaniumOre']),
        supplyCountByItem: {},
        recipeIdByItemId,
      })

    const normal = build({})
    expect(normal.steps.find((step) => step.itemId === itemId)?.inputs[0].id).toBe(oreId)
    expect(normal.steps.find((step) => step.itemId === itemId)?.buildingLoad).toBe(0.75)

    const enriched = build({ [itemId]: enrichedId })
    expect(enriched.steps.find((step) => step.itemId === itemId)?.buildingLoad).toBe(0.5)
    expect(enriched.steps.find((step) => step.itemId === itemId)?.inputs[0].id).toMatch(/^T_Enriched/)
  })

  it('does not fabricate a direct normal-ore recipe for Superalloy', () => {
    const choices = getRecipeChoicesForItem(buildings, 'T_Superalloy')
    expect(choices.map((choice) => choice.id)).toEqual(['superalloy'])
    const recipe = buildings.flatMap((building) => building.recipes).find((entry) => entry.id === 'superalloy')
    expect(recipe?.inputs.map((input) => input.id)).toEqual(['T_EnrichedTitanium', 'T_EnrichedNickel', 'T_EnrichedCobalt'])
  })

  it('uses a real ore-synthesis recipe only when it is selected explicitly', () => {
    const plan = buildProductionPlan({
      buildings,
      producerBuildingsByItemId: indexProducerBuildingsByItemId(buildings),
      targetId: 'T_NickelOre',
      targetIpm: 60,
      isRawTarget: true,
      rawItemIds: new Set(['T_NickelOre']),
      supplyCountByItem: {},
      recipeIdByItemId: { T_NickelOre: 'nickel_synthesis' },
    })

    expect(plan.issues).toEqual([])
    expect(plan.rawInputs).toEqual([])
    expect(plan.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ itemId: 'T_NickelOre', buildingId: 'enrichment', recipeId: 'nickel_synthesis' }),
        expect.objectContaining({ itemId: 'T_Protomatter', buildingId: 'relic_synthesizer', recipeId: 'protomatter' }),
      ]),
    )
  })
})
