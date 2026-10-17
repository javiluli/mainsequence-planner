import { describe, expect, it } from 'vitest'
import type { Belt, Scene } from '@/features/base-designer/model/scene'
import { beltCells, beltConnections, beltToExtend, canJoinBelts, connectsLogisticsPort } from '@/features/base-designer/lib/belts'
import { beltNetwork } from '@/features/base-designer/lib/belt-network'
import { canDrawBelt, canPlaceScenePieces } from '@/features/base-designer/lib/placement'
import { logisticsPorts } from '@/features/base-designer/model/logistics'
import { rotateGroup } from '@/features/base-designer/lib/scene-geometry'
import { readSceneDocument, writeSceneDocument } from '@/features/base-designer/lib/scene-document'

const main: Belt = {
  id: 'main',
  points: [
    { x: 4, y: 7 },
    { x: 9, y: 7 },
  ],
}
const branch: Belt = {
  id: 'branch',
  points: [
    { x: 6, y: 4 },
    { x: 6, y: 7 },
  ],
}
const scene: Scene = {
  stations: [{ id: 'floor', x: 0, y: 0 }],
  buildings: [
    { id: 'source', stationId: 'floor', type: 'refinery', rotation: 0, x: 1, y: 6 },
    { id: 'branch-source', stationId: 'floor', type: 'refinery', rotation: 0, x: 5, y: 1 },
    { id: 'target', stationId: 'floor', type: 'refinery', rotation: 0, x: 10, y: 6 },
  ],
  belts: [main, branch],
}

