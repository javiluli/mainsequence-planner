import { describe, expect, it } from 'vitest'
import {
  baseBuildingRows,
  baseProductRows,
  countBaseBuildings,
  summarizePlanComparison,
} from '@/features/base-designer/lib/products/plan-comparison'
import { placeableForBuilding } from '@/features/base-designer/lib/products/catalog-machines'
import type { BaseStation } from '@/features/base-designer/lib/layout/placement'
import { planToFlow } from '@/features/planner/flow/plan-to-flow'
import { getPlanProductionStages } from '@/features/planner/lib/production-plan/production-stages'
import { buildProductionPlan } from '@/features/planner/lib/production-plan'
import type { BuildProductionPlanParams } from '@/features/planner/lib/production-plan/types'
import { buildBuildingConstructionCostSummary } from '@/features/planner/lib/building-construction-cost'
import { buildings, items, producerBuildingsByItemId } from '@/shared/data'

const stations: BaseStation[] = [
  {
    id: 'a',
    name: 'A',
    type: 'station_1x1',
    position: { x: 0, y: 0 },
    lockedTo: [],
    placements: [
      { id: 'r1', type: 'refinery', x: 1, y: 1, direction: 'east' },
      { id: 'r2', type: 'refinery', x: 12, y: 5, direction: 'east' },
      { id: 'reactor', type: 'reactor', x: 1, y: 7, direction: 'east' },
      { id: 'belt', type: 'conveyor', x: 9, y: 1, direction: 'east', routeId: 'route' },
      { id: 'splitter', type: 'splitter', x: 10, y: 1, direction: 'east' },
    ],
  },
]

function plan(
  targetId = 'T_CobaltPlates',
  targetIpm = 60,
  inputs: Partial<Pick<BuildProductionPlanParams, 'supplyCountByItem' | 'recipeIdByItemId'>> = {},
) {
  return buildProductionPlan({
    buildings,
    producerBuildingsByItemId,
    targetId,
    targetIpm,
    isRawTarget: false,
    rawItemIds: new Set(items.filter((item) => item.type === 'raw').map((item) => item.id)),
    supplyCountByItem: {},
    ...inputs,
  })
}

describe('simple base building summary', () => {
  it('counts machines once, including spanning footprints, and excludes logistics', () => {
    expect([...countBaseBuildings(stations)]).toEqual([
      ['refinery', 2],
      ['reactor', 1],
    ])
    expect(baseBuildingRows(stations)).toEqual([
      { id: 'reactor', name: 'Reactor', placed: 1, required: null },
      { id: 'refinery', name: 'Refinery', placed: 2, required: null },
    ])
    expect(baseBuildingRows([])).toEqual([])
  })

  it('compares building types against the existing plan without recipe or belt coverage', () => {
    const reference = plan()
    expect(reference.issues).toEqual([])
    expect(summarizePlanComparison(plan('T_Servomotor', 60), []).machines).toEqual([
      { buildingId: 'fabricator', name: 'Assembler', placed: 0, required: 14 },
      { buildingId: 'refinery', name: 'Refinery', placed: 0, required: 18 },
    ])
    expect(summarizePlanComparison(reference, stations).machines).toEqual([
      { buildingId: 'refinery', name: 'Refinery', placed: 2, required: 3 },
    ])
    expect(baseBuildingRows(stations, reference)).toEqual([
      { id: 'refinery', name: 'Refinery', placed: 2, required: 3 },
      { id: 'reactor', name: 'Reactor', placed: 1, required: 0 },
    ])
  })

  it('does not claim zero requirements when the reference is invalid', () => {
    const invalid = plan('T_CobaltPlates', -1)
    expect(invalid.issues.length).toBeGreaterThan(0)
    expect(baseBuildingRows(stations, invalid).every((row) => row.required === null)).toBe(true)
  })

  it('keeps unavailable catalog buildings explicit instead of pretending they are buildable', () => {
    const reference = plan('T_AlphaProtein', 15)
    expect(reference.issues).toEqual([])
    const unavailable = baseBuildingRows([], reference).filter((row) => row.placed === null)
    expect(unavailable.length).toBeGreaterThan(0)
    expect(unavailable.every((row) => row.required !== null && row.required > 0)).toBe(true)
  })
})

