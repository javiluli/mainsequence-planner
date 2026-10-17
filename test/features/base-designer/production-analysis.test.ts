import { describe, expect, it } from 'vitest'
import type { Scene } from '@/features/base-designer/model/scene'
import { BUILDINGS, buildingPorts, type BuildingType } from '@/features/base-designer/model/buildings'
import { recipeForBuilding } from '@/features/base-designer/lib/building-recipes'
import { rotateGroup } from '@/features/base-designer/lib/scene-geometry'
import { beltNetwork } from '@/features/base-designer/lib/belt-network'
import { canPlaceScenePieces } from '@/features/base-designer/lib/placement'
import { analyzeProduction, distributeSplitterFlow, estimatedMachineOutput } from '@/features/base-designer/lib/production-analysis'

/** Valid physical routes and real recipes exercise shared capacity without synthetic catalog records. */
function rawLane(mk2 = false): Scene {
  return {
    stations: [
      { id: 'floor', type: 'station_2x2_a', x: 0, y: 0 },
      { id: 'drone', type: 'drone', x: 0, y: -15, rotation: 0, cargo: ['T_CobaltOre', null] },
    ],
    buildings: [1, 7, 13, 19].map((x, i) => ({
      id: 'receiver-' + i,
      type: 'refinery',
      stationId: 'floor',
      x,
      y: 6,
      rotation: 0,
      recipeId: 'cobalt_plates',
    })),
    belts: [
      {
        id: 'feed',
        type: mk2 ? 'conveyor_mk2' : 'conveyor',
        points: [
          { x: 6, y: -1 },
          { x: 6, y: 2 },
          { x: 0, y: 2 },
          { x: 0, y: 4 },
          { x: 25, y: 4 },
        ],
      },
      ...[2, 8, 14, 20].map((x, i) => ({
        id: 'branch-' + i,
        type: mk2 ? ('conveyor_mk2' as const) : ('conveyor' as const),
        points: [{ x, y: 5 }],
        heading: { x: 0, y: 1 },
      })),
    ],
    splitters: [2, 8, 14, 20].map((x, i) => ({ id: 'splitter-' + i, type: mk2 ? 'splitter_mk2' : 'splitter', x, y: 4, rotation: 0 })),
  }
}

/** One real cargo passes an inline splitter/tunnel and joins a trunk whose upstream arm has no supplier. */
function joinedLane(mk2 = false, tunnelMk2 = mk2): Scene {
  const original = rawLane(mk2)
  return {
    ...original,
    buildings: original.buildings.map((building) => ({ ...building, y: 11 })),
    splitters: [
      ...(original.splitters ?? []).map((splitter) => ({ ...splitter, y: 9 })),
      { id: 'upper-splitter', type: mk2 ? 'splitter_mk2' : 'splitter', x: 1, y: 2, rotation: 90 },
    ],
    tunnels: [{ id: 'tunnel', type: tunnelMk2 ? 'underground_mk2' : 'underground', entry: { x: 1, y: 4 }, exit: { x: 1, y: 7 } }],
    belts: [
      {
        id: 'feed',
        type: mk2 ? 'conveyor_mk2' : 'conveyor',
        points: [
          { x: 6, y: -1 },
          { x: 6, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 3 },
        ],
      },
      {
        id: 'after-tunnel',
        type: mk2 ? 'conveyor_mk2' : 'conveyor',
        points: [
          { x: 1, y: 8 },
          { x: 1, y: 9 },
        ],
      },
      {
        id: 'trunk',
        type: mk2 ? 'conveyor_mk2' : 'conveyor',
        points: [
          { x: 0, y: 9 },
          { x: 25, y: 9 },
        ],
      },
      ...original.belts.slice(1).map((belt) => ({ ...belt, points: belt.points.map((point) => ({ ...point, y: 10 })) })),
    ],
  }
}

