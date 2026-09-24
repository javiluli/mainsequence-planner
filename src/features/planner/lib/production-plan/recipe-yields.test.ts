import { buildings, indexProducerBuildingsByItemId, items } from '@/shared/data'
import type { Building } from '@/shared/@types/building.type'
import { describe, expect, it } from 'vitest'
import { buildProductionPlan } from './build-production-plan'

/** Reuse the protected source through the normalized public catalog, never modify its snapshots. */
describe('recycling and source-backed byproducts', () => {
  it.each([
    ['T_Xenoeukarya', 'xeno_eukarya_recycling'],
    ['T_Xenoarchaea', 'xenoarchaea_recycling'],
    ['T_Xenobacteria', 'xenobacteria_recycling'],
  ])('calculates the net yield for %s with no self-edge or fake feed demand', (itemId, recipeId) => {
    const plan = buildProductionPlan({
      buildings,
      producerBuildingsByItemId: indexProducerBuildingsByItemId(buildings),
      targetId: itemId,
      targetIpm: 15,
      isRawTarget: false,
      rawItemIds: new Set(items.filter((item) => item.type === 'raw').map((item) => item.id)),
      supplyCountByItem: { T_LeavesIcon: 15 },
      recipeIdByItemId: { [itemId]: recipeId },
    })

    expect(plan.issues).toEqual([])
    expect(plan.steps).toEqual([
      expect.objectContaining({
        itemId,
        recipeOutputIpm: 30,
        targetIpm: 15,
        buildingLoad: 0.5,
        buildingCount: 1,
        recycledIpm: 15,
        inputs: [{ id: 'T_LeavesIcon', amount_per_minute: 30 }],
      }),
    ])
    expect(plan.stats.buildings).toBe(1)
  })

  it('reports actual biomass coproducts, without also treating them as a second production step or automatic external supply', () => {
    const factory: Building[] = [
      {
        id: 'growth',
        name: 'Growth',
        type: 'production',
        power: 4,
        recipes: [
          {
            id: 'protein',
            output: { id: 'protein', amount_per_minute: 15 },
            inputs: [{ id: 'ore', amount_per_minute: 15 }],
            extra_outputs: [{ id: 'biomass', amount_per_minute: 15 }],
          },
        ],
      },
    ]
    const plan = buildProductionPlan({
      buildings: factory,
      producerBuildingsByItemId: indexProducerBuildingsByItemId(factory),
      targetId: 'protein',
      targetIpm: 30,
      isRawTarget: false,
      rawItemIds: new Set(['ore']),
      supplyCountByItem: {},
    })

    expect(plan.issues).toEqual([])
    expect(plan.steps[0]).toMatchObject({
      itemId: 'protein',
      buildingCount: 2,
      extraOutputs: [{ id: 'biomass', amount_per_minute: 30 }],
    })
    expect(plan.steps.every((step) => step.itemId !== 'biomass')).toBe(true)
    expect(plan.supplyCountByItem).toEqual({})
    expect(plan.stats.buildings).toBe(2)
  })

  it('recognizes the game catalog biomass alias without changing the source JSON', () => {
    const recipe = buildings.find((building) => building.id === 'growth_chamber')?.recipes.find((entry) => entry.id === 'alpha_protein')
    expect(recipe?.extra_outputs).toEqual([{ id: 'T_LeavesIcon', amount_per_minute: 15 }])
  })

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid byproduct rates %s', (rate) => {
    const factory: Building[] = [
      {
        id: 'growth',
        name: 'Growth',
        type: 'production',
        power: 4,
        recipes: [
          {
            output: { id: 'protein', amount_per_minute: 15 },
            inputs: [],
            extra_outputs: [{ id: 'biomass', amount_per_minute: rate }],
          },
        ],
      },
    ]
    const plan = buildProductionPlan({
      buildings: factory,
      producerBuildingsByItemId: indexProducerBuildingsByItemId(factory),
      targetId: 'protein',
      targetIpm: 15,
      isRawTarget: false,
      supplyCountByItem: {},
    })
    expect(plan.issues[0]?.code).toBe('invalid-rate')
    expect(plan.steps).toEqual([])
  })
})
