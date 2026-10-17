import type { Building } from '@/shared/@types/building.type'
import { describe, expect, it } from 'vitest'
import { buildProductionPlan, type ProductionPlan } from '@/features/planner/lib/production-plan'
import { buildProductionConnections } from '@/features/planner/lib/production-plan/production-connections'
import { buildTree } from '@/features/planner/ui/treelist-diagram/lib/tree-build'
import type { TreeNodeData } from '@/features/planner/ui/treelist-diagram/types'
import { buildings, externallyAcquiredItemIds, indexProducerBuildingsByItemId, items, producerBuildingsByItemId } from '@/shared/data'

/** Small real-plan fixtures make branch attribution observable independently of catalog complexity. */
const buildFixturePlan = (recipes: Building['recipes'], supplyCountByItem: Record<string, number> = {}) => {
  const machines: Building[] = recipes.map((recipe) => ({
    id: `${recipe.output.id}-building`,
    name: `${recipe.output.id} building`,
    type: 'production',
    power: 5,
    recipes: [recipe],
  }))
  return buildProductionPlan({
    buildings: machines,
    producerBuildingsByItemId: indexProducerBuildingsByItemId(machines),
    targetId: 'plate',
    targetIpm: 10,
    isRawTarget: false,
    supplyCountByItem,
  })
}

const buildCatalogPlan = (targetId: string, options: Partial<Parameters<typeof buildProductionPlan>[0]> = {}) =>
  buildProductionPlan({
    buildings,
    producerBuildingsByItemId,
    targetId,
    targetIpm: 60,
    isRawTarget: false,
    rawItemIds: new Set(items.filter((item) => item.type === 'raw').map((item) => item.id)),
    externalItemIds: externallyAcquiredItemIds,
    supplyCountByItem: {},
    ...options,
  })

/** Collect every displayed branch without treating the final-product wrapper as a machine. */
const flattenTree = (node: TreeNodeData | null): TreeNodeData[] => (node ? [node, ...(node.children ?? []).flatMap(flattenTree)] : [])

/** Compare external leaves to the confirmed result, including missing standalone recipes. */
const expectExternalRates = (plan: ProductionPlan, tree: TreeNodeData | null) => {
  const totals = new Map<string, number>()
  for (const node of flattenTree(tree)) {
    if (node.isRawMaterial) totals.set(node.itemId, (totals.get(node.itemId) ?? 0) + (node.targetIpm ?? 0))
  }
  expect([...totals.keys()].sort()).toEqual(plan.rawInputs.map((input) => input.itemId).sort())
  for (const input of plan.rawInputs) expect(totals.get(input.itemId)).toBeCloseTo(input.amountPerMinute, 6)
}

/** Aggregated tree edges must retain the same quantities, consumers and origins as the graph. */
const expectConnectionRates = (plan: ProductionPlan, tree: TreeNodeData | null) => {
  const actual = new Map<string, number>()
  for (const node of flattenTree(tree)) {
    if (node.isFinalProduct) continue
    for (const child of node.children ?? []) {
      const kind = child.isSupply ? 'supply' : child.coproductSourceItemId ? 'coproduct' : 'production'
      const source = child.isSupply ? `supply-${child.itemId}` : (child.coproductSourceItemId ?? child.itemId)
      const key = `${kind}:${source}:${node.itemId}:${child.itemId}`
      actual.set(key, (actual.get(key) ?? 0) + (child.targetIpm ?? 0))
    }
  }
  const expected = new Map<string, number>()
  for (const connection of buildProductionConnections(plan.steps, plan.supplyCountInventory, plan.byproductAllocations)) {
    const key = `${connection.kind}:${connection.source}:${connection.target}:${connection.itemId}`
    expected.set(key, (expected.get(key) ?? 0) + connection.amountPerMinute)
  }
  expect([...actual.keys()].sort()).toEqual([...expected.keys()].sort())
  for (const [key, amount] of expected) expect(actual.get(key), key).toBeCloseTo(amount, 6)
}

