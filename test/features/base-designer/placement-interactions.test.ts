import { afterEach, describe, expect, it } from 'vitest'
import { useBaseDesignerStore } from '@/store/base-designer.store'
import type { BaseStation } from '@/features/base-designer/lib/layout/placement'
import { indexPlacements } from '@/features/base-designer/lib/layout/placement'
import { connectedCorridors, droneOutputPorts } from '@/features/base-designer/lib/layout/stations'
import { beltJunctionAnchor, dronePortAnchor, stationPlacementOrigin } from '@/features/base-designer/lib/geometry/station-spatial'
import { routeCells, routeMergeIds } from '@/features/base-designer/lib/routes/route'
import { beltConnection } from '@/features/base-designer/lib/connections/connections'

const station: BaseStation = { id: 'floor', type: 'station_1x1', name: 'Floor', position: { x: 0, y: 0 }, lockedTo: [], placements: [] }

afterEach(() => useBaseDesignerStore.setState({ stations: [], notes: [], past: [], future: [] }))

describe('station placement and drone rotation', () => {
  it('places at the chosen snapped position and rejects overlap without adding history', () => {
    expect(stationPlacementOrigin({ x: 340, y: 220 }, 'station_1x1')).toEqual({ x: 200, y: 80 })
    const store = useBaseDesignerStore.getState()
    expect(store.addStation('station_1x1', { x: 200, y: 80 })).toBeTruthy()
    const before = useBaseDesignerStore.getState()
    expect(before.stations[0].position).toEqual({ x: 200, y: 80 })
    expect(before.addStation('station_1x1', { x: 200, y: 80 })).toBeNull()
    expect(useBaseDesignerStore.getState().stations).toBe(before.stations)
    expect(useBaseDesignerStore.getState().past).toBe(before.past)
    expect(before.addStation('station_1x1', { x: 201, y: 80 })).toBeNull()
  })

  it('rotates the open face, outlet slots and corridors together, with undo', () => {
    const drone: BaseStation = { ...station, id: 'drone', type: 'drone_station', droneOutputs: ['T_CobaltOre', null] }
    const west: BaseStation = { ...station, id: 'west', position: { x: -300, y: 0 } }
    useBaseDesignerStore.setState({ stations: [drone, west] })
    expect(connectedCorridors([drone, west])).toEqual([])
    expect(useBaseDesignerStore.getState().rotateStation('drone')).toBe(true)
    const rotated = useBaseDesignerStore.getState().stations[0]
    expect(rotated.direction).toBe('west')
    expect(droneOutputPorts(rotated)).toMatchObject([
      { x: -1, y: 6, face: 'west', itemId: 'T_CobaltOre' },
      { x: -1, y: 7, face: 'west' },
    ])
    expect(connectedCorridors(useBaseDesignerStore.getState().stations)).toMatchObject([{ x: -1, y: 4, width: 1, height: 6 }])
    for (let i = 0; i < 3; i++) expect(useBaseDesignerStore.getState().rotateStation('drone')).toBe(true)
    expect(droneOutputPorts(useBaseDesignerStore.getState().stations[0])).toEqual(droneOutputPorts(drone))
    useBaseDesignerStore.getState().undo()
    expect(useBaseDesignerStore.getState().stations[0].direction).toBe('east')
  })

  it('does not rotate away occupied corridor floor', () => {
    const drone: BaseStation = { ...station, id: 'drone', type: 'drone_station' }
    const south: BaseStation = { ...station, id: 'south', position: { x: 0, y: 300 } }
    useBaseDesignerStore.setState({ stations: [drone, south] })
    expect(useBaseDesignerStore.getState().placeRoute('drone', 'conveyor', [{ x: 6, y: 14, incoming: 'north', direction: 'south' }])).toBe(
      true,
    )
    const before = useBaseDesignerStore.getState()
    expect(before.rotateStation('drone')).toBe(false)
    expect(useBaseDesignerStore.getState().stations).toBe(before.stations)
    expect(useBaseDesignerStore.getState().past).toBe(before.past)
  })

  it('anchors directly on visible outlets after each quarter turn, independent of world position', () => {
    const bounds = { left: 100, top: 50, width: 560, height: 560 }
    for (const direction of ['south', 'west', 'north', 'east'] as const) {
      const drone: BaseStation = { ...station, type: 'drone_station', position: { x: 320, y: -160 }, direction }
      for (const port of droneOutputPorts(drone)) {
        const x = port.x - 16
        const y = port.y + 8
        const dx = direction === 'east' ? 1 : direction === 'west' ? -1 : 0
        const dy = direction === 'south' ? 1 : direction === 'north' ? -1 : 0
        expect(dronePortAnchor({ clientX: 100 + (x + 0.5 - dx / 2) * 40, clientY: 50 + (y + 0.5 - dy / 2) * 40 }, bounds, drone)).toEqual({
          kind: 'port',
          x,
          y,
          face: direction,
          role: 'output',
        })
      }
    }
  })
})

