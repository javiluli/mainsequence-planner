import { describe, expect, it } from 'vitest'
import type { Building } from '@/shared/@types/building.type'
import { buildings, externallyAcquiredItemIds, indexProducerBuildingsByItemId, items, producerBuildingsByItemId } from '@/shared/data'
import { buildBuildingConstructionCostSummary } from '@/features/planner/lib/building-construction-cost'
import { buildProductionPlan } from '@/features/planner/lib/production-plan/build-production-plan'
import { summarizeRequiredBuildings } from '@/features/planner/lib/production-plan/required-buildings'
import type { ProductionStep } from '@/features/planner/lib/production-plan/types'

const step = (overrides: Partial<ProductionStep> = {}): ProductionStep => ({
  itemId: 'part',
  buildingId: 'machine',
  buildingName: 'Machine',
  recipeOutputIpm: 10,
  targetIpm: 4,
  buildingLoad: 0.4,
  buildingCount: 1,
  supplyCount: 0,
  inputs: [],
  ...overrides,
})

describe('physical building construction costs', () => {
  it('adds rounded machines for simultaneous recipes and shares material totals without mutating the plan', () => {
    const catalog: Building[] = [
      {
        id: 'machine',
        name: 'Machine',
        type: 'production',
        power: 3,
        construction_cost: [{ id: 'frame', amount: 2 }],
        recipes: [
          { output: { id: 'final', amount_per_minute: 10 }, inputs: [{ id: 'part', amount_per_minute: 10 }] },
          { output: { id: 'part', amount_per_minute: 10 }, inputs: [] },
        ],
      },
    ]
    const plan = buildProductionPlan({
      buildings: catalog,
      producerBuildingsByItemId: indexProducerBuildingsByItemId(catalog),
      targetId: 'final',
      targetIpm: 4,
      isRawTarget: false,
      supplyCountByItem: {},
    })
    expect(plan.stats).toEqual({ buildings: 2, power: 6 })
    const original = structuredClone(plan.steps)
    const steps = [...plan.steps, step({ buildingId: 'other', buildingCount: 3, buildingConstructionCost: [{ id: 'frame', amount: 5 }] })]
    expect(summarizeRequiredBuildings(plan.steps)[0].buildingCount).toBe(2)
    const summary = buildBuildingConstructionCostSummary(steps)
    expect(summary?.rows.map((row) => row.buildingCount)).toEqual([2, 3])
    expect(summary?.materials).toEqual([{ itemId: 'frame', totalAmount: 19 }])
    expect(plan.steps).toEqual(original)
  })

  it('keeps unknown costs separate from explicitly free construction and never invents costs for an empty plan', () => {
    const summary = buildBuildingConstructionCostSummary([
      step({ buildingId: 'free', buildingConstructionCost: [] }),
      step({ buildingId: 'unknown' }),
    ])
    expect(summary?.rows).toMatchObject([
      { buildingId: 'unknown', hasCostData: false, materials: [] },
      { buildingId: 'free', hasCostData: true, materials: [] },
    ])
    expect(summary?.hasUnknownCosts).toBe(true)
    expect(summary?.materials).toEqual([])
    expect(buildBuildingConstructionCostSummary([])).toBeNull()
    expect(buildBuildingConstructionCostSummary()).toBeNull()
  })

  it('calculates the catalog Servomotor bill and removes it when external supply covers the whole target', () => {
    const params = {
      buildings,
      producerBuildingsByItemId,
      targetId: 'T_Servomotor',
      targetIpm: 60,
      isRawTarget: false,
      rawItemIds: new Set(items.filter((item) => item.type === 'raw').map((item) => item.id)),
      externalItemIds: externallyAcquiredItemIds,
      supplyCountByItem: {},
    }
    const plan = buildProductionPlan(params)
    expect(plan.issues).toEqual([])
    const summary = buildBuildingConstructionCostSummary(plan.steps)
    expect(summary?.hasUnknownCosts).toBe(false)
    expect(summary?.rows.map((row) => [row.buildingId, row.buildingCount])).toEqual([
      ['fabricator', 14],
      ['refinery', 18],
    ])
    expect(Object.fromEntries(summary!.materials.map((material) => [material.itemId, material.totalAmount]))).toEqual({
      T_LightweightFrame1: 106,
      T_Capacitor1: 42,
      T_MagneticCoil1: 90,
    })
    const supplied = buildProductionPlan({ ...params, supplyCountByItem: { T_Servomotor: 60 } })
    expect(supplied.issues).toEqual([])
    expect(buildBuildingConstructionCostSummary(supplied.steps)).toBeNull()
  })
})
