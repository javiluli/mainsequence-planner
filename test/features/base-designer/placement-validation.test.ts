import { describe, expect, it } from 'vitest'
import { buildingPlacementIssue, canDrawBelt, canPlaceScenePieces, scenePlacementIssue } from '@/features/base-designer/lib/placement'
import { readSceneDocument, writeSceneDocument } from '@/features/base-designer/lib/scene-document'
import type { Scene } from '@/features/base-designer/model/scene'
import { performanceScene } from './performance-scene'

describe('Complete validation geometry', () => {
  it('validates the profiling layout without mutating its recipe, routes, corridors or confirmed records', () => {
    const scene = performanceScene(3),
      before = structuredClone(scene)
    expect(scene.buildings).toHaveLength(12)
    expect(scene.belts).toHaveLength(15)
    expect(scene.splitters).toHaveLength(12)
    expect(scene.tunnels).toHaveLength(3)
    expect(canPlaceScenePieces(scene)).toBe(true)
    expect(scenePlacementIssue(scene)).toBeNull()
    expect(readSceneDocument(JSON.parse(writeSceneDocument(scene)))).toEqual(scene)
    expect(scene).toEqual(before)
  })

  it('rechecks the same scene and route array after input coordinates or contents change', () => {
    const points = [
      { x: 2, y: 7 },
      { x: 5, y: 7 },
    ]
    const buildings = [{ id: 'machine', stationId: 'floor', type: 'refinery' as const, rotation: 0 as const, x: 1, y: 1 }]
    const scene = { stations: [{ id: 'floor', x: 0, y: 0 }], buildings, belts: [{ id: 'route', points }] }
    expect(scenePlacementIssue(scene)).toBeNull()
    points[0].y = points[1].y = 2
    expect(scenePlacementIssue(scene)).toBe('A surface belt occupies this space. Move the belt or choose a free area.')
    expect(canPlaceScenePieces(scene)).toBe(false)
    points[0].y = points[1].y = 7
    expect(scenePlacementIssue(scene)).toBeNull()
    buildings.push({ ...buildings[0], id: 'overlap' })
    expect(scenePlacementIssue(scene)).toBe('Another building occupies this space. Move it or choose a free area.')
    expect(canPlaceScenePieces(scene)).toBe(false)
  })

  it('recomputes the floor limit and corridors after the same station array grows', () => {
    const stations = [{ id: 'floor-0', x: 0, y: 0 }]
    const scene = {
      stations,
      buildings: [],
      belts: [
        {
          id: 'long',
          points: [
            { x: 1, y: 5 },
            { x: 283, y: 5 },
          ],
        },
      ],
    }
    expect(canPlaceScenePieces(scene)).toBe(false)
    expect(scenePlacementIssue(scene)).toBe('Keep each complete belt on connected station or corridor floors.')
    for (let floor = 1; floor < 18; floor++) stations.push({ id: 'floor-' + floor, x: floor * 16, y: 0 })
    expect(canPlaceScenePieces(scene)).toBe(true)
    expect(scenePlacementIssue(scene)).toBeNull()
  })

  it('preserves the first error when a distant peer is malformed, even though its bounds would be disjoint', () => {
    const scene: Scene = {
      stations: [
        { id: 'floor', x: 0, y: 0 },
        { id: 'far', x: 100, y: 0 },
      ],
      buildings: [],
      belts: [
        {
          id: 'first',
          points: [
            { x: 1, y: 7 },
            { x: 4, y: 7 },
          ],
        },
        {
          id: 'malformed',
          points: [
            { x: 101, y: 7 },
            { x: 104, y: 8 },
          ],
        },
      ],
    }
    expect(canDrawBelt(scene, scene.belts[0], 'first')).toBe(false)
    expect(scenePlacementIssue(scene)).toBe('Belts cannot cross, overlap, occupy machines or enter a logistics piece from an invalid side.')
    expect(canPlaceScenePieces(scene)).toBe(false)
  })

  it('keeps floor support ahead of collisions and derives geometry only after the earlier configuration checks', () => {
    const scene: Scene = {
      stations: [{ id: 'floor', x: 0, y: 0 }],
      buildings: [
        { id: 'unsupported', stationId: 'missing', type: 'refinery', rotation: 0, x: 1, y: 1 },
        { id: 'occupied', stationId: 'floor', type: 'refinery', rotation: 0, x: 1, y: 1 },
      ],
      belts: [],
      splitters: [
        { id: 'unsupported-splitter', type: 'splitter', rotation: 0, x: 20, y: 0 },
        { id: 'occupied-splitter', type: 'splitter', rotation: 0, x: 20, y: 0 },
      ],
    }
    expect(scenePlacementIssue(scene)).toBe(
      'Keep every building entirely on its station. Include any pieces that would lose floor support.',
    )
    expect(scenePlacementIssue({ ...scene, buildings: [] })).toBe('A splitter would lose its station or corridor floor.')
    const invalidStation: Scene = {
      ...scene,
      stations: [{ id: 'drone', type: 'drone', x: 0, y: 0, rotation: 0, cargo: [null, null], disabledOutputs: ['unknown'] }],
    }
    expect(scenePlacementIssue(invalidStation)).toBe('The station output configuration is invalid.')
  })

  it('uses bounds only to reject impossible intersections and keeps exact directed checks for overlapping bounds', () => {
    const scene: Scene = {
      stations: [{ id: 'floor', x: 0, y: 0 }],
      buildings: [],
      belts: [
        {
          id: 'L',
          points: [
            { x: 1, y: 1 },
            { x: 8, y: 1 },
            { x: 8, y: 8 },
          ],
        },
      ],
    }
    const interior = {
      id: 'interior',
      points: [
        { x: 2, y: 5 },
        { x: 6, y: 5 },
      ],
    }
    expect(canDrawBelt(scene, interior)).toBe(true)
    expect(scenePlacementIssue({ ...scene, belts: [...scene.belts, interior] })).toBeNull()
    expect(canDrawBelt(scene, { points: [{ x: 8, y: 6 }], heading: { x: 0, y: 1 } })).toBe(false)
  })

  it('checks changed points under the original ID and keeps disabled tunnel outlets physically directional', () => {
    const scene: Scene = {
      stations: [{ id: 'floor', x: 0, y: 0 }],
      buildings: [{ id: 'machine', stationId: 'floor', type: 'refinery', rotation: 0, x: 5, y: 10 }],
      belts: [
        {
          id: 'route',
          points: [
            { x: 2, y: 7 },
            { x: 5, y: 7 },
          ],
        },
      ],
      tunnels: [{ id: 'tunnel', type: 'underground', entry: { x: 8, y: 7 }, exit: { x: 11, y: 7 }, disabledOutputs: ['exit'] }],
    }
    expect(scenePlacementIssue(scene)).toBeNull()
    expect(canDrawBelt(scene, { points: [...scene.belts[0].points, { x: 5, y: 10 }] }, 'route')).toBe(false)
    expect(buildingPlacementIssue(scene, scene.buildings[0], 'machine')).toBeNull()
    expect(
      canDrawBelt(scene, {
        points: [
          { x: 11, y: 7 },
          { x: 13, y: 7 },
        ],
      }),
    ).toBe(true)
    expect(
      canDrawBelt(scene, {
        points: [
          { x: 11, y: 6 },
          { x: 11, y: 7 },
        ],
      }),
    ).toBe(false)
  })
})
