import { describe, expect, it } from 'vitest'
import { stationCorridors, snapStation, floorCellLimit } from '@/features/base-designer/lib/stations'
import { canDrawBelt, canPlaceBuilding, isStationEmpty } from '@/features/base-designer/lib/placement'
import { beltCells, beltConnections } from '@/features/base-designer/lib/belts'
import { captureClipboard, placementAt, placementIssue } from '@/features/base-designer/lib/clipboard'
import type { Scene } from '@/features/base-designer/model/scene'
import { canPlaceStation, snapToGrid } from '@/features/base-designer/model/scene'

const scene: Scene = {
  stations: [
    { id: 'left', x: 0, y: 0 },
    { id: 'right', x: 16, y: 0 },
  ],
  buildings: [],
  belts: [],
}
const route = {
  id: 'route',
  points: [
    { x: 11, y: 5 },
    { x: 19, y: 5 },
  ],
}

describe('Station floor geometry', () => {
  const stations = [{ id: 'existing', x: -14, y: 0 }]

  it('accepts touching floors and negative coordinates without reserving decorative frame space', () => {
    expect(canPlaceStation(stations, { x: 0, y: 0 })).toBe(true)
    expect(canPlaceStation(stations, { x: -28, y: 0 })).toBe(true)
    expect(canPlaceStation(stations, { x: -14, y: 14 })).toBe(true)
    expect(canPlaceStation(stations, { x: -14, y: -14 })).toBe(true)
    expect(canPlaceStation(stations, { x: -14, y: 0 }, 'existing')).toBe(true)
  })

  it('rejects partial overlap, off-grid cells and non-finite coordinates', () => {
    for (const point of [
      { x: -1, y: 0 },
      { x: -14, y: 13 },
      { x: 0.5, y: 20 },
      { x: NaN, y: 0 },
      { x: 0, y: Infinity },
    ]) {
      expect(canPlaceStation(stations, point)).toBe(false)
    }
  })

  it('snaps world pixels independently of screen zoom, including positions left of the origin', () => {
    expect(snapToGrid({ x: 39, y: -21 })).toEqual({ x: 2, y: -1 })
  })
})

describe('Aligned station floor and attraction', () => {
  it('derives each horizontal/vertical link once, including negative coordinates', () => {
    const stations = [
      { id: 'corner', x: -16, y: -16 },
      { id: 'east', x: 0, y: -16 },
      { id: 'south', x: -16, y: 0 },
    ]
    expect(stationCorridors(stations)).toEqual([
      { x: -2, y: -12, width: 2, height: 6, stationIds: ['corner', 'east'] },
      { x: -12, y: -2, width: 6, height: 2, stationIds: ['corner', 'south'] },
    ])
    expect(stationCorridors([...stations].reverse())).toHaveLength(2)
    expect(stationCorridors([scene.stations[0], { id: 'offset', x: 16, y: 1 }])).toEqual([])
    expect(stationCorridors([scene.stations[0], { id: 'touching', x: 14, y: 0 }])).toEqual([])
  })

  it('attracts only nearby valid positions and excludes the dragged station', () => {
    const left = [scene.stations[0]]
    expect(snapStation(left, { x: 15, y: 1 })).toEqual({ x: 16, y: 0 })
    expect(snapStation(left, { x: 14, y: 0 })).toEqual({ x: 16, y: 0 })
    expect(snapStation(left, { x: 13, y: 0 })).toEqual({ x: 13, y: 0 })
    expect(snapStation(left, { x: -1, y: -15 })).toEqual({ x: 0, y: -16 })
    expect(snapStation(scene.stations, { x: 15, y: 1 })).toEqual({ x: 15, y: 1 })
    expect(snapStation(scene.stations, { x: 15, y: 1 }, 'right')).toEqual({ x: 16, y: 0 })
    expect(snapStation(left, { x: NaN, y: 0 })).toEqual({ x: NaN, y: 0 })
    const placement = placementAt({ ...scene, stations: left }, { kind: 'station' }, { x: 15, y: 1 })
    expect(placement).toEqual({ kind: 'station', value: { x: 16, y: 0 } })
    expect(placementIssue({ ...scene, stations: left }, placement)).toBeNull()
  })
})