describe('buildTree', () => {
  it('builds the production hierarchy and keeps missing recipes as external terminals', () => {
    const plan = buildFixturePlan([
      {
        output: { id: 'plate', amount_per_minute: 10 },
        inputs: [
          { id: 'ingot', amount_per_minute: 10 },
          { id: 'resin', amount_per_minute: 5 },
        ],
      },
      { output: { id: 'ingot', amount_per_minute: 10 }, inputs: [{ id: 'ore', amount_per_minute: 20 }] },
    ])
    const tree = buildTree(plan)
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
    expectExternalRates(plan, tree)
  })

  it('consumes shared supply once and builds only the uncovered remainder', () => {
    const plan = buildFixturePlan(
      [
        {
          output: { id: 'plate', amount_per_minute: 10 },
          inputs: [
            { id: 'ingot', amount_per_minute: 10 },
            { id: 'wire', amount_per_minute: 10 },
          ],
        },
        { output: { id: 'ingot', amount_per_minute: 10 }, inputs: [{ id: 'ore', amount_per_minute: 10 }] },
        { output: { id: 'wire', amount_per_minute: 10 }, inputs: [{ id: 'ore', amount_per_minute: 10 }] },
      ],
      { ore: 15 },
    )
    const tree = buildTree(plan)
    const productionRoot = tree?.children?.[0]
    const ingot = productionRoot?.children?.find((node) => node.itemId === 'ingot')
    const wire = productionRoot?.children?.find((node) => node.itemId === 'wire')
    expect(ingot?.children).toEqual([expect.objectContaining({ itemId: 'ore', targetIpm: 10, supplyCount: 10, isSupply: true })])
    expect(wire?.children).toEqual([
      expect.objectContaining({ itemId: 'ore', targetIpm: 5, supplyCount: 5, isSupply: true }),
      expect.objectContaining({ itemId: 'ore', targetIpm: 5, isRawMaterial: true }),
    ])
    expectExternalRates(plan, tree)
    expectConnectionRates(plan, tree)
  })

  it('shares supply and coproducts between repeated consumer branches without duplicating their producer', () => {
    const plan = buildFixturePlan(
      [
        {
          output: { id: 'plate', amount_per_minute: 10 },
          inputs: [
            { id: 'left', amount_per_minute: 10 },
            { id: 'right', amount_per_minute: 10 },
            { id: 'protein', amount_per_minute: 10 },
          ],
        },
        { output: { id: 'left', amount_per_minute: 10 }, inputs: [{ id: 'ingot', amount_per_minute: 10 }] },
        { output: { id: 'right', amount_per_minute: 10 }, inputs: [{ id: 'ingot', amount_per_minute: 10 }] },
        { output: { id: 'ingot', amount_per_minute: 30 }, inputs: [{ id: 'biomass', amount_per_minute: 24 }] },
        {
          output: { id: 'protein', amount_per_minute: 10 },
          inputs: [{ id: 'ore', amount_per_minute: 10 }],
          extra_outputs: [{ id: 'biomass', amount_per_minute: 10 }],
        },
      ],
      { biomass: 3 },
    )
    expect(plan.byproductAllocations?.reduce((total, allocation) => total + allocation.amountPerMinute, 0)).toBe(10)
    const tree = buildTree(plan)
    expectExternalRates(plan, tree)
    expectConnectionRates(plan, tree)
    const nodes = flattenTree(tree)
    expect(nodes.filter((node) => node.coproductSourceItemId)).toEqual([
      expect.objectContaining({ itemId: 'biomass', targetIpm: 5, coproductSourceItemId: 'protein', children: [] }),
      expect.objectContaining({ itemId: 'biomass', targetIpm: 5, coproductSourceItemId: 'protein', children: [] }),
    ])
    expect(nodes.filter((node) => node.itemId === 'protein' && node.buildingId)).toHaveLength(1)
    expect(nodes.filter((node) => node.itemId === 'ingot').reduce((total, node) => total + (node.buildingCount ?? 0), 0)).toBe(2)
    expect(plan.steps.find((step) => step.itemId === 'ingot')?.buildingCount).toBe(1)
  })

  it('keeps partial target supply separate from its uncovered production branch', () => {
    const plan = buildCatalogPlan('T_AlphaProtein', { supplyCountByItem: { T_AlphaProtein: 15 } })
    const tree = buildTree(plan)
    expect(tree).toMatchObject({
      targetIpm: 60,
      children: [
        expect.objectContaining({ itemId: 'T_AlphaProtein', targetIpm: 15, isSupply: true }),
        expect.objectContaining({ itemId: 'T_AlphaProtein', targetIpm: 45, buildingId: 'growth_chamber' }),
      ],
    })
    expectExternalRates(plan, tree)
    expectConnectionRates(plan, tree)
  })

  it('keeps raw and external-only plans without production steps', () => {
    for (const targetId of ['T_NickelOre', 'T_StellarSurveyData']) {
      const plan = buildCatalogPlan(targetId, { isRawTarget: targetId === 'T_NickelOre' })
      expect(plan.steps).toEqual([])
      expect(buildTree(plan)).toBeNull()
    }
    expect(buildTree(buildCatalogPlan('T_AlphaProtein', { supplyCountByItem: { T_AlphaProtein: 60 } }))).toBeNull()
    expect(buildTree(buildCatalogPlan('T_AlphaProtein', { targetIpm: Number.NaN }))).toBeNull()
  })
})