describe('Planner → construction costs → Bases', () => {
  it.each<{ name: string; target: string; supply: Record<string, number>; recipes: Record<string, string> }>([
    { name: 'multiple simultaneous recipes in the same building', target: 'T_Servomotor', supply: {}, recipes: {} },
    { name: 'partial external target supply', target: 'T_Servomotor', supply: { T_Servomotor: 30 }, recipes: {} },
    { name: 'complete external target supply', target: 'T_Servomotor', supply: { T_Servomotor: 60 }, recipes: {} },
    {
      name: 'alternative recipe with an extra production stage',
      target: 'T_CobaltPlates',
      supply: {},
      recipes: { T_CobaltPlates: 'enriched_cobalt_plates' },
    },
  ])('keeps physical counts consistent with $name', ({ target, supply, recipes }) => {
    const reference = plan(target, 60, { supplyCountByItem: supply, recipeIdByItemId: recipes })
    expect(reference.issues).toEqual([])
    const bill = buildBuildingConstructionCostSummary(reference.steps)
    const baseRows = baseBuildingRows([], reference)
    expect(baseRows.reduce((total, row) => total + (row.required ?? 0), 0)).toBe(reference.stats.buildings)
    expect(new Map(bill?.rows.map((row) => [row.buildingId, row.buildingCount]) ?? [])).toEqual(
      new Map(baseRows.map((row) => [row.id, row.required])),
    )
    if (!reference.steps.length) {
      expect(bill).toBeNull()
      expect(baseRows).toEqual([])
    }
  })

  it('keeps nominal assigned capacity separate from net demand after supply and uses the assigned alternative recipe', () => {
    const assigned = stations.map((station) => ({
      ...station,
      placements: station.placements.map((piece) => (piece.type === 'refinery' ? { ...piece, recipeId: 'cobalt_plates' } : piece)),
    }))
    const supplied = plan('T_CobaltPlates', 60, { supplyCountByItem: { T_CobaltPlates: 40 } })
    expect(baseProductRows(assigned, supplied)).toEqual([
      { id: 'T_CobaltPlates', name: 'Cobalt Plates', nominal: 40, stage: 1, target: 20 },
    ])
    expect(baseBuildingRows(assigned, supplied).find((row) => row.id === 'refinery')).toMatchObject({ placed: 2, required: 1 })
    const alternate = assigned.map((station) => ({
      ...station,
      placements: station.placements.map((piece) => (piece.type === 'refinery' ? { ...piece, recipeId: 'enriched_cobalt_plates' } : piece)),
    }))
    expect(baseProductRows(alternate, supplied)).toEqual([
      { id: 'T_CobaltPlates', name: 'Cobalt Plates', nominal: 60, stage: 1, target: 20 },
    ])
    expect(baseProductRows(alternate)).toEqual([{ id: 'T_CobaltPlates', name: 'Cobalt Plates', nominal: 60, stage: 2, target: null }])
  })
})

it('does not restore a production target already covered entirely by continuous external supply', () => {
  const supplied = plan('T_CobaltPlates', 60, { supplyCountByItem: { T_CobaltPlates: 60 } })
  expect(supplied.steps).toEqual([])
  expect(baseBuildingRows([], supplied)).toEqual([])
  expect(baseProductRows([], supplied)).toEqual([{ id: 'T_CobaltPlates', name: 'Cobalt Plates', nominal: 0, stage: 0, target: 0 }])
})

// Compare against the actual Stages graph, including supplied and coproduct dependencies.
it.each<{ target: string; supply: Record<string, number> }>([
  { target: 'T_Servomotor', supply: {} },
  { target: 'T_Servomotor', supply: { T_BasicMotor: 100 } },
  { target: 'T_Multisensor', supply: {} },
])('orders base items from prerequisites to final products like Stages for $target', ({ target, supply }) => {
  const reference = plan(target, 60, { supplyCountByItem: supply })
  const stages = getPlanProductionStages(reference)
  const graph = planToFlow({ plan: reference, items, layoutMode: 'stages' })
  const rows = baseProductRows([], reference)
  expect(reference.issues).toEqual([])
  expect(rows.at(-1)?.id).toBe(target)
  rows.forEach((row, index) => {
    expect(row.stage).toBe(stages.get(row.id))
    for (const previous of rows.slice(0, index)) {
      expect(stages.get(previous.id)).toBeLessThanOrEqual(stages.get(row.id) ?? -1)
      const previousNode = graph.nodes.find((node) => node.id === previous.id)
      const currentNode = graph.nodes.find((node) => node.id === row.id)
      expect(previousNode?.position.x).toBeLessThanOrEqual(currentNode?.position.x ?? -1)
    }
  })
})

it('keeps missing intermediate machines in the stage calculation when opening Bases directly', () => {
  const reference = plan('T_Servomotor', 60)
  const partial: BaseStation[] = [
    {
      ...stations[0],
      placements: reference.steps.flatMap((step, index) => {
        const type = placeableForBuilding(step.buildingId)
        return type && step.recipeId !== 'titanium_plates'
          ? [{ id: `stage-${index}`, type, x: index * 5, y: 0, direction: 'east', recipeId: step.recipeId }]
          : []
      }),
    },
  ]
  const rows = baseProductRows(partial)
  expect(rows.map((row) => row.id)).toEqual(['T_NickelPlates1', 'T_BasicMotor', 'T_Capacitor1', 'T_LightweightFrame1', 'T_Servomotor'])
  expect(rows.every((row) => row.target === null && row.nominal > 0)).toBe(true)
})

it('respects assigned alternative recipes when deriving standalone catalog stages', () => {
  const partial: BaseStation[] = [
    {
      ...stations[0],
      placements: [
        { id: 'motor', type: 'assembler', x: 0, y: 0, direction: 'east', recipeId: 'basic_motor' },
        { id: 'nickel', type: 'refinery', x: 6, y: 0, direction: 'east', recipeId: 'nickel_plates' },
        { id: 'cobalt', type: 'refinery', x: 6, y: 4, direction: 'east', recipeId: 'enriched_cobalt_plates' },
      ],
    },
  ]
  expect(baseProductRows(partial).map((row) => row.id)).toEqual(['T_NickelPlates1', 'T_BasicMotor', 'T_CobaltPlates'])
})

it('keeps fully supplied plan items at the source stage rather than falling back to their catalog depth', () => {
  const supplied = plan('T_Servomotor', 60, { supplyCountByItem: { T_Servomotor: 60 } })
  const assigned: BaseStation[] = [
    {
      ...stations[0],
      placements: [{ id: 'nickel', type: 'refinery', x: 0, y: 0, direction: 'east', recipeId: 'nickel_plates' }],
    },
  ]
  expect(baseProductRows(assigned, supplied).map((row) => row.id)).toEqual(['T_Servomotor', 'T_NickelPlates1'])
})
