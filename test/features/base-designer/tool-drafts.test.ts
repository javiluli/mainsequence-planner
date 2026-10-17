import { describe, expect, it } from 'vitest'
import {
  beltDraftPoints,
  canFinishOneCellBelt,
  proposeBeltDraft,
  toolPoint,
  tunnelDraft,
  type EditorTool,
} from '@/features/base-designer/lib/tool-drafts'
import { placementIssue } from '@/features/base-designer/lib/clipboard'
import { canPlaceScenePieces } from '@/features/base-designer/lib/placement'
import { dronePorts } from '@/features/base-designer/lib/stations'
import type { Point, Scene } from '@/features/base-designer/model/scene'

const scene: Scene = { stations: [{ id: 'floor', x: 0, y: 0 }], buildings: [], belts: [] }

describe('Pure tool proposals', () => {
  const grids: readonly [string, EditorTool, Point][] = [
    ['belt', { kind: 'belt', points: [] }, { x: -1, y: 1 }],
    ['tunnel', { kind: 'tunnel', type: 'underground' }, { x: -1, y: 1 }],
    ['copied belt', { kind: 'place', item: { kind: 'belt', points: [] } }, { x: -1, y: 1 }],
    [
      'copied tunnel',
      { kind: 'place', item: { kind: 'tunnel', type: 'underground', entry: { x: 0, y: 0 }, exit: { x: 2, y: 0 } } },
      { x: -1, y: 1 },
    ],
    ['splitter', { kind: 'place', item: { kind: 'splitter', type: 'splitter', rotation: 0 } }, { x: -1, y: 1 }],
    ['station', { kind: 'place', item: { kind: 'station' } }, { x: -0, y: 1 }],
    ['building', { kind: 'place', item: { kind: 'building', type: 'refinery', rotation: 0 } }, { x: -0, y: 1 }],
  ]
  it.each(grids)('keeps the coordinate policy of %s at a negative cell boundary', (_, tool, expected) => {
    expect(toolPoint(tool, { x: -1, y: 29 })).toEqual(expected)
  })

  it('uses the exact hit socket for belt drawing and the world origin for station placement', () => {
    const port = { x: -3, y: 2 },
      world = { x: 70, y: 51 }
    expect(toolPoint({ kind: 'belt', points: [] }, world, port)).toBe(port)
    expect(toolPoint({ kind: 'place', item: { kind: 'station' } }, world, port)).toEqual({ x: 4, y: 3 })
  })

  it.each(['conveyor', 'conveyor_mk2'] as const)('extends %s with a complete prefix without editing the existing route', (type) => {
    const extension = {
      id: 'route',
      type,
      points: [
        { x: 2, y: 7 },
        { x: 6, y: 7 },
      ],
    }
    const layout = { ...scene, belts: [extension] }
    const tool: Extract<EditorTool, { kind: 'belt' }> = {
      kind: 'belt',
      type: type === 'conveyor' ? 'conveyor_mk2' : 'conveyor',
      points: [extension.points[1]],
      extension,
    }
    const before = structuredClone({ layout, tool })
    const draft = proposeBeltDraft(tool, layout, { x: 8, y: 8 })
    expect(draft.valid).toBe(true)
    expect(draft.points).toEqual([
      { x: 6, y: 7 },
      { x: 8, y: 7 },
      { x: 8, y: 8 },
    ])
    expect(beltDraftPoints(tool, draft.points)).toEqual([
      { x: 2, y: 7 },
      { x: 6, y: 7 },
      { x: 8, y: 7 },
      { x: 8, y: 8 },
    ])
    expect({ layout, tool }).toEqual(before)
    expect(extension.type).toBe(type)
  })

  it('uses the sending normal initially and reverses the receiving normal for a one-cell connection', () => {
    const point = { x: 2, y: 7 }
    const start = proposeBeltDraft({ kind: 'belt', points: [] }, scene, point, { x: 1, y: 0 })
    const end = proposeBeltDraft({ kind: 'belt', points: [point] }, scene, point, { x: -1, y: 0 })
    expect(start.valid).toBe(true)
    expect(end.valid).toBe(true)
    expect(start.points).toEqual([point])
    expect(end.points).toEqual([point])
    expect(start.heading).toEqual({ x: 1, y: 0 })
    expect(end.heading).toEqual({ x: 1, y: -0 })
    expect(proposeBeltDraft({ kind: 'belt', points: [], startNormal: { x: 0, y: 1 } }, scene, point).heading).toEqual({ x: 0, y: 1 })
  })

  it.each([
    ['building', 'building'],
    ['splitter', 'building'],
    ['tunnel', 'building'],
    ['drone', 'building'],
    ['building', 'splitter'],
    ['building', 'tunnel'],
  ] as const)('finishes a directed one-cell connection from %s to %s without depending on production supply', (kind, receiverKind) => {
    const receiver = { id: 'receiver', stationId: 'floor', type: 'refinery' as const, rotation: 0 as const, x: 5, y: 2 }
    const layout: Scene = { ...scene, buildings: [receiver] }
    let point = { x: 4, y: 3 },
      heading = { x: 1, y: 0 }
    if (kind === 'building') layout.buildings = [{ id: 'source', stationId: 'floor', type: 'refinery', rotation: 0, x: 1, y: 2 }, receiver]
    else if (kind === 'splitter') layout.splitters = [{ id: 'source', type: 'splitter_mk2', rotation: 0, x: 3, y: 3 }]
    else if (kind === 'tunnel') layout.tunnels = [{ id: 'source', type: 'underground_mk2', entry: { x: 1, y: 3 }, exit: { x: 3, y: 3 } }]
    else {
      const drone = { id: 'source', type: 'drone' as const, rotation: 270 as const, x: -14, y: 0, cargo: [null, null] as const }
      const port = dronePorts(drone)[0]
      layout.stations = [...layout.stations, drone]
      layout.buildings = [{ ...receiver, x: port.cell.x + 1, y: port.cell.y - 1 }]
      point = port.cell
      heading = port.normal
    }
    if (receiverKind !== 'building') {
      layout.buildings = layout.buildings.filter((building) => building.id !== receiver.id)
      if (receiverKind === 'splitter') layout.splitters = [{ id: 'receiver', type: 'splitter_mk2', rotation: 0, x: 5, y: 3 }]
      else layout.tunnels = [{ id: 'receiver', type: 'underground_mk2', entry: { x: 5, y: 3 }, exit: { x: 7, y: 3 } }]
    }
    expect(canPlaceScenePieces(layout)).toBe(true)
    expect(canFinishOneCellBelt(layout, { points: [point], heading }, { x: -1, y: 0 })).toBe(true)
  })

  it('requires direction, a destination normal and both owners only when finishing a fresh one-cell gesture', () => {
    const layout: Scene = {
      ...scene,
      buildings: [
        { id: 'source', stationId: 'floor', type: 'refinery', rotation: 0, x: 1, y: 2 },
        { id: 'receiver', stationId: 'floor', type: 'refinery', rotation: 0, x: 5, y: 2 },
      ],
    }
    const belt = { points: [{ x: 4, y: 3 }], heading: { x: 1, y: 0 } },
      normal = { x: -1, y: 0 }
    expect(canFinishOneCellBelt(layout, { points: belt.points }, normal)).toBe(false)
    expect(canFinishOneCellBelt(layout, belt)).toBe(false)
    expect(canFinishOneCellBelt(layout, belt, belt.heading)).toBe(false)
    for (const buildings of [[], [layout.buildings[0]], [layout.buildings[1]]]) {
      const isolated = { ...layout, buildings }
      expect(canFinishOneCellBelt(isolated, belt, normal)).toBe(false)
      expect(canPlaceScenePieces({ ...isolated, belts: [{ ...belt, id: 'confirmed-route' }] })).toBe(true)
    }
  })

  it('snaps tunnel exits to the dominant axis, preferring horizontal ties without mutating the captured entry', () => {
    const entry = { x: -3, y: -2 },
      tool: Extract<EditorTool, { kind: 'tunnel' }> = { kind: 'tunnel', type: 'underground_mk2', entry }
    expect(tunnelDraft(tool, { x: -7, y: -6 })).toEqual({ type: 'underground_mk2', entry, exit: { x: -7, y: -2 } })
    expect(tunnelDraft(tool, { x: -5, y: 4 })).toEqual({ type: 'underground_mk2', entry, exit: { x: -3, y: 4 } })
    expect(entry).toEqual({ x: -3, y: -2 })
    expect(tunnelDraft({ kind: 'tunnel', type: 'underground' }, entry)).toEqual({ type: 'underground', entry, exit: entry })
  })

  it('keeps exact station and splitter diagnostics after removing the duplicate placement dispatcher', () => {
    expect(placementIssue(scene, { kind: 'station', value: { x: 0, y: 0 } })).toBe(
      'This station overlaps another module. Choose a free area.',
    )
    expect(placementIssue(scene, { kind: 'station', value: { x: 16, y: 0 } })).toBeNull()
    expect(placementIssue(scene, { kind: 'splitter', value: { type: 'splitter', rotation: 0, x: 1, y: 1 } })).toBeNull()
    expect(placementIssue(scene, { kind: 'splitter', value: { type: 'splitter', rotation: 0, x: 14, y: 1 } })).toBe(
      'A splitter needs a free floor cell or a straight belt aligned with its input.',
    )
  })
})
