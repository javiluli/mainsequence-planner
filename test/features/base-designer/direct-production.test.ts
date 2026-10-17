import { describe, expect, it } from 'vitest'
import type { Scene } from '@/features/base-designer/model/scene'
import { analyzeProduction } from '@/features/base-designer/lib/production-analysis'
import { beltNetwork, portProductKey } from '@/features/base-designer/lib/belt-network'
import { canPlaceScenePieces, scenePlacementIssue } from '@/features/base-designer/lib/placement'
import { rotateGroup } from '@/features/base-designer/lib/scene-geometry'
import { logisticsPorts } from '@/features/base-designer/model/logistics'
import { readSceneDocument, writeSceneDocument } from '@/features/base-designer/lib/scene-document'

/** Three real titanium recipes receive through a trunk; the first can also accept a separate side cargo. */
function titaniumFactory(direct: boolean, extraSupply = false): Scene {
  const y = direct ? 5 : 6
  return {
    stations: [
      { id: 'floor', type: 'station_2x2_a', x: 0, y: 0 },
      { id: 'drone', type: 'drone', x: 0, y: -15, rotation: 0, cargo: ['T_TitaniumOre', null] },
      ...(extraSupply
        ? [
            {
              id: 'extra',
              type: 'drone' as const,
              x: -15,
              y: 0,
              rotation: 270 as const,
              cargo: direct ? ([null, 'T_TitaniumOre'] as const) : (['T_TitaniumOre', null] as const),
            },
          ]
        : []),
    ],
    buildings: [1, 10, 19].map((x, i) => ({
      id: 'refinery-' + i,
      stationId: 'floor',
      type: 'refinery',
      x,
      y,
      rotation: 0,
      recipeId: 'titanium_plates',
    })),
    splitters: [2, 11, 20].map((x, i) => ({ id: 'splitter-' + i, type: 'splitter', x, y: 4, rotation: 0 })),
    tunnels: [4, 13, 22].map((x, i) => ({
      id: 'output-' + i,
      type: 'underground',
      entry: { x, y: y + 1 },
      exit: { x: x + 2, y: y + 1 },
    })),
    belts: [
      {
        id: 'trunk',
        points: [
          { x: 6, y: -1 },
          { x: 6, y: 2 },
          { x: 1, y: 2 },
          { x: 1, y: 4 },
          { x: 25, y: 4 },
        ],
      },
      ...(!direct ? [2, 11, 20].map((x, i) => ({ id: 'input-' + i, points: [{ x, y: 5 }], heading: { x: 0, y: 1 } })) : []),
      ...(extraSupply
        ? [
            {
              id: 'extra-input',
              points: [
                { x: -1, y: y + 1 },
                { x: 0, y: y + 1 },
              ],
            },
          ]
        : []),
    ],
  }
}

/** A graph projection isolates allocation from routing; the factory above separately validates actual placement and sockets. */
function projectedFactory(
  links: [string, string[]][],
  capacities: [string, number][],
  sourceCells: string[],
  inputCells: string[][],
  splitters: Scene['splitters'] = [],
) {
  const original = titaniumFactory(false)
  const scene: Scene = {
    ...original,
    stations: original.stations.map((station) =>
      station.type === 'drone' ? { ...station, cargo: ['T_TitaniumOre', 'T_TitaniumOre'] as const } : station,
    ),
    buildings: inputCells.map((_, i) => ({ ...original.buildings[i % 3], id: 'receiver-' + i })),
    splitters,
  }
  const base = beltNetwork(original)
  const point = (cell: string) => {
    const [x, y] = cell.split(',').map(Number)
    return { x, y }
  }
  const bridge = (ownerId: string, portKey: string, cell: string, role: 'input' | 'output') => ({
    owner: { kind: 'belt' as const, id: 'projection' },
    ownerId,
    portKey,
    cell: point(cell),
    position: point(cell),
    role,
    active: true,
  })
  const portBridges = [
    ...sourceCells.map((cell, i) => bridge('drone', 'drone:cargo-' + i, cell, 'output')),
    ...inputCells.flatMap((cells, i) => cells.map((cell, face) => bridge('receiver-' + i, 'face-' + face, cell, 'input'))),
  ]
  return {
    scene,
    network: {
      ...base,
      links: new Map(links),
      capacities: new Map(capacities),
      portBridges,
      cellProducts: new Map(capacities.map(([cell]) => [cell, { items: ['T_TitaniumOre'], unknown: false }])),
      portProducts: new Map(
        portBridges.map((port) => [portProductKey(port.ownerId, port.portKey), { items: ['T_TitaniumOre'], unknown: false }]),
      ),
    },
  }
}