describe('Directed route connections', () => {
  it('keeps restored IDs opaque, including names belonging to JavaScript object prototypes', () => {
    const renamed = {
      ...scene,
      buildings: scene.buildings.map((b) => ({ ...b, id: b.id === 'source' ? '__proto__' : b.id === 'target' ? 'constructor' : b.id })),
    }
    const restored = readSceneDocument({ version: 3, scene: renamed })!
    const prototypeKeys = Object.getOwnPropertyNames(Object.prototype)
    const network = beltNetwork(restored)
    expect(network.portRoles.get('__proto__')).toBeDefined()
    expect(network.portRoles.get('constructor')).toBeDefined()
    expect(Object.getOwnPropertyNames(Object.prototype)).toEqual(prototypeKeys)
    expect([...network.runs.values()].flat().every((run) => run.active)).toBe(true)
  })
  it('accepts distinct arms at straight and corner joins near the safe coordinate boundary', () => {
    const cell = { x: Number.MAX_SAFE_INTEGER - 11, y: Number.MAX_SAFE_INTEGER - 11 }
    const from = [{ x: cell.x + 1, y: cell.y }, cell]
    const corner = [{ x: cell.x - 1, y: cell.y }, cell, { x: cell.x, y: cell.y + 1 }]
    const straight = [{ x: cell.x, y: cell.y - 1 }, cell, { x: cell.x, y: cell.y + 1 }]
    expect(canJoinBelts(from, corner, cell)).toBe(true)
    expect(canJoinBelts(from, straight, cell)).toBe(true)
    expect(canJoinBelts([{ x: cell.x - 1, y: cell.y }, cell], corner, cell)).toBe(false)
    expect(canJoinBelts([{ x: cell.x, y: cell.y + 1 }, cell], corner, cell)).toBe(false)
  })
  it('keeps a T valid and its route priority when a building port moves beside that junction', () => {
    const touching = {
      ...scene,
      buildings: [...scene.buildings, { id: 'beside', stationId: 'floor', type: 'refinery' as const, rotation: 0 as const, x: 5, y: 8 }],
    }
    // Legacy documents omit logistics collections; restoration adds them without changing geometry.
    expect(readSceneDocument({ version: 3, scene: touching })).toEqual({ ...touching, splitters: [], tunnels: [] })
    expect(beltConnections(touching, branch).input).toBeUndefined()
    expect(beltNetwork(touching).portRoles.get('beside')).toBeUndefined()
    expect(
      beltNetwork(touching)
        .runs.get(branch.id)
        ?.every((run) => run.active),
    ).toBe(true)
  })
  it('accepts lateral T joins on straight cells in either validation order', () => {
    expect(canDrawBelt({ ...scene, belts: [main] }, branch)).toBe(true)
    expect(canDrawBelt({ ...scene, belts: [branch] }, main)).toBe(true)
    expect(readSceneDocument(JSON.parse(writeSceneDocument(scene)))).toEqual({ ...scene, splitters: [], tunnels: [] })
    expect(readSceneDocument({ version: 3, scene: { ...scene, belts: [branch, main] } })).toEqual({
      ...scene,
      belts: [branch, main],
      splitters: [],
      tunnels: [],
    })
  })

  it('connects an end to a free start while preserving two independent route identities', () => {
    const belts = [
      {
        ...main,
        points: [
          { x: 4, y: 7 },
          { x: 6, y: 7 },
        ],
      },
      {
        id: 'next',
        points: [
          { x: 6, y: 7 },
          { x: 9, y: 7 },
        ],
      },
    ]
    expect(canDrawBelt({ ...scene, belts: [belts[1]] }, belts[0])).toBe(true)
    const network = beltNetwork({ ...scene, belts })
    for (const belt of belts) expect(network.runs.get(belt.id)).toEqual([{ points: belt.points, active: true }])
    expect(beltToExtend({ ...scene, belts }, { x: 6, y: 7 })).toBeUndefined()
    expect(beltToExtend({ ...scene, belts }, { x: 9, y: 7 })).toBeUndefined()
  })

  it.each([
    [
      'a crossing',
      [
        { x: 6, y: 4 },
        { x: 6, y: 10 },
      ],
    ],
    [
      'an outgoing split',
      [
        { x: 6, y: 7 },
        { x: 6, y: 10 },
      ],
    ],
    [
      'a parallel overlap',
      [
        { x: 5, y: 7 },
        { x: 7, y: 7 },
      ],
    ],
    [
      'an opposite end',
      [
        { x: 12, y: 7 },
        { x: 9, y: 7 },
      ],
    ],
  ])('rejects %s', (_, points) => {
    expect(canDrawBelt({ ...scene, buildings: [], belts: [main] }, { points })).toBe(false)
  })

  it('accepts three-arm corners but blocks another branch at an occupied junction', () => {
    const corner = {
      ...main,
      points: [
        { x: 4, y: 7 },
        { x: 6, y: 7 },
        { x: 6, y: 9 },
      ],
    }
    expect(canDrawBelt({ ...scene, belts: [corner] }, branch)).toBe(true)
    expect(canDrawBelt({ ...scene, belts: [branch] }, corner)).toBe(true)
    expect(
      canDrawBelt(
        { ...scene, belts: [corner, branch] },
        {
          points: [
            { x: 9, y: 7 },
            { x: 6, y: 7 },
          ],
        },
      ),
    ).toBe(false)
    expect(
      canDrawBelt(scene, {
        points: [
          { x: 6, y: 11 },
          { x: 6, y: 7 },
        ],
      }),
    ).toBe(false)
  })

  it('animates only complete paths, including the downstream portion reached by a T branch', () => {
    const onlyBranch = { ...scene, buildings: scene.buildings.filter((b) => b.id !== 'source') }
    const network = beltNetwork(onlyBranch)
    expect(network.runs.get(main.id)).toEqual([
      {
        points: [
          { x: 4, y: 7 },
          { x: 6, y: 7 },
        ],
        active: false,
      },
      {
        points: [
          { x: 6, y: 7 },
          { x: 9, y: 7 },
        ],
        active: true,
      },
    ])
    expect(network.runs.get(branch.id)).toEqual([{ points: branch.points, active: true }])
    expect(network.portRoles.get('branch-source')).toBeDefined()
    const withoutSink = beltNetwork({ ...onlyBranch, buildings: onlyBranch.buildings.filter((b) => b.id !== 'target') })
    expect([...withoutSink.runs.values()].flat().every((run) => !run.active)).toBe(true)
    expect(beltNetwork({ ...scene, belts: [branch] }).runs.get(branch.id)).toEqual([{ points: branch.points, active: false }])
  })

  it('handles closed cell cycles iteratively without inventing a receiving building', () => {
    const belts = [
      {
        id: 'a',
        points: [
          { x: 1, y: 1 },
          { x: 5, y: 1 },
          { x: 5, y: 5 },
        ],
      },
      {
        id: 'b',
        points: [
          { x: 5, y: 5 },
          { x: 1, y: 5 },
          { x: 1, y: 1 },
        ],
      },
    ]
    const empty = { ...scene, buildings: [], belts }
    expect(readSceneDocument({ version: 3, scene: empty })).toEqual({ ...empty, splitters: [], tunnels: [] })
    expect([...beltNetwork(empty).runs.values()].flat().every((run) => !run.active)).toBe(true)
  })

  it('keeps version 2 geometry unchanged, but does not reinterpret old overlapping data as new joins', () => {
    expect(readSceneDocument({ version: 2, scene: { ...scene, belts: [main] } })).toEqual({
      ...scene,
      belts: [main],
      splitters: [],
      tunnels: [],
    })
    expect(readSceneDocument({ version: 2, scene })).toBeNull()
    expect(
      readSceneDocument({ version: 3, scene: { ...scene, belts: [...scene.belts, { ...branch, id: 'duplicate-geometry' }] } }),
    ).toBeNull()
  })
})

