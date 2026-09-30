import type { Building } from '@/shared/@types/building.type'
import { indexProducerBuildingsByItemId } from '@/shared/data'
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
