import { describe, expect, it } from 'vitest'
import { beltNetwork } from '@/features/base-designer/lib/belt-network'
import { canPlaceScenePieces } from '@/features/base-designer/lib/placement'
import { rotateGroup } from '@/features/base-designer/lib/scene-geometry'
import { CELL_SIZE, type Point, type Scene } from '@/features/base-designer/model/scene'
import {
  prepareBeltConnections,
  prepareBeltTracks,
  preparePortBridges,
  routeBounds,
} from '@/features/base-designer/ui/elements/belt-drawing'
import type { BeltSection } from '@/features/base-designer/ui/elements/belt-geometry'

/** A physical cargo-to-machine route exercises both attachment directions and a direct mouth-to-machine bridge. */
function logisticsLane(mk2: boolean): Scene {
  return {
    stations: [
      { id: 'floor', type: 'station_2x2_a', x: 0, y: 0 },
      { id: 'drone', type: 'drone', x: 0, y: -15, rotation: 0, cargo: ['T_CobaltOre', null] },
    ],
    buildings: [{ id: 'receiver', type: 'refinery', stationId: 'floor', x: 2, y: 11, rotation: 0, recipeId: 'cobalt_plates' }],
    splitters: [{ id: 'splitter', type: mk2 ? 'splitter_mk2' : 'splitter', x: 2, y: 2, rotation: 0 }],
    tunnels: [{ id: 'tunnel', type: mk2 ? 'underground_mk2' : 'underground', entry: { x: 3, y: 7 }, exit: { x: 3, y: 10 } }],
    belts: [
      {
        id: 'feed',
        type: mk2 ? 'conveyor_mk2' : 'conveyor',
        points: [
          { x: 6, y: -1 },
          { x: 6, y: 0 },
          { x: 0, y: 0 },
          { x: 0, y: 2 },
          { x: 1, y: 2 },
        ],
      },
      {
        id: 'middle',
        type: mk2 ? 'conveyor_mk2' : 'conveyor',
        points: [
          { x: 3, y: 2 },
          { x: 3, y: 6 },
        ],
      },
    ],
  }
}

/** The native dash clock must meet at a shared socket even when each contour has its own origin. */
function expectContinuousHandover(before: BeltSection, after: BeltSection) {
  expect(before.to).toEqual(after.from)
  const phaseDifference = (before.offset + before.length - after.offset) / CELL_SIZE
  expect(phaseDifference).toBeCloseTo(Math.round(phaseDifference))
}

