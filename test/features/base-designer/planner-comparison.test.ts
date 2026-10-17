import { describe, expect, it } from 'vitest'
import type { ProductionPlan } from '@/features/planner'
import { buildProductionPlan } from '@/features/planner/lib/production-plan'
import { compareWithPlanner } from '@/features/base-designer/lib/planner-comparison'
import { canPlaceScenePieces } from '@/features/base-designer/lib/placement'
import type { Building } from '@/features/base-designer/model/buildings'
import type { Scene } from '@/features/base-designer/model/scene'
import { buildings, externallyAcquiredItemIds, itemById, items, producerBuildingsByItemId } from '@/shared/data'

const rawItemIds = new Set(items.filter((item) => item.type === 'raw').map((item) => item.id))

/** Calculate real catalog routes without depending on Planner's UI or editable store. */
function catalogPlan(
  targetId: string,
  targetIpm: number,
  options: Partial<Pick<Parameters<typeof buildProductionPlan>[0], 'recipeIdByItemId' | 'supplyCountByItem'>> = {},
): ProductionPlan {
  return buildProductionPlan({
    buildings,
    producerBuildingsByItemId,
    targetId,
    targetIpm,
    isRawTarget: itemById.get(targetId)?.type === 'raw',
    rawItemIds,
    externalItemIds: externallyAcquiredItemIds,
    supplyCountByItem: {},
    ...options,
  })
}

/** Each machine owns a valid, separate floor without ingredient connections. */
function sceneWithBuildings(assignments: readonly Pick<Building, 'type' | 'recipeId'>[]): Scene {
  return {
    stations: assignments.map((_, index) => ({ id: 'floor-' + index, x: index * 16, y: 0 })),
    buildings: assignments.map((assignment, index) => ({
      ...assignment,
      id: 'machine-' + index,
      stationId: 'floor-' + index,
      x: index * 16 + 1,
      y: 1,
      rotation: 0,
    })),
    belts: [],
  }
}