describe('One complete route across station floors', () => {
  it('requires aligned doorway cells, even when unconnected station floors touch', () => {
    expect(canDrawBelt(scene, route)).toBe(true)
    expect(
      canDrawBelt(scene, {
        points: [
          { x: 11, y: 3 },
          { x: 19, y: 3 },
        ],
      }),
    ).toBe(false)
    const touching = { ...scene, stations: [scene.stations[0], { ...scene.stations[1], x: 14 }] }
    expect(
      canDrawBelt(touching, {
        points: [
          { x: 11, y: 5 },
          { x: 19, y: 5 },
        ],
      }),
    ).toBe(false)
    expect(canDrawBelt({ ...scene, stations: [scene.stations[0]] }, route)).toBe(false)
    expect(
      canDrawBelt(scene, {
        points: [
          { x: 14, y: 5 },
          { x: 15, y: 5 },
        ],
      }),
    ).toBe(true)
  })

  it('supports long routes through many stations without unbounded expansion or new crossings', () => {
    const chain = { ...scene, stations: Array.from({ length: 18 }, (_, i) => ({ id: `floor-${i}`, x: i * 16, y: 0 })) }
    const points = [
      { x: 1, y: 5 },
      { x: 283, y: 5 },
    ]
    expect(canDrawBelt(chain, { points })).toBe(true)
    expect(beltCells(points, floorCellLimit(chain.stations))).toHaveLength(283)
    expect(
      canDrawBelt(scene, {
        points: [
          { x: 1, y: 5 },
          { x: Number.MAX_SAFE_INTEGER, y: 5 },
        ],
      }),
    ).toBe(false)
    expect(
      canDrawBelt(
        { ...scene, belts: [route] },
        {
          points: [
            { x: 15, y: 4 },
            { x: 15, y: 9 },
          ],
        },
      ),
    ).toBe(false)
  })

  it('resolves endpoints in different stations and keeps buildings entirely on their own floor', () => {
    const connected: Scene = {
      ...scene,
      buildings: [
        { id: 'source', stationId: 'left', type: 'refinery', rotation: 0, x: 8, y: 4 },
        { id: 'target', stationId: 'right', type: 'refinery', rotation: 0, x: 20, y: 4 },
      ],
    }
    expect(canDrawBelt(connected, route)).toBe(true)
    expect(beltConnections(connected, route)).toMatchObject({ output: { buildingId: 'source' }, input: { buildingId: 'target' } })
    expect(beltConnections({ ...connected, buildings: connected.buildings.slice(0, 1) }, route).input).toBeUndefined()
    expect(canPlaceBuilding(scene, { ...connected.buildings[0], x: 12 })).toBe(false)
  })

  it('protects both supports of a corridor-only route, and releases them after removing the route', () => {
    const occupied = {
      ...scene,
      belts: [
        {
          id: 'corridor-only',
          points: [
            { x: 14, y: 5 },
            { x: 15, y: 5 },
          ],
        },
      ],
    }
    for (const station of scene.stations) {
      expect(isStationEmpty(occupied, station.id)).toBe(false)
      expect(captureClipboard(occupied, { kind: 'station', id: station.id })).toBeNull()
      expect(isStationEmpty(scene, station.id)).toBe(true)
    }
  })

  it('copies and rebinds the whole route only where every floor and corridor exists', () => {
    const clipboard = captureClipboard({ ...scene, belts: [route] }, { kind: 'belt', id: route.id })!
    expect(clipboard).toEqual({
      kind: 'belt',
      points: [
        { x: 0, y: 0 },
        { x: 8, y: 0 },
      ],
    })
    expect(placementIssue(scene, placementAt(scene, clipboard, { x: 11, y: 6 }))).toBeNull()
    expect(placementIssue(scene, placementAt(scene, clipboard, { x: 11, y: 10 }))).not.toBeNull()
    expect(placementIssue({ ...scene, stations: [scene.stations[0]] }, placementAt(scene, clipboard, { x: 11, y: 6 }))).not.toBeNull()
  })
})
