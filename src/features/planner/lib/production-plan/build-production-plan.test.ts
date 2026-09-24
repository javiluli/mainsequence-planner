import type { Building } from '@/shared/@types/building.type'
import { indexProducerBuildingsByItemId } from '@/shared/data'
import { describe, expect, it } from 'vitest'
import { buildProductionPlan } from './build-production-plan'

const buildings = [
  {
    id: 'assembler',
    name: 'Assembler',
    power: 10,
    type: 'production',
    recipes: [
      {
        output: { id: 'plate', amount_per_minute: 5 },
        inputs: [{ id: 'ingot', amount_per_minute: 10 }],
      },
    ],
  },
  {
    id: 'assembler_v2',
    name: 'Assembler V2',
    power: 18,
    type: 'production',
    recipes: [
      {
        output: { id: 'plate', amount_per_minute: 10 },
        inputs: [{ id: 'ingot', amount_per_minute: 10 }],
      },
    ],
  },
  {
    id: 'smelter',
    name: 'Smelter',
    power: 5,
    type: 'production',
    recipes: [
      {
        output: { id: 'ingot', amount_per_minute: 10 },
        inputs: [{ id: 'ore', amount_per_minute: 20 }],
      },
    ],
  },
] satisfies Building[]

const buildPlan = ({
  targetId = 'plate',
  targetIpm = 10,
  isRawTarget = false,
  supplyCountByItem = {},
}: {
  targetId?: string
  targetIpm?: number
  isRawTarget?: boolean
  supplyCountByItem?: Record<string, number>
} = {}) =>
  buildProductionPlan({
    buildings,
    producerBuildingsByItemId: indexProducerBuildingsByItemId(buildings),
    targetId,
    targetIpm,
    isRawTarget,
    rawItemIds: new Set(['ore']),
    supplyCountByItem,
  })

describe('buildProductionPlan', () => {
  it('builds recursive production steps and global stats', () => {
    const plan = buildPlan()

    expect(plan.steps).toEqual([
      expect.objectContaining({ itemId: 'plate', targetIpm: 10, buildingCount: 2, buildingId: 'assembler' }),
      expect.objectContaining({ itemId: 'ingot', targetIpm: 20, buildingCount: 2, buildingId: 'smelter' }),
    ])
    expect(plan.stats).toEqual({ buildings: 4, power: 30 })
  })

  it('uses partial supply before propagating the remaining demand', () => {
    const plan = buildPlan({ supplyCountByItem: { ingot: 5 } })
    const ingotStep = plan.steps.find((step) => step.itemId === 'ingot')

    expect(ingotStep).toEqual(expect.objectContaining({ targetIpm: 15, buildingLoad: 1.5, buildingCount: 2, supplyCount: 5 }))
  })

  it('removes invalid supply before exposing the production plan', () => {
    const plan = buildPlan({
      supplyCountByItem: {
        ingot: 5,
        zero: 0,
        negative: -1,
        notANumber: Number.NaN,
        infinite: Number.POSITIVE_INFINITY,
      },
    })

    expect(plan.supplyCountByItem).toEqual({ ingot: 5 })
    expect(plan.supplyCountInventory).toEqual({ ingot: 5 })
  })

  it('removes a production branch when supply covers its complete demand', () => {
    const plan = buildPlan({ supplyCountByItem: { ingot: 20 } })

    expect(plan.steps.map((step) => step.itemId)).toEqual(['plate'])
    expect(plan.stats).toEqual({ buildings: 2, power: 20 })
  })

  it('returns a terminal plan for a raw target without inventing a recipe or building', () => {
    const plan = buildPlan({ targetId: 'ore', targetIpm: 20, isRawTarget: true })

    expect(plan).toMatchObject({
      targetId: 'ore',
      targetIpm: 20,
      isRawTarget: true,
      steps: [],
      rawInputs: [{ itemId: 'ore', amountPerMinute: 20 }],
      stats: { buildings: 0, power: 0 },
    })
  })

  it('keeps total power unknown when a required machine has no verified power', () => {
    const unknownPowerBuildings: Building[] = [
      {
        id: 'unknown-power-machine',
        name: 'Unknown power machine',
        type: 'production',
        recipes: [{ output: { id: 'plate', amount_per_minute: 10 }, inputs: [] }],
      },
    ]

    const plan = buildProductionPlan({
      buildings: unknownPowerBuildings,
      producerBuildingsByItemId: indexProducerBuildingsByItemId(unknownPowerBuildings),
      targetId: 'plate',
      targetIpm: 10,
      isRawTarget: false,
      rawItemIds: new Set(),
      supplyCountByItem: {},
    })

    expect(plan.issues).toEqual([])
    expect(plan.steps[0]?.buildingPower).toBeUndefined()
    expect(plan.stats).toEqual({ buildings: 1, power: null })
  })
})