describe('Nominal join budgets', () => {
  it.each([60, 120])('adds incoming lanes within the outgoing %s/min cell limit', (limit) => {
    const cells = ['0,0', '0,1', '1,0', '2,0', '3,0', '4,0', '5,0', '6,0', '7,0']
    const { scene, network } = projectedFactory(
      [['0,0', ['1,0']], ['0,1', ['1,0']], ...cells.slice(2, -1).map((cell, i): [string, string[]] => [cell, [cells[i + 3]]])],
      cells.map((cell) => [cell, cell.startsWith('0,') ? 60 : limit]),
      ['0,0', '0,1'],
      cells.slice(3).map((cell) => [cell]),
    )
    const result = analyzeProduction(scene, network)
    expect([...result.machines.values()].map((machine) => machine.inputs[0].available)).toEqual(
      limit === 60 ? [20, 20, 20, 0, 0, 0] : [20, 20, 20, 20, 20, 20],
    )
    expect(result.products.find((row) => row.itemId === 'T_TitaniumPlates1')?.estimatedOutput).toBe(limit)
    const reversed = analyzeProduction(scene, {
      ...network,
      links: new Map([...network.links].reverse()),
      portBridges: [...network.portBridges].reverse(),
    })
    expect([...reversed.machines]).toEqual([...result.machines])
  })

  it('redistributes duplicate input quotas without reserving the same machine demand twice', () => {
    const { scene, network } = projectedFactory(
      [
        ['0,0', ['0,-1', '1,0', '0,1']],
        ['0,1', ['0,2']],
      ],
      ['0,0', '0,-1', '1,0', '0,1', '0,2'].map((cell) => [cell, 60]),
      ['0,0'],
      [['0,-1', '1,0'], ['0,1'], ['0,2']],
      [{ id: 'splitter', type: 'splitter', x: 0, y: 0, rotation: 0 }],
    )
    const result = analyzeProduction(scene, network)
    expect([...result.machines.values()].map((machine) => machine.inputs[0].available)).toEqual([20, 20, 20])
    expect(result.products.find((row) => row.itemId === 'T_TitaniumOre')).toMatchObject({ suppliedInput: 60, missingInput: 0 })
  })

  it('sums a split/rejoined supply once and respects the bottleneck after the join', () => {
    const { scene, network } = projectedFactory(
      [
        ['0,0', ['0,-1', '1,0']],
        ['0,-1', ['2,0']],
        ['1,0', ['2,0']],
        ['2,0', ['3,0']],
        ['3,0', ['4,0']],
        ['4,0', ['5,0']],
      ],
      ['0,0', '0,-1', '1,0', '2,0', '3,0', '4,0', '5,0'].map((cell) => [cell, cell === '2,0' ? 40 : 60]),
      ['0,0'],
      [['3,0'], ['4,0'], ['5,0']],
      [{ id: 'splitter', type: 'splitter', x: 0, y: 0, rotation: 0 }],
    )
    expect([...analyzeProduction(scene, network).machines.values()].map((machine) => machine.inputs[0].available)).toEqual([20, 20, 0])
  })

  it('retains equal splitter shares when another source completes one of its receivers', () => {
    const { scene, network } = projectedFactory(
      [
        ['0,0', ['0,-1', '1,0']],
        ['0,-1', ['2,0']],
        ['3,0', ['2,0']],
      ],
      ['0,0', '0,-1', '1,0', '2,0', '3,0'].map((cell) => [cell, cell === '0,0' || cell === '3,0' ? 20 : 60]),
      ['0,0', '3,0'],
      [['2,0'], ['1,0']],
      [{ id: 'splitter', type: 'splitter', x: 0, y: 0, rotation: 0 }],
    )
    // S delivers 10/10; T completes the first receiver. A join does not retroactively divert S's delivered share.
    expect([...analyzeProduction(scene, network).machines.values()].map((machine) => machine.inputs[0].available)).toEqual([20, 10])
  })
})

