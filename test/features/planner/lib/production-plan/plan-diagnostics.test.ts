import type { Building } from '@/shared/@types/building.type'
import { indexProducerBuildingsByItemId } from '@/shared/data'
import { describe, expect, it } from 'vitest'
import { buildProductionPlan } from '@/features/planner/lib/production-plan/build-production-plan'

/** Regression fixtures isolate graph validation from missing or protected game-source data. */
const build = (
  recipes: Building['recipes'],
  options: { target?: string; rate?: number; supply?: Record<string, number>; raw?: string[] } = {},
) => {
  const buildings: Building[] = [{ id: 'test-machine', name: 'Test machine', type: 'production', power: 2, recipes }]
  return buildProductionPlan({
    buildings,
    producerBuildingsByItemId: indexProducerBuildingsByItemId(buildings),
    targetId: options.target ?? 'a',
    targetIpm: options.rate ?? 10,
    isRawTarget: false,
    rawItemIds: new Set(options.raw ?? []),
    supplyCountByItem: options.supply ?? {},
  })
}

const recipe = (id: string, output: number, inputs: { id: string; amount_per_minute: number }[] = []) => ({
  id,
  output: { id, amount_per_minute: output },
  inputs,
})

describe('production graph validation', () => {
  it('calculates positive self-recycling by its net output instead of recursing forever', () => {
    const plan = build([recipe('a', 10, [{ id: 'a', amount_per_minute: 2 }])])
    expect(plan.issues).toEqual([])
    expect(plan.steps).toEqual([
      expect.objectContaining({ itemId: 'a', recipeOutputIpm: 8, targetIpm: 10, buildingLoad: 1.25, recycledIpm: 2.5, inputs: [] }),
    ])
    expect(plan.stats.buildings).toBe(2)
  })

  it.each([10, 12])('rejects unproductive self-recycling with an input rate of %s', (rate) => {
    const plan = build([recipe('a', 10, [{ id: 'a', amount_per_minute: rate }])])
    expect(plan.issues[0]?.code).toBe('invalid-rate')
    expect(plan.steps).toEqual([])
  })

  it('reports the complete indirect cycle while permitting shared ingredients on separate branches', () => {
    const cyclic = build([
      recipe('a', 10, [{ id: 'b', amount_per_minute: 2 }]),
      recipe('b', 10, [{ id: 'c', amount_per_minute: 2 }]),
      recipe('c', 10, [{ id: 'a', amount_per_minute: 2 }]),
    ])
    expect(cyclic.issues[0]).toMatchObject({ code: 'cycle', path: ['a', 'b', 'c', 'a'] })

    const shared = build(
      [
        recipe('a', 10, [
          { id: 'b', amount_per_minute: 5 },
          { id: 'c', amount_per_minute: 5 },
        ]),
        recipe('b', 10, [{ id: 'ore', amount_per_minute: 10 }]),
        recipe('c', 10, [{ id: 'ore', amount_per_minute: 10 }]),
      ],
      { raw: ['ore'] },
    )
    expect(shared.issues).toEqual([])
    expect(shared.steps.map((step) => step.itemId)).toEqual(['a', 'b', 'c'])
  })

  it('keeps an ingredient without a recipe as an external input without inventing a machine', () => {
    const plan = build([recipe('a', 10, [{ id: 'missing', amount_per_minute: 5 }])])
    expect(plan.issues).toEqual([])
    expect(plan.steps).toEqual([expect.objectContaining({ itemId: 'a', buildingId: 'test-machine' })])
    expect(plan.rawInputs).toEqual([{ itemId: 'missing', amountPerMinute: 5 }])
    expect(plan.stats).toEqual({ buildings: 1, power: 2 })
  })

  it('permits catalog-confirmed raw inputs and missing ingredients fully covered by external supply', () => {
    const inputs = [recipe('a', 10, [{ id: 'ore', amount_per_minute: 5 }])]
    expect(build(inputs, { raw: ['ore'] }).issues).toEqual([])
    expect(build(inputs, { supply: { ore: 5 } }).issues).toEqual([])
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid target rate %s', (rate) => {
    const plan = build([recipe('a', 10)], { rate })
    expect(plan.issues[0]?.code).toBe('invalid-rate')
    expect(plan.steps).toEqual([])
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid recipe output rate %s', (rate) => {
    const plan = build([recipe('a', rate)])
    expect(plan.issues[0]?.code).toBe('invalid-rate')
    expect(plan.steps).toEqual([])
  })

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])('rejects invalid ingredient rate %s', (rate) => {
    const plan = build([recipe('a', 10, [{ id: 'ore', amount_per_minute: rate }])], { raw: ['ore'] })
    expect(plan.issues[0]?.code).toBe('invalid-rate')
    expect(plan.steps).toEqual([])
  })
})
