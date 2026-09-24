import type { Building } from '@/shared/@types/building.type'
import { indexProducerBuildingsByItemId } from '@/shared/data'
import { describe, expect, it } from 'vitest'
import { buildProductionPlan } from './build-production-plan'
import { calculateTotals } from './calculate-totals'
import { buildPlanResolver } from './plan-resolver'

const buildings: Building[] = [
  {
    id: 'test-assembler',
    name: 'Assembler',
    type: 'production',
    power: 2,
    recipes: [{ output: { id: 'plate', amount_per_minute: 10 }, inputs: [{ id: 'ore', amount_per_minute: 10 }] }],
  },
]

describe('steady-state external delivery', () => {
  it('subtracts 7.5 ore/min from 10 ore/min demand without creating fictional production', () => {
    const resolver = buildPlanResolver(buildings, indexProducerBuildingsByItemId(buildings), {})
    const demand = calculateTotals(resolver, 'plate', 10, { ore: 7.5 }, new Set(['ore']))
    expect(demand.issues).toEqual([])
    expect(demand.totals.get('plate')).toBe(10)
    expect(demand.totals.get('ore')).toBe(2.5)

    const plan = buildProductionPlan({
      buildings,
      producerBuildingsByItemId: indexProducerBuildingsByItemId(buildings),
      targetId: 'plate',
      targetIpm: 10,
      isRawTarget: false,
      rawItemIds: new Set(['ore']),
      supplyCountByItem: { ore: 7.5 },
    })
    expect(plan.issues).toEqual([])
    expect(plan.supplyCountByItem).toEqual({ ore: 7.5 })
    expect(plan.supplyCountInventory).toEqual({ ore: 7.5 })
    expect(plan.steps.some((step) => step.itemId === 'ore' && step.buildingCount > 0)).toBe(false)
    expect(plan.stats.buildings).toBe(1)
  })

  it('does not reuse the same external delivery in multiple consuming branches', () => {
    const factory: Building[] = [
      {
        id: 'test-factory',
        name: 'Factory',
        type: 'production',
        power: 2,
        recipes: [
          {
            output: { id: 'final', amount_per_minute: 10 },
            inputs: [
              { id: 'a', amount_per_minute: 10 },
              { id: 'b', amount_per_minute: 10 },
            ],
          },
          { output: { id: 'a', amount_per_minute: 10 }, inputs: [{ id: 'ore', amount_per_minute: 10 }] },
          { output: { id: 'b', amount_per_minute: 10 }, inputs: [{ id: 'ore', amount_per_minute: 10 }] },
        ],
      },
    ]
    const demand = calculateTotals(
      buildPlanResolver(factory, indexProducerBuildingsByItemId(factory), {}),
      'final',
      10,
      { ore: 7.5 },
      new Set(['ore']),
    )
    expect(demand.issues).toEqual([])
    expect(demand.totals.get('ore')).toBe(12.5)
  })
})