it.each([false, true])('does not create a lateral outlet where a lane bends towards another BOX input (disabled=%s)', (disabled) => {
  const corner: Scene = {
    stations: [{ id: 'floor', x: 0, y: 0 }],
    buildings: [
      { id: 'ref', stationId: 'floor', type: 'refinery', x: 1, y: 3, rotation: 0 },
      { id: 'box', stationId: 'floor', type: 'container', x: 9, y: 3, rotation: 0, ...(disabled && { disabledOutputs: ['3:1'] }) },
    ],
    belts: [
      {
        id: 'belt',
        points: [
          { x: 4, y: 4 },
          { x: 8, y: 4 },
          { x: 8, y: 3 },
        ],
      },
    ],
  }
  const network = beltNetwork(corner)
  expect(network.portRoles.get('box')).toEqual({ '3:0': 'input' })
  expect(network.portBridges.filter((bridge) => bridge.ownerId === 'box')).toHaveLength(1)
  expect(network.runs.get('belt')?.every((run) => run.active)).toBe(true)
})

describe('Fixed logistics outlets and passing lanes', () => {
  const routes = [
    [
      'straight',
      [
        { x: 1, y: 6 },
        { x: 10, y: 6 },
      ],
      undefined,
      true,
      false,
    ],
    [
      'corner away from the hull',
      [
        { x: 1, y: 6 },
        { x: 4, y: 6 },
        { x: 4, y: 9 },
      ],
      undefined,
      true,
      false,
    ],
    [
      'corner approaching the hull',
      [
        { x: 4, y: 9 },
        { x: 4, y: 6 },
        { x: 10, y: 6 },
      ],
      undefined,
      true,
      false,
    ],
    [
      'mirrored corner approaching the hull',
      [
        { x: 4, y: 9 },
        { x: 4, y: 6 },
        { x: 1, y: 6 },
      ],
      undefined,
      true,
      false,
    ],
    [
      'outside start',
      [
        { x: 4, y: 6 },
        { x: 10, y: 6 },
      ],
      undefined,
      true,
      true,
    ],
    ['single-cell start', [{ x: 4, y: 6 }], { x: 1, y: 0 }, true, true],
    [
      'axial mouth start',
      [
        { x: 4, y: 5 },
        { x: 4, y: 9 },
      ],
      undefined,
      true,
      true,
    ],
    [
      'terminal',
      [
        { x: 1, y: 6 },
        { x: 4, y: 6 },
      ],
      undefined,
      false,
      false,
    ],
  ] as const

  it.each(['underground', 'underground_mk2'] as const)('shares physical output rules for %s without rewriting endpoint hints', (type) => {
    for (const [label, points, heading, connected, startsAtPort] of routes) {
      let scene: Scene = {
        stations: [{ id: 'floor', type: 'station_2x2_a', x: 0, y: 0 }],
        buildings: [],
        tunnels: [{ id: 'tunnel', type, entry: { x: 4, y: 2 }, exit: { x: 4, y: 5 } }],
        belts: [{ id: 'lane', points, ...(heading && { heading }) }],
      }
      for (let turn = 0; turn < 4; turn++) {
        expect(canPlaceScenePieces(scene), label).toBe(true)
        const port = logisticsPorts(scene).find((port) => port.role === 'output')!,
          lane = scene.belts[0],
          network = beltNetwork(scene)
        expect(connectsLogisticsPort(port, beltCells(lane.points)!, lane.heading), label).toBe(connected)
        expect(network.connectedPorts.has(port.key), label).toBe(connected)
        expect(network.links.get(port.at.x + ',' + port.at.y)?.includes(port.cell.x + ',' + port.cell.y) ?? false, label).toBe(connected)
        expect(beltConnections(scene, lane).logisticsOutput !== undefined, label).toBe(startsAtPort)
        scene = rotateGroup(scene)
      }
    }
  })

  it.each(['splitter', 'splitter_mk2'] as const)('also merges the fixed %s outlet into either head-on corner', (type) => {
    for (const x of [1, 10]) {
      let scene: Scene = {
        stations: [{ id: 'floor', type: 'station_2x2_a', x: 0, y: 0 }],
        buildings: [],
        splitters: [{ id: 'splitter', type, x: 4, y: 5, rotation: 0 }],
        belts: [
          {
            id: 'lane',
            points: [
              { x: 4, y: 9 },
              { x: 4, y: 6 },
              { x, y: 6 },
            ],
          },
        ],
      }
      for (let turn = 0; turn < 4; turn++) {
        const port = logisticsPorts(scene).find((port) => port.outputKey === 'south')!,
          network = beltNetwork(scene)
        expect(canPlaceScenePieces(scene)).toBe(true)
        expect(connectsLogisticsPort(port, beltCells(scene.belts[0].points)!)).toBe(true)
        expect(network.connectedPorts.has(port.key)).toBe(true)
        expect(network.links.get(port.at.x + ',' + port.at.y)).toContain(port.cell.x + ',' + port.cell.y)
        scene = rotateGroup(scene)
      }
    }
  })

  it('keeps fixed inputs terminal, rejects lateral mouth traversal and feeds an existing T', () => {
    const base: Scene = {
      stations: [{ id: 'floor', type: 'station_2x2_a', x: 0, y: 0 }],
      buildings: [],
      tunnels: [{ id: 'tunnel', type: 'underground', entry: { x: 4, y: 2 }, exit: { x: 4, y: 5 } }],
      belts: [],
    }
    const input = logisticsPorts(base).find((port) => port.role === 'input')!,
      output = logisticsPorts(base).find((port) => port.role === 'output')!
    expect(
      connectsLogisticsPort(
        input,
        beltCells([
          { x: 1, y: 1 },
          { x: 10, y: 1 },
        ])!,
      ),
    ).toBe(false)
    for (const points of [
      [
        { x: 4, y: 5 },
        { x: 10, y: 5 },
      ],
      [
        { x: 1, y: 5 },
        { x: 4, y: 5 },
        { x: 4, y: 9 },
      ],
    ]) {
      expect(connectsLogisticsPort(output, beltCells(points)!)).toBe(false)
      expect(canDrawBelt(base, { points })).toBe(false)
    }
    const scene: Scene = {
      ...base,
      belts: [
        {
          id: 'trunk',
          points: [
            { x: 1, y: 6 },
            { x: 10, y: 6 },
          ],
        },
        {
          id: 'branch',
          points: [
            { x: 4, y: 9 },
            { x: 4, y: 6 },
          ],
        },
      ],
    }
    expect(canPlaceScenePieces(scene)).toBe(true)
    expect(beltNetwork(scene).connectedPorts.has(output.key)).toBe(true)
    expect(beltConnections(scene, scene.belts[0]).logisticsOutput).toBeUndefined()
  })
})