describe('Direct logistics production', () => {
  it('pools one finite recipe across separate output faces without multiplying its 40/min production', () => {
    const scene: Scene = {
      stations: [
        { id: 'floor', type: 'station_2x2_a', x: 0, y: 0 },
        { id: 'drone', type: 'drone', x: 0, y: -15, rotation: 0, cargo: [null, 'T_CobaltOre'] },
      ],
      buildings: [
        { id: 'source', type: 'enrichment', stationId: 'floor', x: 1, y: 1, rotation: 0, recipeId: 'enriched_cobalt_ore' },
        ...[7, 11, 15, 19, 23].map((x, i) => ({
          id: 'south-' + i,
          type: 'refinery' as const,
          stationId: 'floor',
          x,
          y: 13,
          rotation: 0 as const,
          recipeId: 'enriched_cobalt_plates',
        })),
        { id: 'east', type: 'refinery', stationId: 'floor', x: 14, y: 6, rotation: 0, recipeId: 'enriched_cobalt_plates' },
      ],
      belts: [
        {
          id: 'raw',
          points: [
            { x: 7, y: -1 },
            { x: 7, y: 0 },
          ],
        },
        {
          id: 'east-feed',
          points: [
            { x: 10, y: 7 },
            { x: 13, y: 7 },
          ],
        },
        {
          id: 'south-feed',
          points: [
            { x: 7, y: 10 },
            { x: 7, y: 11 },
            { x: 28, y: 11 },
          ],
        },
        ...[8, 12, 16, 20, 24].map((x, i) => ({ id: 'branch-' + i, points: [{ x, y: 12 }], heading: { x: 0, y: 1 } })),
      ],
      splitters: [8, 12, 16, 20, 24].map((x, i) => ({ id: 'splitter-' + i, type: 'splitter', x, y: 11, rotation: 0 })),
    }
    expect(canPlaceScenePieces(scene)).toBe(true)
    const analysis = analyzeProduction(scene, beltNetwork(scene))
    expect(analysis.machines.get('source')?.state).toBe('ready')
    const supplied = [...analysis.machines].filter(([id]) => id !== 'source').map(([, machine]) => machine.inputs[0].available)
    expect(supplied).toEqual([10, 10, 5, 2.5, 2.5, 10])
    expect(supplied.reduce<number>((sum, amount) => sum + (amount ?? 0), 0)).toBe(40)
  })

  it('pools two input faces from the same source without counting its demand twice, in every orientation', () => {
    let scene: Scene = {
      stations: [
        { id: 'floor', type: 'station_2x2_a', x: 0, y: 0 },
        { id: 'drone', type: 'drone', x: 0, y: -15, rotation: 0, cargo: ['T_TitaniumOre', null] },
      ],
      buildings: [{ id: 'receiver', type: 'refinery', stationId: 'floor', x: 6, y: 8, rotation: 0, recipeId: 'titanium_plates' }],
      splitters: [{ id: 'splitter', type: 'splitter', x: 7, y: 4, rotation: 90 }],
      belts: [
        {
          id: 'feed',
          points: [
            { x: 6, y: -1 },
            { x: 6, y: 0 },
            { x: 7, y: 0 },
            { x: 7, y: 3 },
          ],
        },
        {
          id: 'south',
          points: [
            { x: 7, y: 5 },
            { x: 7, y: 7 },
          ],
        },
        {
          id: 'east',
          points: [
            { x: 8, y: 4 },
            { x: 9, y: 4 },
            { x: 9, y: 9 },
          ],
        },
      ],
    }
    for (let turn = 0; turn < 4; turn++) {
      expect(canPlaceScenePieces(scene)).toBe(true)
      const analysis = analyzeProduction(scene, beltNetwork(scene))
      expect(analysis.machines.get('receiver')).toMatchObject({ state: 'ready', inputs: [{ available: 20 }] })
      expect(analysis.products.find((row) => row.itemId === 'T_TitaniumOre')).toMatchObject({ suppliedInput: 20, requiredInput: 20 })
      scene = rotateGroup(scene)
    }
  })

  it.each([false, true])('uses direct splitter inputs and adjacent tunnel outputs consistently (direct=%s)', (direct) => {
    const scene = titaniumFactory(direct)
    expect(canPlaceScenePieces(scene)).toBe(true)
    const network = beltNetwork(scene)
    for (let i = 0; i < 3; i++) {
      expect(network.portProducts.get(portProductKey('refinery-' + i, '0:1'))).toEqual({ items: ['T_TitaniumOre'], unknown: false })
      expect(network.portRoles.get('refinery-' + i)?.['1:1']).toBe('output')
    }
    const analysis = analyzeProduction(scene, network)
    expect([...analysis.machines.values()].map((machine) => machine.inputs[0].available)).toEqual([20, 20, 20])
    expect(analysis.products.find((row) => row.itemId === 'T_TitaniumPlates1')).toMatchObject({ output: 60, estimatedOutput: 60 })
  })

  it('keeps known supply when an additional matching ingredient arrives at another direct face', () => {
    const scene = titaniumFactory(true, true)
    expect(canPlaceScenePieces(scene)).toBe(true)
    const network = beltNetwork(scene)
    expect(network.portProducts.get(portProductKey('refinery-0', '0:1'))).toEqual({ items: ['T_TitaniumOre'], unknown: false })
    expect(network.portProducts.get(portProductKey('refinery-0', '3:1'))).toEqual({ items: ['T_TitaniumOre'], unknown: false })
    const analysis = analyzeProduction(scene, network)
    expect([...analysis.machines.values()].map((machine) => machine.inputs[0].available)).toEqual([20, 20, 20])
    expect(analysis.products.find((row) => row.itemId === 'T_TitaniumPlates1')).toMatchObject({ output: 60, estimatedOutput: 60 })
    expect(analysis.products.find((row) => row.itemId === 'T_TitaniumOre')).toMatchObject({ suppliedInput: 60, missingInput: 0 })
  })
})

