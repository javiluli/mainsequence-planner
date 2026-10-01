import { describe, expect, it } from 'vitest'
import { baseBuildingRows, countBaseBuildings, summarizePlanComparison } from '@/features/base-designer/lib/plan-comparison'
import type { BaseStation } from '@/features/base-designer/lib/placement'
import { buildProductionPlan } from '@/features/planner/lib/production-plan'
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

function plan(targetId = 'T_CobaltPlates', targetIpm = 60) {
  return buildProductionPlan({
    buildings,
    producerBuildingsByItemId,
    targetId,
    targetIpm,
    isRawTarget: false,
    rawItemIds: new Set(items.filter((item) => item.type === 'raw').map((item) => item.id)),
    supplyCountByItem: {},
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