describe('confirmed catalog demand in Tree list (F01)', () => {
  it.each([
    ['T_AlphaProtein', 60],
    ['T_Biolattice', 240],
    ['T_Exosuit', 436800],
  ])('preserves the confirmed external Biomass rate for %s at 60/min', (targetId, biomassIpm) => {
    const plan = buildCatalogPlan(targetId)
    expect(plan.issues).toEqual([])
    expect(plan.rawInputs).toContainEqual({ itemId: 'T_LeavesIcon', amountPerMinute: biomassIpm })
    const tree = buildTree(plan)
    expectExternalRates(plan, tree)
    expectConnectionRates(plan, tree)
  })

  it.each<{ targetId: string; options: Partial<Parameters<typeof buildProductionPlan>[0]> }>([
    { targetId: 'T_AlphaProtein', options: { supplyCountByItem: { T_LeavesIcon: 20, T_Enzyme: 5 } } },
    { targetId: 'T_Exosuit', options: { supplyCountByItem: { T_LeavesIcon: 100, T_AlphaProtein: 5, T_CobaltOre: 30 } } },
    { targetId: 'T_NickelPlates1', options: {} },
    { targetId: 'T_NickelPlates1', options: { recipeIdByItemId: { T_NickelOre: 'nickel_synthesis' } } },
    { targetId: 'T_Xenoarchaea', options: { recipeIdByItemId: { T_Xenoarchaea: 'xenoarchaea_recycling' } } },
  ])('conserves external demand with supply, synthesis or recycling for $targetId', ({ targetId, options }) => {
    const plan = buildCatalogPlan(targetId, options)
    expect(plan.issues).toEqual([])
    const tree = buildTree(plan)
    expectExternalRates(plan, tree)
    expectConnectionRates(plan, tree)
  })

  it('does not consume plan budgets or change graph connections when deriving the tree repeatedly', () => {
    const plan = buildCatalogPlan('T_AlphaProtein', { supplyCountByItem: { T_LeavesIcon: 20, T_Enzyme: 5 } })
    const snapshot = structuredClone(plan)
    const connections = buildProductionConnections(plan.steps, plan.supplyCountInventory, plan.byproductAllocations)
    expect(buildTree(plan)).toEqual(buildTree(plan))
    expect(plan).toEqual(snapshot)
    expect(buildProductionConnections(plan.steps, plan.supplyCountInventory, plan.byproductAllocations)).toEqual(connections)
  })
})