describe('Tunnel output at a directed belt junction', () => {
  it.each(['underground', 'underground_mk2'] as const)(
    'delivers %s across a connected station gap into a T in every orientation',
    (type) => {
      let scene: Scene = {
        stations: [
          { id: 'upper', x: 0, y: 0 },
          { id: 'lower', x: 0, y: 16 },
          { id: 'drone', type: 'drone', x: 0, y: -15, rotation: 0, cargo: ['T_TitaniumOre', null] },
        ],
        buildings: [{ id: 'receiver', type: 'refinery', stationId: 'lower', x: 11, y: 17, rotation: 0, recipeId: 'titanium_plates' }],
        splitters: [{ id: 'splitter', type: 'splitter_mk2', x: 6, y: 10, rotation: 90, disabledOutputs: ['east', 'north'] }],
        tunnels: [{ id: 'tunnel', type, entry: { x: 4, y: 12 }, exit: { x: 4, y: 17 } }],
        belts: [
          {
            id: 'feed',
            type: 'conveyor_mk2',
            points: [
              { x: 6, y: -1 },
              { x: 6, y: 9 },
            ],
          },
          {
            id: 'bend',
            type: 'conveyor_mk2',
            points: [
              { x: 5, y: 10 },
              { x: 4, y: 10 },
              { x: 4, y: 11 },
            ],
          },
          {
            id: 'carrier',
            type: 'conveyor_mk2',
            points: [
              { x: 1, y: 18 },
              { x: 10, y: 18 },
            ],
          },
          {
            id: 'branch',
            points: [
              { x: 4, y: 22 },
              { x: 4, y: 18 },
            ],
          },
        ],
      }
      for (let turn = 0; turn < 4; turn++) {
        expect(canPlaceScenePieces(scene)).toBe(true)
        expect(readSceneDocument(JSON.parse(writeSceneDocument(scene)))).toEqual(scene)
        const port = logisticsPorts(scene).find((port) => port.owner.id === 'tunnel' && port.role === 'output')!,
          key = (point: { x: number; y: number }) => point.x + ',' + point.y,
          network = beltNetwork(scene),
          analysis = analyzeProduction(scene, network)
        expect(network.connectedPorts.has(port.key)).toBe(true)
        expect(network.links.get(key(port.at))).toEqual([key(port.cell)])
        expect(network.links.get(key(port.cell))).toHaveLength(1)
        expect(network.capacities.get(key(port.cell))).toBe(120)
        expect(network.cellProducts.get(key(port.cell))).toEqual({ items: ['T_TitaniumOre'], unknown: false })
        expect(
          network.attachments.find(
            (attachment) =>
              attachment.owner.id === 'tunnel' && attachment.points[0].x === port.at.x && attachment.points[0].y === port.at.y,
          )?.active,
        ).toBe(true)
        expect(analysis.machines.get('receiver')).toMatchObject({ state: 'ready', inputs: [{ available: 20 }] })
        expect(analysis.products.find((row) => row.itemId === 'T_TitaniumPlates1')).toMatchObject({ estimatedOutput: 20 })
        expect(analysis.products.find((row) => row.itemId === 'T_TitaniumOre')).toMatchObject({
          suppliedInput: 20,
          requiredInput: 20,
          missingInput: 0,
        })
        const disabled: Scene = { ...scene, tunnels: scene.tunnels!.map((tunnel) => ({ ...tunnel, disabledOutputs: ['exit'] })) },
          disabledNetwork = beltNetwork(disabled)
        expect(disabledNetwork.connectedPorts.has(port.key)).toBe(true)
        expect(disabledNetwork.links.get(key(port.at)) ?? []).not.toContain(key(port.cell))
        expect(analyzeProduction(disabled, disabledNetwork).machines.get('receiver')).toMatchObject({ state: 'missing-input' })
        const reverseOrder = { ...scene, belts: [...scene.belts].reverse() }
        expect([...beltNetwork(reverseOrder).connectedPorts]).toEqual([...network.connectedPorts])
        expect(analyzeProduction(reverseOrder, beltNetwork(reverseOrder))).toEqual(analysis)
        scene = rotateGroup(scene)
      }
    },
  )
})

