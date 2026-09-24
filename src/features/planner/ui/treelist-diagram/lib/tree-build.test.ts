import type { ProductionStep } from '@/features/planner/lib/production-plan'
import { describe, expect, it } from 'vitest'
import { buildTree } from './tree-build'

const createStep = (
  itemId: string,
  inputs: ProductionStep['inputs'],
  overrides: Partial<Omit<ProductionStep, 'itemId' | 'inputs'>> = {},
): ProductionStep => ({
  buildingId: `${itemId}-building`,
  buildingName: `${itemId} building`,
  recipeOutputIpm: 10,
  targetIpm: 10,
  buildingLoad: 1,
  buildingCount: 1,
  buildingPower: 5,
  supplyCount: 0,
  ...overrides,
  itemId,
  inputs,
})

const indexSteps = (steps: readonly ProductionStep[]) => new Map(steps.map((step) => [step.itemId, step]))

describe('buildTree', () => {
  it('builds the production hierarchy and keeps missing recipes as raw terminals', () => {
    const steps = indexSteps([
      createStep('plate', [
        { id: 'ingot', amount_per_minute: 10 },
        { id: 'resin', amount_per_minute: 5 },
      ]),
      createStep('ingot', [{ id: 'ore', amount_per_minute: 20 }]),
    ])

    const tree = buildTree(steps, 'plate', true, 10, new Map())

    expect(tree).toMatchObject({ itemId: 'plate', targetIpm: 10, isFinalProduct: true })
    expect(tree?.children).toEqual([
      expect.objectContaining({
        itemId: 'plate',
        buildingName: 'plate building',
        children: [
          expect.objectContaining({
            itemId: 'ingot',
            buildingName: 'ingot building',
            children: [expect.objectContaining({ itemId: 'ore', targetIpm: 20, isRawMaterial: true })],
          }),
          expect.objectContaining({ itemId: 'resin', targetIpm: 5, isRawMaterial: true }),
        ],
      }),
    ])
  })

  it('consumes shared supply once and builds only the uncovered remainder', () => {
    const steps = indexSteps([
      createStep('plate', [
        { id: 'ingot', amount_per_minute: 10 },
        { id: 'wire', amount_per_minute: 10 },
      ]),
      createStep('ingot', [{ id: 'ore', amount_per_minute: 10 }]),
      createStep('wire', [{ id: 'ore', amount_per_minute: 10 }]),
    ])

    const tree = buildTree(steps, 'plate', true, 10, new Map([['ore', 15]]))
    const productionRoot = tree?.children?.[0]
    const ingot = productionRoot?.children?.find((node) => node.itemId === 'ingot')
    const wire = productionRoot?.children?.find((node) => node.itemId === 'wire')

    expect(ingot?.children).toEqual([expect.objectContaining({ itemId: 'ore', targetIpm: 10, supplyCount: 10, isSupply: true })])
    expect(wire?.children).toEqual([
      expect.objectContaining({ itemId: 'ore', targetIpm: 5, supplyCount: 5, isSupply: true }),
      expect.objectContaining({ itemId: 'ore', targetIpm: 5, isRawMaterial: true }),
    ])
  })
})