describe('Confirmed belt drawing preparation', () => {
  it('hands attachments to a bent MK2 track once in every rotation, preserving phase and immutable inputs', () => {
    let scene = logisticsLane(true)
    for (let turn = 0; turn < 4; turn++) {
      expect(canPlaceScenePieces(scene)).toBe(true)
      const network = beltNetwork(scene),
        originalScene = structuredClone(scene),
        originalNetwork = structuredClone(network),
        connections = prepareBeltConnections(scene, network),
        tracks = prepareBeltTracks(scene.belts, network, connections),
        track = tracks.find(({ belt }) => belt.id === 'middle')!,
        input = connections.attachments.find((attachment) => attachment.beltId === 'middle' && attachment.owner.id === 'splitter')!,
        output = connections.attachments.find((attachment) => attachment.beltId === 'middle' && attachment.owner.id === 'tunnel')!,
        main = track.geometry[0]

      expect(input.active).toBe(true)
      expect(output.active).toBe(true)
      expect(track.caps).toEqual([])
      expectContinuousHandover(input.geometry[0].at(-1)!, main[0])
      expectContinuousHandover(main.at(-1)!, output.geometry[0][0])
      expect(main.every((section) => section.active)).toBe(true)
      const logicalLength = [...input.geometry.flat(), ...track.geometry.flat(), ...output.geometry.flat()].reduce(
          (length, section) => length + section.length,
          0,
        ),
        from = input.points[0],
        to = output.points.at(-1)!
      expect(logicalLength).toBe((Math.abs(to.x - from.x) + Math.abs(to.y - from.y)) * CELL_SIZE)
      expect(preparePortBridges(network.portBridges)).toHaveLength(1)
      expect(scene).toEqual(originalScene)
      expect(network).toEqual(originalNetwork)
      scene = rotateGroup(scene)
    }
  })

  it('retains physical sockets when disabling an MK1 source but stops its downstream slats', () => {
    const original = logisticsLane(false),
      scene: Scene = { ...original, splitters: original.splitters?.map((splitter) => ({ ...splitter, disabledOutputs: ['east'] })) },
      network = beltNetwork(scene),
      connections = prepareBeltConnections(scene, network),
      track = prepareBeltTracks(scene.belts, network, connections).find(({ belt }) => belt.id === 'middle')!,
      attachments = connections.attachments.filter((attachment) => attachment.beltId === 'middle'),
      bridges = preparePortBridges(network.portBridges)

    expect(canPlaceScenePieces(scene)).toBe(true)
    expect(attachments).toHaveLength(2)
    expect(attachments.every((attachment) => attachment.geometry[0].every((section) => !section.active))).toBe(true)
    expect(track.caps).toEqual([])
    expect(track.geometry.flat().every((section) => !section.active)).toBe(true)
    expect(bridges).toHaveLength(1)
    expect(bridges[0].geometry.flat().every((section) => !section.active)).toBe(true)
  })

  it('leaves a junction open while retaining the branch free cap', () => {
    const scene: Scene = {
      stations: [{ id: 'floor', x: 0, y: 0 }],
      buildings: [],
      belts: [
        {
          id: 'carrier',
          points: [
            { x: 1, y: 5 },
            { x: 8, y: 5 },
          ],
        },
        {
          id: 'branch',
          points: [
            { x: 4, y: 2 },
            { x: 4, y: 5 },
          ],
        },
      ],
    }
    expect(canPlaceScenePieces(scene)).toBe(true)
    const network = beltNetwork(scene),
      connections = prepareBeltConnections(scene, network),
      tracks = prepareBeltTracks(scene.belts, network, connections)

    expect(connections.junctions).toEqual([{ x: 4, y: 5 }])
    expect(tracks.find(({ belt }) => belt.id === 'branch')?.caps).toMatchObject([{ index: 0, cell: { x: 4, y: 2 } }])
    expect(tracks.find(({ belt }) => belt.id === 'carrier')?.caps).toHaveLength(2)
  })

  it.each([
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
  ])('retains two opposite free caps for a one-cell belt heading $x,$y', (heading: Point) => {
    const scene: Scene = {
      stations: [{ id: 'floor', x: 0, y: 0 }],
      buildings: [],
      belts: [{ id: 'short', type: 'conveyor_mk2', points: [{ x: 1, y: 1 }], heading }],
    }
    const network = beltNetwork(scene),
      connections = prepareBeltConnections(scene, network),
      [track] = prepareBeltTracks(scene.belts, network, connections)

    expect(canPlaceScenePieces(scene)).toBe(true)
    expect(track.caps.map((cap) => cap.position)).toEqual([
      { x: 1.5 - heading.x / 2, y: 1.5 - heading.y / 2 },
      { x: 1.5 + heading.x / 2, y: 1.5 + heading.y / 2 },
    ])
    expect(track.geometry.flat().reduce((length, section) => length + section.length, 0)).toBe(CELL_SIZE)
    expect(track.geometry.flat().every((section) => !section.active)).toBe(true)
  })

  it('uses pixel bounds including complete endpoint cells at negative coordinates', () => {
    expect(
      routeBounds([
        { x: -4, y: -2 },
        { x: -1, y: -2 },
        { x: -1, y: 1 },
      ]),
    ).toEqual({
      x: -4 * CELL_SIZE,
      y: -2 * CELL_SIZE,
      width: 4 * CELL_SIZE,
      height: 4 * CELL_SIZE,
    })
  })
})
