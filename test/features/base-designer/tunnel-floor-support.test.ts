import { describe, expect, it } from 'vitest'
import {
  canDrawBelt,
  canPlaceScenePieces,
  canPlaceTunnel,
  canStartTunnel,
  scenePlacementIssue,
  tunnelPlacementIssue,
} from '@/features/base-designer/lib/placement'
import { readSceneDocument, writeSceneDocument } from '@/features/base-designer/lib/scene-document'
import type { Tunnel } from '@/features/base-designer/model/logistics'
import type { Scene } from '@/features/base-designer/model/scene'

/** The aligned doorway is elsewhere: these mouths span the gap outside its corridor. */
const connected: Scene = {
  stations: [
    { id: 'left', x: 0, y: 0 },
    { id: 'right', x: 16, y: 0 },
  ],
  buildings: [],
  belts: [],
}
const tunnel: Tunnel = { id: 'tunnel', type: 'underground', entry: { x: 10, y: 12 }, exit: { x: 17, y: 12 } }

describe('Tunnel mouth support and station connectivity', () => {
  it.each(['underground', 'underground_mk2'] as const)('allows %s across a connected station gap in every direction', (type) => {
    for (const vertical of [false, true]) {
      const turn = ({ x, y }: { x: number; y: number }) => (vertical ? { x: y, y: x } : { x, y })
      const scene = { ...connected, stations: connected.stations.map((station) => ({ ...station, ...turn(station) })) }
      for (const reversed of [false, true]) {
        const piece = {
          ...tunnel,
          type,
          entry: turn(reversed ? tunnel.exit : tunnel.entry),
          exit: turn(reversed ? tunnel.entry : tunnel.exit),
        }
        const confirmed = { ...scene, tunnels: [piece] }
        expect(canPlaceTunnel(scene, piece)).toBe(true)
        expect(tunnelPlacementIssue(scene, piece)).toBeNull()
        expect(canDrawBelt(scene, { points: [piece.entry, piece.exit] })).toBe(false)
        expect(canPlaceScenePieces(confirmed)).toBe(true)
        expect(scenePlacementIssue(confirmed)).toBeNull()
        expect(readSceneDocument(JSON.parse(writeSceneDocument(confirmed)))).toEqual({ ...confirmed, splitters: [] })
      }
    }
  })

  it.each([
    { x: 16, y: 1 },
    { x: 14, y: 0 },
    { x: 17, y: 0 },
  ])('rejects floors without a corridor connection at $x, $y', (position) => {
    const scene = { ...connected, stations: [connected.stations[0], { id: 'right', ...position }] }
    expect(canStartTunnel(scene, tunnel.entry)).toBe(true)
    expect(canStartTunnel(scene, tunnel.exit)).toBe(true)
    expect(canPlaceTunnel(scene, tunnel)).toBe(false)
    expect(tunnelPlacementIssue(scene, tunnel)).toMatch(/mouths|corridor/i)
    expect(canPlaceScenePieces({ ...scene, tunnels: [tunnel] })).toBe(false)
    expect(readSceneDocument(JSON.parse(writeSceneDocument({ ...scene, tunnels: [tunnel] })))).toBeNull()
  })

  it('uses either real doorway when a large station connects to an ordinary floor', () => {
    const scene: Scene = {
      ...connected,
      stations: [
        { id: 'large', type: 'station_2x2_a', x: 0, y: 0 },
        { id: 'small', x: 32, y: 16 },
      ],
    }
    const piece = { ...tunnel, entry: { x: 28, y: 28 }, exit: { x: 34, y: 28 } }
    expect(canPlaceTunnel(scene, piece)).toBe(true)
    expect(scenePlacementIssue({ ...scene, tunnels: [piece] })).toBeNull()
  })

  it('requires both mouths on ordinary floor or a corridor, while retaining corridor-only placement', () => {
    expect(canPlaceTunnel(connected, { ...tunnel, entry: { x: 14, y: 5 }, exit: { x: 17, y: 5 } })).toBe(true)
    expect(canPlaceTunnel(connected, { ...tunnel, entry: { x: 14, y: 4 }, exit: { x: 14, y: 8 } })).toBe(true)
    expect(canPlaceTunnel(connected, { ...tunnel, exit: { x: 14, y: 12 } })).toBe(false)
    expect(canPlaceTunnel(connected, { ...tunnel, entry: { x: 14, y: 12 }, exit: { x: 17, y: 12 } })).toBe(false)
    const drone: Scene = {
      ...connected,
      stations: [connected.stations[0], { id: 'drone', type: 'drone', x: 0, y: -15, rotation: 0, cargo: [null, null] }],
    }
    expect(canPlaceTunnel(drone, { ...tunnel, entry: { x: 6, y: 2 }, exit: { x: 6, y: -2 } })).toBe(false)
  })

  it('preserves alignment, reach, surface-mouth occupancy and underground collision rules across the gap', () => {
    expect(canPlaceTunnel(connected, { ...tunnel, exit: { x: 18, y: 12 } })).toBe(false)
    expect(canPlaceTunnel(connected, { ...tunnel, exit: { x: 17, y: 11 } })).toBe(false)
    const building = { id: 'box', stationId: 'left', type: 'container' as const, rotation: 0 as const, x: 12, y: 12 }
    expect(canPlaceTunnel({ ...connected, buildings: [building] }, tunnel)).toBe(true)
    expect(canPlaceTunnel({ ...connected, buildings: [{ ...building, x: 10 }] }, tunnel)).toBe(false)
    expect(canPlaceTunnel({ ...connected, splitters: [{ id: 'splitter', type: 'splitter', rotation: 0, ...tunnel.exit }] }, tunnel)).toBe(
      false,
    )
    expect(
      canPlaceTunnel({ ...connected, tunnels: [{ ...tunnel, id: 'crossing', entry: { x: 13, y: 11 }, exit: { x: 13, y: 13 } }] }, tunnel),
    ).toBe(false)
    expect(canPlaceTunnel({ ...connected, belts: [{ id: 'side', points: [{ x: 10, y: 10 }, tunnel.entry] }] }, tunnel)).toBe(false)
  })

  it('rechecks corridor connectivity after a station changes within the same input array', () => {
    const stations = connected.stations.map((station) => ({ ...station }))
    const scene = { ...connected, stations, tunnels: [tunnel] }
    expect(scenePlacementIssue(scene)).toBeNull()
    stations[1].y = 1
    expect(canPlaceTunnel(scene, tunnel, tunnel.id)).toBe(false)
    expect(scenePlacementIssue(scene)).toMatch(/mouths|corridor/i)
    stations[1].y = 0
    expect(scenePlacementIssue(scene)).toBeNull()
  })
})