/** Every placed body uses its actual outward socket; only the three catalog crafters can claim production. */
function joinedReceiver(type: BuildingType, recipeId?: string): Scene {
  const original = rawLane(),
    building = { id: 'receiver', stationId: 'floor', type, x: 12, y: 12, rotation: 0 as const, ...(recipeId && { recipeId }) },
    port = buildingPorts(building).find((port) => port.normal.y === 1)!,
    row = port.cell.y + 2,
    recipe = recipeForBuilding(type, recipeId)
  return {
    stations: original.stations.map((station) =>
      station.type === 'drone' ? { ...station, cargo: [recipe?.inputs[0].id ?? 'T_CobaltOre', null] as const } : station,
    ),
    buildings: [building],
    splitters: [{ id: 'splitter', type: 'splitter', x: port.cell.x, y: row, rotation: 0 }],
    belts: [
      {
        id: 'feed',
        points: [
          { x: 6, y: -1 },
          { x: 6, y: 1 },
          { x: 1, y: 1 },
          { x: 1, y: row },
        ],
      },
      {
        id: 'trunk',
        points: [
          { x: 0, y: row },
          { x: 29, y: row },
        ],
      },
      { id: 'input', points: [{ x: port.cell.x, y: row - 1 }, port.cell] },
    ],
  }
}

/** Missing raw input makes the finite producer conditional even if its receiver also lacks other ingredients. */
function machineLane(count: number): Scene {
  return {
    stations: [{ id: 'floor', type: 'station_2x2_a', x: 0, y: 0 }],
    buildings: [
      { id: 'source', type: 'refinery', stationId: 'floor', x: 1, y: 1, rotation: 0, recipeId: 'cobalt_plates' },
      ...Array.from({ length: count }, (_, i) => ({
        id: 'receiver-' + i,
        type: 'assembler' as const,
        stationId: 'floor',
        x: 7 + i * 8,
        y: 6,
        rotation: 0 as const,
        recipeId: 'detector_array',
      })),
    ],
    belts: [
      {
        id: 'feed',
        type: 'conveyor_mk2',
        points: [
          { x: 4, y: 2 },
          { x: 6, y: 2 },
          { x: 6, y: 4 },
          { x: 22, y: 4 },
        ],
      },
      ...Array.from({ length: count }, (_, i) => ({
        id: 'branch-' + i,
        type: 'conveyor_mk2' as const,
        points: [{ x: 8 + i * 8, y: 5 }],
        heading: { x: 0, y: 1 },
      })),
    ],
    splitters: Array.from({ length: count }, (_, i) => ({ id: 'splitter-' + i, type: 'splitter_mk2', x: 8 + i * 8, y: 4, rotation: 0 })),
  }
}

/** A real 40/min enrichment recipe feeds its downstream refinery; raw input is supplied by the second cargo. */
function enrichedLane(): Scene {
  return {
    stations: rawLane().stations.map((station) =>
      station.type === 'drone' ? { ...station, cargo: [null, 'T_CobaltOre'] as const } : station,
    ),
    buildings: [
      { id: 'source', type: 'enrichment', stationId: 'floor', x: 1, y: 1, rotation: 0, recipeId: 'enriched_cobalt_ore' },
      { id: 'receiver', type: 'refinery', stationId: 'floor', x: 6, y: 13, rotation: 0, recipeId: 'enriched_cobalt_plates' },
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
        id: 'out',
        points: [
          { x: 7, y: 10 },
          { x: 7, y: 12 },
        ],
      },
    ],
  }
}
/** Validate physical fixtures before inspecting individual nominal allocations. */
function inspect(scene: Scene) {
  expect(canPlaceScenePieces(scene)).toBe(true)
  const network = beltNetwork(scene)
  return { network, analysis: analyzeProduction(scene, network) }
}

const allocations = (scene: Scene) => [...inspect(scene).analysis.machines.values()].map((machine) => machine.inputs[0].available)

