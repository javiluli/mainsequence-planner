import { describe, expect, it } from 'vitest'
import { BUILDINGS, buildingPorts, nextRotation, type Building } from '@/features/base-designer/model/buildings'
import type { Scene } from '@/features/base-designer/model/scene'
import { beltCells, beltConnections } from '@/features/base-designer/lib/belts'
import { canDrawBelt, canPlaceBuilding } from '@/features/base-designer/lib/placement'

const source: Building = { id: 'source', stationId: 'floor', type: 'refinery', rotation: 0, x: 1, y: 2 }
const target: Building = { id: 'target', stationId: 'floor', type: 'refinery', rotation: 0, x: 8, y: 2 }
const route = {
  id: 'belt',
  points: [
    { x: 4, y: 3 },
    { x: 7, y: 3 },
  ],
}
const scene: Scene = {
  stations: [
    { id: 'floor', x: 0, y: 0 },
    { id: 'neighbor', x: 14, y: 0 },
  ],
  buildings: [source, target],
  belts: [],
}

describe('Building footprints and ports', () => {
  it('retains measured sizes and rotates physical openings with a stable key', () => {
    expect(Object.fromEntries(Object.entries(BUILDINGS).map(([type, building]) => [type, building.size]))).toEqual({
      refinery: 3,
      assembler: 5,
      reactor: 6,
      material_lab: 3,
      computation_lab: 3,
      enrichment: 9,
      container: 2,
    })
    const original = buildingPorts(source),
      turned = buildingPorts({ ...source, rotation: 90 })
    expect(original).toHaveLength(4)
    expect(turned.find((p) => p.key === original[0].key)).toMatchObject({ cell: { x: 4, y: 3 }, normal: { x: 1, y: 0 } })
    expect(buildingPorts({ ...source, type: 'assembler' })).toHaveLength(8)
    expect(buildingPorts({ ...source, type: 'reactor' })).toHaveLength(8)
    expect(nextRotation(nextRotation(nextRotation(nextRotation(0))))).toBe(0)
  })

  it('requires a whole building in its explicit floor, even across adjacent stations', () => {
    const empty = { ...scene, buildings: [] }
    expect(canPlaceBuilding(empty, { ...source, type: 'reactor', x: 8, y: 8 })).toBe(true)
    expect(canPlaceBuilding(empty, { ...source, type: 'reactor', x: 9, y: 8 })).toBe(false)
    expect(canPlaceBuilding(empty, { ...source, x: 13 })).toBe(false)
    expect(canPlaceBuilding(empty, { ...source, stationId: 'missing' })).toBe(false)
    expect(canPlaceBuilding(empty, { ...source, x: NaN })).toBe(false)
    expect(canPlaceBuilding(scene, source, source.id)).toBe(true)
    expect(canPlaceBuilding(scene, { ...source, x: 3 })).toBe(false)
  })

  it('blocks buildings over retained belts instead of deleting or rerouting them', () => {
    const withBelt = { ...scene, belts: [route] }
    expect(canPlaceBuilding(withBelt, { ...source, x: 4 }, source.id)).toBe(false)
    expect(canPlaceBuilding(withBelt, { ...source, x: 1, y: 8 }, source.id)).toBe(true)
  })
})

describe('Whole manual belt routes', () => {
  it('expands corners exactly once and supports negative floor coordinates', () => {
    expect(
      beltCells([
        { x: -2, y: -1 },
        { x: 0, y: -1 },
        { x: 0, y: 1 },
      ]),
    ).toEqual([
      { x: -2, y: -1 },
      { x: -1, y: -1 },
      { x: 0, y: -1 },
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ])
  })

  it('rejects diagonals, backtracking, self-crossings and unbounded spans', () => {
    for (const points of [
      [],
      [{ x: 0, y: NaN }],
      [
        { x: 0, y: 0 },
        { x: 2, y: 2 },
      ],
      [
        { x: 0, y: 0 },
        { x: 0, y: 0 },
      ],
      [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 2, y: 0 },
      ],
      [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 4 },
        { x: 2, y: 4 },
        { x: 2, y: -1 },
      ],
      [
        { x: 0, y: 0 },
        { x: Number.MAX_SAFE_INTEGER, y: 0 },
      ],
    ])
      expect(beltCells(points)).toBeNull()
  })

  it('allows free ends but blocks crossings, occupied floor and unconnected neighboring stations', () => {
    expect(canDrawBelt(scene, route)).toBe(true)
    expect(
      canDrawBelt(scene, {
        ...route,
        points: [
          { x: 2, y: 8 },
          { x: 8, y: 8 },
        ],
      }),
    ).toBe(true)
    expect(canDrawBelt(scene, { ...route, points: [{ x: 4, y: 3 }] })).toBe(true)
    expect(
      canDrawBelt(scene, {
        ...route,
        points: [
          { x: 2, y: 3 },
          { x: 7, y: 3 },
        ],
      }),
    ).toBe(false)
    expect(
      canDrawBelt(scene, {
        ...route,
        points: [
          { x: 12, y: 8 },
          { x: 16, y: 8 },
        ],
      }),
    ).toBe(false)
    expect(
      canDrawBelt(
        { ...scene, belts: [route] },
        {
          ...route,
          points: [
            { x: 5, y: 1 },
            { x: 5, y: 6 },
          ],
        },
      ),
    ).toBe(false)
    expect(canDrawBelt({ ...scene, belts: [route] }, route)).toBe(false)
  })

  it('derives both endpoint roles by position and direction; reconnecting needs no route edits', () => {
    expect(beltConnections(scene, route)).toMatchObject({ output: { buildingId: 'source' }, input: { buildingId: 'target' } })
    expect(beltConnections(scene, { ...route, points: [...route.points].reverse() })).toMatchObject({
      output: { buildingId: 'target' },
      input: { buildingId: 'source' },
    })
    expect(beltConnections({ ...scene, buildings: [target] }, route).output).toBeUndefined()
    expect(beltConnections({ ...scene, buildings: [{ ...source, y: 8 }, target] }, route).output).toBeUndefined()
    expect(
      beltConnections(scene, {
        ...route,
        points: [
          { x: 4, y: 3 },
          { x: 4, y: 6 },
        ],
      }).output,
    ).toMatchObject({ buildingId: 'source', port: { key: '1:1' } })
    expect(
      beltConnections(scene, {
        ...route,
        points: [
          { x: 4, y: 3 },
          { x: 3, y: 3 },
        ],
      }).output,
    ).toBeUndefined()
  })
})