describe('direct lateral conveyor joins', () => {
  it('uses separate merge intent so the UI can commit a side click on an existing belt', () => {
    useBaseDesignerStore.setState({ stations: [station] })
    const store = useBaseDesignerStore.getState()
    expect(
      store.placeRoute(
        'floor',
        'conveyor',
        routeCells([
          { kind: 'floor', x: 2, y: 7 },
          { kind: 'floor', x: 9, y: 7 },
        ]),
      ),
    ).toBe(true)
    const floor = useBaseDesignerStore.getState().stations[0]
    const draft = { stationId: 'floor', type: 'conveyor' as const, anchors: [{ kind: 'floor' as const, x: 5, y: 2 }], hover: null }
    const end = beltJunctionAnchor(indexPlacements(floor.placements), 5, 7, 'conveyor', draft, () => true, 0, 0)
    expect(end?.kind).toBe('port')
    if (!end || end.kind !== 'port' || !end.mergeTargetId) throw new Error('Missing direct junction')
    expect(routeMergeIds(draft.anchors[0], end)).toEqual([])
    expect(
      store.placeRoute('floor', 'conveyor', routeCells([...draft.anchors, end]), routeMergeIds(draft.anchors[0], end), {
        targetId: end.mergeTargetId,
        face: end.face,
      }),
    ).toBe(true)
    const pieces = useBaseDesignerStore.getState().stations[0].placements
    const target = pieces.find((piece) => piece.x === 5 && piece.y === 7)
    const branch = pieces.find((piece) => piece.x === 5 && piece.y === 6)
    expect(target?.extraIncoming).toEqual(['north'])
    expect(branch && beltConnection(indexPlacements(pieces), branch, 'south')?.id).toBe(target?.id)
    expect(new Set(pieces.map((piece) => piece.routeId)).size).toBe(2)
    store.undo()
    expect(useBaseDesignerStore.getState().stations[0].placements).toEqual(floor.placements)
  })

  it('does not join parallel adjacent belts or incompatible tiers', () => {
    const pieces = [
      { id: 'target', type: 'conveyor' as const, x: 5, y: 7, direction: 'east' as const, incoming: 'west' as const, routeId: 'route' },
    ]
    const occupied = indexPlacements(pieces)
    const draft = { stationId: 'floor', type: 'conveyor' as const, anchors: [{ kind: 'floor' as const, x: 2, y: 6 }], hover: null }
    expect(beltJunctionAnchor(occupied, 5, 6, 'conveyor', draft, () => true, 0, 0)).toBeNull()
    expect(beltJunctionAnchor(occupied, 5, 7, 'conveyor_mk2', draft, () => true, 0, 0)).toBeNull()
  })

  it('recognizes a perpendicular approach from adjacent floor, but keeps head-to-tail routing separate', () => {
    const occupied = indexPlacements([
      { id: 'target', type: 'conveyor' as const, x: 5, y: 7, direction: 'east' as const, incoming: 'west' as const, routeId: 'route' },
    ])
    const draft = { stationId: 'floor', type: 'conveyor' as const, anchors: [{ kind: 'floor' as const, x: 5, y: 2 }], hover: null }
    expect(beltJunctionAnchor(occupied, 5, 6, 'conveyor', draft, () => true, 0, 0)).toMatchObject({
      kind: 'port',
      x: 5,
      y: 6,
      face: 'north',
      mergeTargetId: 'target',
    })
    expect(beltJunctionAnchor(occupied, 5, 6, 'conveyor', draft, () => false, 0, 0)).toBeNull()
    const head = { ...draft, anchors: [{ kind: 'floor' as const, x: 2, y: 7 }] }
    expect(beltJunctionAnchor(occupied, 5, 7, 'conveyor', head, () => true, 0, 0)).toBeNull()
  })
})