describe('Machine input status and nominal allocation', () => {
  it.each([false, true])('reuses a confirmed network without consuming or mutating its budgets (MK2=%s)', (mk2) => {
    const scene = rawLane(mk2),
      network = beltNetwork(scene),
      originalScene = structuredClone(scene),
      originalNetwork = structuredClone(network),
      first = analyzeProduction(scene, network)

    expect(first.products.find((row) => row.itemId === 'T_CobaltPlates')?.estimatedOutput).toBe(mk2 ? 80 : 60)
    expect([...first.machines.values()].map((machine) => machine.inputs[0].available)).toEqual(mk2 ? [20, 20, 20, 20] : [20, 20, 10, 10])
    expect(analyzeProduction(scene, network)).toEqual(first)
    expect(scene).toEqual(originalScene)
    expect(network).toEqual(originalNetwork)
  })

  it('allocates an MK2 single-feed tunnel T join with an empty upstream arm in every orientation', () => {
    let scene = joinedLane(true)
    for (let turn = 0; turn < 4; turn++) {
      const { network, analysis } = inspect(scene)
      expect(network.runs.get('after-tunnel')?.every((run) => run.active)).toBe(true)
      expect([...analysis.machines.values()].map((machine) => machine.inputs[0].available)).toEqual([20, 20, 20, 20])
      expect(analysis.products.find((row) => row.itemId === 'T_CobaltPlates')?.estimatedOutput).toBe(80)
      scene = rotateGroup(scene)
    }
  })

  it('delivers from an MK1 tunnel mouth directly into a passing lane in all four orientations', () => {
    const original = joinedLane()
    let scene: Scene = {
      ...original,
      tunnels: original.tunnels?.map((tunnel) => ({ ...tunnel, exit: { x: 1, y: 8 } })),
      belts: original.belts.filter((belt) => belt.id !== 'after-tunnel'),
    }
    for (let turn = 0; turn < 4; turn++) {
      const { network, analysis } = inspect(scene)
      expect(network.attachments.some((attachment) => attachment.owner.kind === 'tunnel' && attachment.active)).toBe(true)
      expect([...analysis.machines.values()].map((machine) => machine.inputs[0].available)).toEqual([20, 20, 10, 10])
      expect(analysis.products.find((row) => row.itemId === 'T_CobaltPlates')?.estimatedOutput).toBe(60)
      scene = rotateGroup(scene)
    }
  })

  it('preserves a lateral MK1 tunnel limit and the physical attachment when its output is disabled', () => {
    const original = joinedLane(true, false),
      scene: Scene = {
        ...original,
        tunnels: original.tunnels?.map((tunnel) => ({ ...tunnel, exit: { x: 1, y: 8 } })),
        belts: original.belts.filter((belt) => belt.id !== 'after-tunnel'),
      }
    expect(allocations(scene)).toEqual([20, 20, 10, 10])
    const disabled = { ...scene, tunnels: scene.tunnels?.map((tunnel) => ({ ...tunnel, disabledOutputs: ['exit'] })) }
    const { network, analysis } = inspect(disabled)
    expect(network.attachments.filter((attachment) => attachment.owner.kind === 'tunnel')).toHaveLength(2)
    expect(network.attachments.filter((attachment) => attachment.owner.kind === 'tunnel').every((attachment) => !attachment.active)).toBe(
      true,
    )
    expect([...analysis.machines.values()].map((machine) => machine.inputs[0].available)).toEqual([0, 0, 0, 0])
    expect(analysis.products.find((row) => row.itemId === 'T_CobaltPlates')?.estimatedOutput).toBe(0)
  })

  it('preserves the MK1 tunnel bottleneck before a MK2 trunk join, independent of collection order', () => {
    const scene = joinedLane(true, false)
    expect(allocations(scene)).toEqual([20, 20, 10, 10])
    expect(allocations({ ...scene, belts: [...scene.belts].reverse(), splitters: [...(scene.splitters ?? [])].reverse() })).toEqual([
      20, 20, 10, 10,
    ])
  })

  it.each([
    ['refinery', 'cobalt_plates'],
    ['assembler', 'basic_motor'],
    ['enrichment', 'enriched_cobalt_ore'],
  ] as const)('allocates the real %s recipe after a T join in all four orientations', (type, recipeId) => {
    let scene = joinedReceiver(type, recipeId)
    const recipe = recipeForBuilding(type, recipeId)!
    for (let turn = 0; turn < 4; turn++) {
      const { analysis } = inspect(scene)
      expect(analysis.machines.get('receiver')).toMatchObject({
        state: 'ready',
        inputs: [{ available: recipe.inputs[0].amount_per_minute, state: 'supplied' }],
      })
      expect(analysis.products.find((row) => row.itemId === recipe.output.id)?.estimatedOutput).toBe(recipe.output.amount_per_minute)
      scene = rotateGroup(scene)
    }
  })

  it.each(
    Object.keys(BUILDINGS).filter((type): type is BuildingType => type in BUILDINGS && BUILDINGS[type as BuildingType].crafterId === null),
  )('connects %s sockets without inventing a recipe or output', (type) => {
    let scene = joinedReceiver(type)
    for (let turn = 0; turn < 4; turn++) {
      const { network, analysis } = inspect(scene)
      expect(network.portBridges.filter((port) => port.ownerId === 'receiver')).toMatchObject([{ role: 'input' }])
      expect(analysis.machines.get('receiver')).toMatchObject({ state: type === 'container' ? 'ready' : 'unknown', inputs: [] })
      expect(analysis.products).toEqual([])
      scene = rotateGroup(scene)
    }
  })

  it('shares splitter flow with a BOX accepting incoming items instead of reserving it all for recipes', () => {
    const original = rawLane(),
      scene: Scene = {
        ...original,
        buildings: original.buildings.map((building, i) => (i === 0 ? { ...building, type: 'container', recipeId: undefined } : building)),
      },
      { analysis } = inspect(scene)
    expect(analysis.machines.get('receiver-0')).toMatchObject({
      state: 'ready',
      reception: { items: [{ itemId: 'T_CobaltOre', available: 30 }], unknown: false },
    })
    expect(scene.buildings.slice(1).map((building) => analysis.machines.get(building.id)?.inputs[0].available)).toEqual([15, 7.5, 7.5])
    expect(analysis.products.find((product) => product.itemId === 'T_CobaltPlates')?.estimatedOutput).toBe(30)
  })

  it.each(['cargo', 'splitter', 'tunnel'] as const)('stops a joined supply when its %s output is disabled', (kind) => {
    const original = joinedLane(),
      scene: Scene = {
        ...original,
        stations:
          kind === 'cargo'
            ? original.stations.map((station) => (station.type === 'drone' ? { ...station, disabledOutputs: ['cargo-0'] } : station))
            : original.stations,
        splitters:
          kind === 'splitter'
            ? original.splitters?.map((splitter) =>
                splitter.id === 'upper-splitter' ? { ...splitter, disabledOutputs: ['east'] } : splitter,
              )
            : original.splitters,
        tunnels: kind === 'tunnel' ? original.tunnels?.map((tunnel) => ({ ...tunnel, disabledOutputs: ['exit'] })) : original.tunnels,
      }
    const { analysis } = inspect(scene)
    expect([...analysis.machines.values()].map((machine) => machine.state)).toEqual([
      'missing-input',
      'missing-input',
      'missing-input',
      'missing-input',
    ])
    expect(analysis.products.find((row) => row.itemId === 'T_CobaltPlates')?.estimatedOutput).toBe(0)
    expect(analysis.products.find((row) => row.itemId === 'T_CobaltOre')).toMatchObject({ suppliedInput: 0, missingInput: 80 })
  })

  it('does not duplicate supply when a branch rejoins the same downstream lane', () => {
    const original = joinedLane()
    const { analysis } = inspect({
      ...original,
      belts: [
        ...original.belts,
        {
          id: 'return',
          points: [
            { x: 2, y: 8 },
            { x: 2, y: 5 },
            { x: 24, y: 5 },
            { x: 24, y: 9 },
          ],
        },
      ],
    })
    expect([...analysis.machines.values()].map((machine) => machine.inputs[0].available)).toEqual([20, 20, 10, 10])
    expect(analysis.products.find((row) => row.itemId === 'T_CobaltPlates')?.estimatedOutput).toBe(60)
  })

  it('keeps a finite machine output shared after joining an otherwise empty trunk', () => {
    const original = enrichedLane()
    const { analysis } = inspect({
      ...original,
      buildings: [
        original.buildings[0],
        ...[7, 11, 15, 19, 23].map((x, i) => ({
          id: 'receiver-' + i,
          stationId: 'floor',
          type: 'refinery' as const,
          x,
          y: 17,
          rotation: 0 as const,
          recipeId: 'enriched_cobalt_plates',
        })),
      ],
      splitters: [8, 12, 16, 20, 24].map((x, i) => ({ id: 'splitter-' + i, type: 'splitter' as const, x, y: 15, rotation: 0 as const })),
      belts: [
        original.belts[0],
        {
          id: 'output',
          points: [
            { x: 7, y: 10 },
            { x: 7, y: 11 },
            { x: 5, y: 11 },
            { x: 5, y: 15 },
          ],
        },
        {
          id: 'trunk',
          points: [
            { x: 0, y: 15 },
            { x: 28, y: 15 },
          ],
        },
        ...[8, 12, 16, 20, 24].map((x, i) => ({ id: 'branch-' + i, points: [{ x, y: 16 }], heading: { x: 0, y: 1 } })),
      ],
    })
    expect(analysis.machines.get('source')?.state).toBe('ready')
    expect([...analysis.machines.values()].slice(1).map((machine) => machine.inputs[0].available)).toEqual([10, 10, 10, 5, 5])
    expect(analysis.products.find((row) => row.itemId === 'T_CobaltPlates')?.estimatedOutput).toBe(120)
  })

  it('shares equally at splitters, caps satisfied exits and preserves whole-base nominal totals', () => {
    const { analysis } = inspect(rawLane())
    expect([...analysis.machines.values()].map((machine) => machine.inputs[0].available)).toEqual([20, 20, 10, 10])
    expect([...analysis.machines.values()].map((machine) => machine.state)).toEqual(['ready', 'ready', 'shortfall', 'shortfall'])
    expect(analysis.products).toEqual([
      { itemId: 'T_CobaltPlates', output: 80, demand: 0, estimatedOutput: 60, suppliedInput: 0, requiredInput: 0, missingInput: 0 },
      { itemId: 'T_CobaltOre', output: 0, demand: 80, estimatedOutput: 0, suppliedInput: 60, requiredInput: 80, missingInput: 20 },
    ])
    expect(analysis.energy).toEqual({ known: 18, unknown: 0 })
  })

  it('keeps a MK1 tunnel as a 60/min limit within MK2 transport', () => {
    const original = rawLane(true)
    expect(
      allocations({
        ...original,
        // The return lane passes the north faces; disable them to test the tunnel without a real loop.
        splitters: original.splitters?.map((piece) => ({ ...piece, disabledOutputs: ['north'] })),
        tunnels: [{ id: 'tunnel', type: 'underground', entry: { x: 6, y: 0 }, exit: { x: 6, y: 2 } }],
        belts: [
          { id: 'before', type: 'conveyor_mk2', points: [{ x: 6, y: -1 }], heading: { x: 0, y: 1 } },
          {
            id: 'after',
            type: 'conveyor_mk2',
            points: [
              { x: 6, y: 3 },
              { x: 0, y: 3 },
              { x: 0, y: 4 },
              { x: 25, y: 4 },
            ],
          },
          ...original.belts.slice(1),
        ],
      }),
    ).toEqual([20, 20, 10, 10])
  })

  it('keeps a MK1 inline splitter as a limit without changing other levels', () => {
    const original = rawLane(true)
    expect(
      allocations({ ...original, splitters: original.splitters?.map((piece, i) => (i ? piece : { ...piece, type: 'splitter' })) }),
    ).toEqual([20, 20, 10, 10])
  })

  it('adds a second supply where it joins the lane without losing the existing allocations', () => {
    const original = rawLane()
    const { analysis } = inspect({
      ...original,
      stations: original.stations.map((station) =>
        station.type === 'drone' ? { ...station, cargo: ['T_CobaltOre', 'T_CobaltOre'] as const } : station,
      ),
      belts: [
        ...original.belts,
        {
          id: 'alternative',
          points: [
            { x: 7, y: -1 },
            { x: 7, y: 2 },
            { x: 18, y: 2 },
            { x: 18, y: 4 },
          ],
        },
      ],
    })
    // This join is after receiver-2: extra supply cannot travel backwards to its branch.
    expect([...analysis.machines.values()].map((machine) => machine.inputs[0].available)).toEqual([20, 20, 10, 20])
    expect(analysis.products.find((row) => row.itemId === 'T_CobaltPlates')?.estimatedOutput).toBe(70)
  })

  it('distinguishes a missing second ingredient from an incompatible supplied item', () => {
    const { analysis } = inspect(machineLane(1)),
      machine = analysis.machines.get('receiver-0')!
    expect(machine.state).toBe('missing-input')
    expect(machine.unexpectedItems).toEqual([])
    expect(machine.inputs.find((input) => input.itemId === 'T_Graphene')?.state).toBe('missing')
    expect(machine.inputs.find((input) => input.itemId === 'T_CobaltPlates')).toMatchObject({ state: 'blocked', available: 0 })
  })

  it('releases every quota of an incomplete receiver for the remaining valid receivers', () => {
    const original = rawLane()
    const { analysis } = inspect({
      ...original,
      stations: original.stations.map((station) =>
        station.type === 'drone' ? { ...station, cargo: ['T_TitaniumOre', null] as const } : station,
      ),
      buildings: original.buildings.map((building, i) => ({ ...building, recipeId: i ? 'titanium_plates' : 'iridium_plates' })),
    })
    expect(analysis.machines.get('receiver-0')).toMatchObject({ state: 'missing-input', unexpectedItems: [] })
    expect(analysis.machines.get('receiver-0')?.inputs.find((input) => input.itemId === 'T_TitaniumOre')).toMatchObject({
      state: 'blocked',
      available: 0,
    })
    expect([1, 2, 3].map((i) => analysis.machines.get('receiver-' + i)?.inputs[0].available)).toEqual([20, 20, 20])
    expect(analysis.products.find((row) => row.itemId === 'T_IridiumPlates2')?.estimatedOutput).toBe(0)
    expect(estimatedMachineOutput(analysis.machines.get('receiver-0')!, 20)).toBe(0)
    expect(analysis.products.find((row) => row.itemId === 'T_IridiumOre')?.missingInput).toBe(40)
    expect(analysis.products.find((row) => row.itemId === 'T_TitaniumOre')?.missingInput).toBe(0)
  })

  it('marks a foreign product red and redistributes the blocked exit', () => {
    const original = rawLane()
    const { analysis } = inspect({
      ...original,
      buildings: original.buildings.map((building, i) => (i ? building : { ...building, type: 'assembler', recipeId: 'detector_array' })),
    })
    expect(analysis.machines.get('receiver-0')).toMatchObject({ state: 'wrong-item', unexpectedItems: ['T_CobaltOre'] })
    expect([1, 2, 3].map((i) => analysis.machines.get('receiver-' + i)?.inputs[0].available)).toEqual([20, 20, 20])
  })

  it('shows no recipe and an unassigned provider as indeterminate', () => {
    const original = machineLane(1)
    const { analysis } = inspect({
      ...original,
      buildings: original.buildings.map((piece) => (piece.id === 'source' ? { ...piece, recipeId: undefined } : piece)),
    })
    expect(analysis.machines.get('source')).toMatchObject({ state: 'unknown', inputs: [] })
    expect(analysis.machines.get('receiver-0')?.inputs.every((input) => input.available === null)).toBe(true)
    expect(analysis.machines.get('receiver-0')?.state).toBe('unknown')
  })

  it('redistributes equal shares without consuming a disabled or saturated exit', () => {
    expect(distributeSplitterFlow(60, [30, 30, 30])).toEqual([20, 20, 20])
    expect(distributeSplitterFlow(60, [0, 60, 60])).toEqual([0, 30, 30])
    expect(distributeSplitterFlow(120, [0, 120, 120])).toEqual([0, 60, 60])
    expect(distributeSplitterFlow(60, [10, 60, 60])).toEqual([10, 25, 25])
  })

  it('orders receivers by their directed lane and uses placement order for an equal-distance tie', () => {
    const scene = rawLane(),
      { network } = inspect(scene)
    // Isolate allocation from hit geometry: real catalog demands on one directed lane, including a shared-cell tie.
    const cells = ['0,0', '1,0', '2,0']
    const lane = {
      ...network,
      links: new Map([
        ['0,0', ['1,0']],
        ['1,0', ['2,0']],
      ]),
      capacities: new Map(cells.map((cell) => [cell, 60])),
      cellProducts: new Map(cells.map((cell) => [cell, { items: ['T_CobaltOre'], unknown: false }])),
      portBridges: network.portBridges.map((port) => ({
        ...port,
        owner: { kind: 'belt' as const, id: 'feed' },
        cell:
          port.ownerId === 'drone'
            ? { x: 0, y: 0 }
            : { x: port.ownerId === 'receiver-0' ? 0 : port.ownerId === 'receiver-1' ? 1 : 2, y: 0 },
      })),
    }
    const result = analyzeProduction(scene, lane)
    expect([...result.machines.values()].map((machine) => machine.inputs[0].available)).toEqual([20, 20, 20, 0])
    const reversed = analyzeProduction(
      { ...scene, buildings: [...scene.buildings.slice(0, 2), scene.buildings[3], scene.buildings[2]] },
      lane,
    )
    expect(reversed.machines.get('receiver-2')?.inputs[0].available).toBe(0)
    expect(reversed.machines.get('receiver-3')?.inputs[0].available).toBe(20)
  })

  it('does not certify downstream nominal output when its producer lacks raw input', () => {
    const scene = enrichedLane()
    expect([...inspect(scene).analysis.machines.values()].map((machine) => machine.state)).toEqual(['ready', 'ready'])
    const { analysis } = inspect({ ...scene, belts: scene.belts.slice(1) })
    expect(analysis.machines.get('source')?.state).toBe('missing-input')
    expect(analysis.machines.get('receiver')?.inputs[0]).toMatchObject({ state: 'unknown', available: null })
    expect(analysis.machines.get('receiver')?.state).toBe('unknown')
  })

  it('shares a finite catalog output without inventing more than the producer can supply', () => {
    const original = enrichedLane()
    const { analysis } = inspect({
      ...original,
      buildings: [
        original.buildings[0],
        ...[7, 11, 15, 19, 23].map((x, i) => ({
          id: 'receiver-' + i,
          type: 'refinery' as const,
          stationId: 'floor',
          x,
          y: 13,
          rotation: 0 as const,
          recipeId: 'enriched_cobalt_plates',
        })),
      ],
      belts: [
        original.belts[0],
        {
          id: 'feed',
          points: [
            { x: 7, y: 10 },
            { x: 7, y: 11 },
            { x: 28, y: 11 },
          ],
        },
        ...[8, 12, 16, 20, 24].map((x, i) => ({ id: 'branch-' + i, points: [{ x, y: 12 }], heading: { x: 0, y: 1 } })),
      ],
      splitters: [8, 12, 16, 20, 24].map((x, i) => ({ id: 'splitter-' + i, type: 'splitter' as const, x, y: 11, rotation: 0 as const })),
    })
    expect(analysis.machines.get('source')?.state).toBe('ready')
    expect([...analysis.machines.values()].slice(1).map((machine) => machine.inputs[0].available)).toEqual([10, 10, 10, 5, 5])
  })

  it('preserves direct splitter receivers and releases their quota when that output is disabled', () => {
    const original = rawLane()
    const scene = {
      ...original,
      buildings: original.buildings.map((piece, i) => (i ? piece : { ...piece, y: 5 })),
      belts: original.belts.filter((piece) => piece.id !== 'branch-0'),
    }
    expect(allocations(scene)).toEqual([20, 20, 10, 10])
    const { analysis } = inspect({
      ...scene,
      splitters: scene.splitters?.map((piece, i) => (i ? piece : { ...piece, disabledOutputs: ['south'] })),
    })
    expect(analysis.machines.get('receiver-0')?.state).toBe('missing-input')
    expect([...analysis.machines.values()].slice(1).map((machine) => machine.inputs[0].available)).toEqual([20, 20, 20])
  })

  it('estimates titanium output from input allocation rather than displaying nominal capacity as production', () => {
    const original = rawLane()
    const scene: Scene = {
      ...original,
      stations: original.stations.map((piece) => (piece.type === 'drone' ? { ...piece, cargo: ['T_TitaniumOre', null] as const } : piece)),
      buildings: original.buildings.map((piece) => ({ ...piece, recipeId: 'titanium_plates' })),
    }
    const { analysis } = inspect(scene)
    expect(analysis.products.find((row) => row.itemId === 'T_TitaniumPlates1')).toMatchObject({ output: 80, estimatedOutput: 60 })
    expect([...analysis.machines.values()].map((machine) => estimatedMachineOutput(machine, 20))).toEqual([20, 20, 10, 10])
    expect(analysis.products.find((row) => row.itemId === 'T_TitaniumOre')).toMatchObject({
      output: 0,
      demand: 80,
      suppliedInput: 60,
      requiredInput: 80,
      missingInput: 20,
    })
    const upgraded = inspect(rawLane(true)).analysis
    expect(upgraded.products.find((row) => row.itemId === 'T_CobaltPlates')?.estimatedOutput).toBe(80)
    expect(upgraded.products.find((row) => row.itemId === 'T_CobaltOre')?.missingInput).toBe(0)
  })

  it('preserves uncertainty in estimates instead of reporting nominal output or a zero shortage', () => {
    const scene = rawLane(),
      { network } = inspect(scene),
      links = new Map(network.links)
    links.set('25,4', ['0,4'])
    const { products, machines } = analyzeProduction(scene, { ...network, links })
    expect([...machines.values()].every((machine) => machine.state === 'unknown')).toBe(true)
    expect([...machines.values()].map((machine) => estimatedMachineOutput(machine, 20))).toEqual([null, null, null, null])
    expect(products.find((row) => row.itemId === 'T_CobaltPlates')?.estimatedOutput).toBeNull()
    expect(products.find((row) => row.itemId === 'T_CobaltOre')?.missingInput).toBeNull()
    expect(products.find((row) => row.itemId === 'T_CobaltOre')?.suppliedInput).toBeNull()
  })
})