describe('Bases comparison with Planner', () => {
  it('does not present requirements without a plan or with invalid plan rates', () => {
    const scene = sceneWithBuildings([{ type: 'refinery', recipeId: 'cobalt_plates' }])
    const invalidPlan = catalogPlan('T_CobaltPlates', 0)

    expect(invalidPlan.issues).toEqual([expect.objectContaining({ code: 'invalid-rate' })])
    expect(compareWithPlanner(scene, null)).toBeNull()
    expect(compareWithPlanner(scene, undefined)).toBeNull()
    expect(compareWithPlanner(scene, invalidPlan)).toBeNull()
  })

  it('groups rounded requirements by Crafter and counts unassigned machines while retaining absent supported types', () => {
    const plan = catalogPlan('T_Servomotor', 15, {
      recipeIdByItemId: { T_TitaniumOre: 'titanium_synthesis' },
      supplyCountByItem: { T_Protomatter: 60 },
    })
    const scene = sceneWithBuildings([
      { type: 'assembler', recipeId: 'servomotor' },
      { type: 'assembler' },
      { type: 'refinery', recipeId: 'titanium_plates' },
      { type: 'refinery' },
      { type: 'reactor' },
      { type: 'material_lab' },
      { type: 'computation_lab' },
      { type: 'container' },
    ])
    expect(plan.issues).toEqual([])
    expect(canPlaceScenePieces(scene)).toBe(true)

    const comparison = compareWithPlanner(scene, plan)
    expect(comparison?.buildings).toEqual([
      { id: 'fabricator', name: 'Assembler', needed: 4, placed: 2, supported: true },
      { id: 'refinery', name: 'Refinery', needed: 5, placed: 2, supported: true },
      { id: 'enrichment', name: 'Enrichment Chamber', needed: 1, placed: 0, supported: true },
    ])
    expect(comparison?.products).toEqual(
      expect.arrayContaining([
        { itemId: 'T_Servomotor', needed: 15, capacity: 15, coproductCredit: 0 },
        { itemId: 'T_TitaniumPlates1', needed: 60, capacity: 20, coproductCredit: 0 },
        { itemId: 'T_TitaniumOre', needed: 60, capacity: 0, coproductCredit: 0 },
      ]),
    )
  })

  it('adds nominal capacities from exact recipe variants independently of geometry, ingredient delivery and configured supply', () => {
    const plan = catalogPlan('T_CobaltPlates', 35, {
      supplyCountByItem: { T_CobaltPlates: 5, T_CobaltOre: 10, T_TitaniumOre: 0 },
    })
    const scene = sceneWithBuildings([
      { type: 'refinery', recipeId: 'cobalt_plates' },
      { type: 'refinery', recipeId: 'enriched_cobalt_plates' },
      { type: 'refinery' },
    ])
    const moved: Scene = {
      ...scene,
      stations: scene.stations.map((station) => ({ ...station, x: station.x + 120, y: station.y - 40 })),
      buildings: scene.buildings.map((building) => ({
        ...building,
        x: building.x + 120,
        y: building.y - 40,
        rotation: 90,
        disabledOutputs: ['0:1', '1:1', '2:1', '3:1'],
      })),
    }
    expect(plan.issues).toEqual([])
    expect(canPlaceScenePieces(scene)).toBe(true)
    expect(canPlaceScenePieces(moved)).toBe(true)

    const before = structuredClone(plan)
    const comparison = compareWithPlanner(scene, plan)
    expect(comparison?.buildings).toEqual([{ id: 'refinery', name: 'Refinery', needed: 2, placed: 3, supported: true }])
    expect(comparison?.products).toEqual([{ itemId: 'T_CobaltPlates', needed: 30, capacity: 50, coproductCredit: 0 }])
    expect(comparison?.externalInputs).toEqual([{ itemId: 'T_CobaltOre', amountPerMinute: 20 }])
    expect(comparison?.supplied).toEqual([
      ['T_CobaltPlates', 5],
      ['T_CobaltOre', 10],
    ])
    expect(comparison?.coproducts).toEqual([])
    expect(compareWithPlanner(moved, plan)).toEqual(comparison)
    expect(plan).toEqual(before)
  })

  it('keeps recycled demand net and credits each assigned coproduct once, separately from external inputs and supply', () => {
    const plan = catalogPlan('T_AlphaProtein', 15, { supplyCountByItem: { T_Nutrients: 60 } })
    const scene = sceneWithBuildings([{ type: 'material_lab' }, { type: 'computation_lab' }, { type: 'reactor' }])
    expect(plan.issues).toEqual([])
    expect(canPlaceScenePieces(scene)).toBe(true)
    expect(plan.steps).toContainEqual(
      expect.objectContaining({ itemId: 'T_Xenoeukarya', recipeOutputIpm: 30, targetIpm: 15, recycledIpm: 15 }),
    )

    const comparison = compareWithPlanner(scene, plan)
    // Growth Chamber owns the catalog's recycling/coproduct recipes and has no placeable counterpart in Bases.
    expect(comparison?.buildings).toEqual([{ id: 'growth_chamber', name: 'Growth Chamber', needed: 4, placed: 0, supported: false }])
    expect(comparison?.products).toHaveLength(5)
    expect(comparison?.products).toEqual(
      expect.arrayContaining([
        { itemId: 'T_AlphaProtein', needed: 15, capacity: 0, coproductCredit: 0 },
        { itemId: 'T_Xenoeukarya', needed: 15, capacity: 0, coproductCredit: 0 },
        { itemId: 'T_Enzyme', needed: 15, capacity: 0, coproductCredit: 0 },
        { itemId: 'T_Xenobacteria', needed: 15, capacity: 0, coproductCredit: 0 },
        { itemId: 'T_LeavesIcon', needed: 15, capacity: 0, coproductCredit: 15 },
      ]),
    )
    expect(comparison?.coproducts).toEqual([
      { sourceItemId: 'T_Enzyme', consumerItemId: 'T_Xenoeukarya', itemId: 'T_LeavesIcon', amountPerMinute: 15 },
    ])
    expect(comparison?.externalInputs).toEqual([{ itemId: 'T_LeavesIcon', amountPerMinute: 15 }])
    expect(comparison?.supplied).toEqual([['T_Nutrients', 60]])
  })
})
