import type { Building } from '@/shared/@types/building.type'
import type { Item } from '@/shared/@types/item.type'
import { indexProducerBuildingsByItemId } from '@/shared/data'
import { planToFlow } from '@/features/planner/flow/plan-to-flow'
import { describe, expect, it } from 'vitest'
import { buildProductionPlan } from './build-production-plan'

/** Isolated recipes expose the balance directly without modifying the game catalog. */
const makeBuildings = (includeBiomassRecipe = false, proteinNeedsBiomass = false, twoConsumers = false): Building[] => [
  {
    id: 'assembler',
    name: 'Assembler',
    type: 'production',
    power: 2,
    recipes: [
      {
        id: 'final',
        output: { id: 'final', amount_per_minute: 10 },
        // Deliberately visit consumers before the source: credits must not depend on input order.
        inputs: [
          { id: 'widget', amount_per_minute: 10 },
          ...(twoConsumers ? [{ id: 'widget2', amount_per_minute: 10 }] : []),
          { id: 'protein', amount_per_minute: 10 },
        ],
      },
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    type: 'production',
    power: 4,
    recipes: [
      {
        id: 'protein',
        output: { id: 'protein', amount_per_minute: 10 },
        inputs: [{ id: 'ore', amount_per_minute: 10 }, ...(proteinNeedsBiomass ? [{ id: 'biomass', amount_per_minute: 5 }] : [])],
        extra_outputs: [{ id: 'biomass', amount_per_minute: 10 }],
      },
    ],
  },
  {
    id: 'widget-machine',
    name: 'Widget',
    type: 'production',
    power: 3,
    recipes: [
      { id: 'widget', output: { id: 'widget', amount_per_minute: 10 }, inputs: [{ id: 'biomass', amount_per_minute: 8 }] },
      ...(twoConsumers
        ? [
            {
              id: 'widget2',
              output: { id: 'widget2', amount_per_minute: 10 },
              inputs: [{ id: 'biomass', amount_per_minute: 8 }],
            },
          ]
        : []),
    ],
  },
  ...(includeBiomassRecipe
    ? [
        {
          id: 'biomass-factory',
          name: 'Biomass',
          type: 'production' as const,
          power: 1,
          recipes: [
            {
              id: 'biomass',
              output: { id: 'biomass', amount_per_minute: 10 },
              inputs: [{ id: 'ore', amount_per_minute: 10 }],
            },
          ],
        },
      ]
    : []),
]

const build = (buildings: Building[], supplyCountByItem: Record<string, number> = {}) =>
  buildProductionPlan({
    buildings,
    producerBuildingsByItemId: indexProducerBuildingsByItemId(buildings),
    targetId: 'final',
    targetIpm: 10,
    isRawTarget: false,
    rawItemIds: new Set(['ore']),
    supplyCountByItem,
  })

const items: Item[] = ['final', 'widget', 'widget2', 'protein', 'biomass', 'ore'].map((id) => ({
  id,
  name: id,
  type: id === 'ore' ? 'raw' : 'component',
}))

describe('bounded global coproduct allocation', () => {
  it('credits a verified sibling source even when the consumer appears first and its recipe is missing', () => {
    const buildings = makeBuildings()
    const plan = build(buildings)
    expect(plan.issues).toEqual([])
    expect(plan.steps.map((step) => step.itemId)).toEqual(['final', 'widget', 'protein'])
    expect(plan.rawInputs).toEqual([{ itemId: 'ore', amountPerMinute: 10 }])
    expect(plan.byproductAllocations).toEqual([
      { sourceItemId: 'protein', consumerItemId: 'widget', itemId: 'biomass', amountPerMinute: 8 },
    ])
    expect(plan.stats.buildings).toBe(3)
    expect(plan.supplyCountByItem).toEqual({})

    const graph = planToFlow({ plan, items })
    expect(graph.edges).toEqual(
      expect.arrayContaining([expect.objectContaining({ source: 'protein', target: 'widget', label: 'biomass · coproduct 8.0/m' })]),
    )
    expect(graph.edges.some((edge) => edge.source === 'biomass' && edge.target === 'widget')).toBe(false)
  })

  it('spends ten units once between two consumers and produces only the six-unit shortfall', () => {
    const plan = build(makeBuildings(true, false, true))
    expect(plan.issues).toEqual([])
    expect(plan.byproductAllocations?.reduce((total, credit) => total + credit.amountPerMinute, 0)).toBe(10)
    expect(plan.steps.find((step) => step.itemId === 'biomass')?.targetIpm).toBe(6)
    expect(plan.steps.find((step) => step.itemId === 'protein')?.extraOutputs).toEqual([{ id: 'biomass', amount_per_minute: 10 }])
    expect(plan.stats.buildings).toBe(5)
  })

  it('uses explicit external supply first, without counting it again as a coproduct', () => {
    const plan = build(makeBuildings(), { biomass: 3 })
    expect(plan.issues).toEqual([])
    expect(plan.byproductAllocations).toEqual([
      { sourceItemId: 'protein', consumerItemId: 'widget', itemId: 'biomass', amountPerMinute: 5 },
    ])
    expect(plan.supplyCountByItem).toEqual({ biomass: 3 })
  })

  it('never resolves a producer using its own generated input without external bootstrap', () => {
    const plan = build(makeBuildings(false, true))
    expect(plan.issues[0]).toMatchObject({ code: 'missing-recipe', itemId: 'biomass' })
    expect(plan.steps).toEqual([])
    expect(plan.byproductAllocations).toEqual([])
  })
})