describe('Fixed tunnel output merging into a corner', () => {
  it.each(['conveyor', 'conveyor_mk2'] as const)('adds both feeds within the %s outgoing limit', (type) => {
    const scene: Scene = {
      stations: [
        { id: 'floor', type: 'station_2x2_a', x: 0, y: 0 },
        { id: 'upper', type: 'drone', x: 16, y: -15, rotation: 0, cargo: ['T_TitaniumOre', null] },
        { id: 'lower', type: 'drone', x: 16, y: 31, rotation: 180, cargo: [null, 'T_TitaniumOre'] },
      ],
      buildings: [2, 6, 10, 14, 18, 22].map((x, i) => ({
        id: 'receiver-' + i,
        type: 'refinery',
        stationId: 'floor',
        x,
        y: 9,
        rotation: 0,
        recipeId: 'titanium_plates',
      })),
      splitters: [3, 7, 11, 15, 19, 23].map((x, i) => ({
        id: 'splitter-' + i,
        type: 'splitter_mk2',
        x,
        y: 7,
        rotation: 180,
        disabledOutputs: ['south'],
      })),
      tunnels: [{ id: 'tunnel', type: 'underground', entry: { x: 26, y: 1 }, exit: { x: 26, y: 6 } }],
      belts: [
        {
          id: 'upper-feed',
          points: [
            { x: 22, y: -1 },
            { x: 22, y: 0 },
            { x: 26, y: 0 },
          ],
        },
        {
          id: 'lower-feed',
          points: [
            { x: 22, y: 30 },
            { x: 22, y: 13 },
            { x: 26, y: 13 },
            { x: 26, y: 12 },
          ],
        },
        {
          id: 'carrier',
          type,
          points: [
            { x: 26, y: 12 },
            { x: 26, y: 7 },
            { x: 1, y: 7 },
          ],
        },
        ...[3, 7, 11, 15, 19, 23].map((x, i) => ({ id: 'input-' + i, points: [{ x, y: 8 }], heading: { x: 0, y: 1 } })),
      ],
    }
    expect(canPlaceScenePieces(scene), scenePlacementIssue(scene) ?? undefined).toBe(true)
    const analysis = analyzeProduction(scene, beltNetwork(scene)),
      expected = type === 'conveyor' ? 60 : 120
    expect(analysis.products.find((row) => row.itemId === 'T_TitaniumPlates1')).toMatchObject({ estimatedOutput: expected })
    expect(analysis.products.find((row) => row.itemId === 'T_TitaniumOre')).toMatchObject({
      suppliedInput: expected,
      requiredInput: 120,
      missingInput: 120 - expected,
    })
    const disabled: Scene = { ...scene, tunnels: scene.tunnels!.map((tunnel) => ({ ...tunnel, disabledOutputs: ['exit'] })) }
    expect(analyzeProduction(disabled, beltNetwork(disabled)).products.find((row) => row.itemId === 'T_TitaniumPlates1')).toMatchObject({
      estimatedOutput: 60,
    })
  })
})
