import { afterEach, describe, expect, it } from 'vitest'
import { canPlaceInLayout, canPlaceRouteInLayout, linkedStationIds } from '@/features/base-designer/lib/world-layout'
import { connectedCorridors, droneOutputPorts } from '@/features/base-designer/lib/stations'
import { beltConnection, connectedProductionBelts, machinePortFlow } from '@/features/base-designer/lib/connections'
import { canPlace, indexPlacements, type BasePlacement } from '@/features/base-designer/lib/placement'
import { routeCells } from '@/features/base-designer/lib/route'
import { isUndergroundPath } from '@/features/base-designer/lib/underground'
import { items } from '@/shared/data'
import { CELL_SIZE, PLACEABLES, STATION_TYPES } from '@/features/base-designer/model/catalog'
import type { BaseStation } from '@/features/base-designer/lib/placement'
import { useBaseDesignerStore } from '@/store/base-designer.store'
import { recipeForPlaceable, recipesForPlaceable } from '@/features/base-designer/lib/machine-recipes'

function station(id: string, type: BaseStation['type'], x: number): BaseStation {
  return { id, type, name: id, position: { x: x * CELL_SIZE, y: 0 }, lockedTo: [], placements: [] }
}

afterEach(() => {
  useBaseDesignerStore.setState({ stations: [], past: [], future: [], dragStartStations: null })
})

describe('base layout catalog', () => {
  it('preserves buildable station footprints and two-cell passages', () => {
    expect(STATION_TYPES.station_1x1.footprintCells).toBe(14)
    expect(STATION_TYPES.station_2x2_a.footprintCells).toBe(30)

    const stations = [station('a', 'station_1x1', 0), station('b', 'station_1x1', 16)]
    expect(connectedCorridors(stations)).toMatchObject([{ x: 14, y: 4, width: 2, height: 6 }])
    expect(canPlaceInLayout(stations, 'a', 'container', 14, 4)).toBe(true)
  })

  it('does not move aligned empty stations together until explicitly locked', () => {
    const first = station('a', 'station_1x1', 0)
    const second = station('b', 'station_1x1', 16)
    expect([...linkedStationIds([first, second], first.id)]).toEqual(['a'])
    first.lockedTo = [second.id]
    second.lockedTo = [first.id]
    expect([...linkedStationIds([first, second], first.id)]).toEqual(['a', 'b'])
  })

  it('locks and unlocks a station pair as one undoable movement group', () => {
    useBaseDesignerStore.setState({
      stations: [station('a', 'station_1x1', 0), station('b', 'station_1x1', 16)],
      past: [],
      future: [],
      dragStartStations: null,
    })
    useBaseDesignerStore.getState().toggleStationLock('a', 'b')
    expect(useBaseDesignerStore.getState().stations.map((entry) => entry.lockedTo)).toEqual([['b'], ['a']])
    expect(useBaseDesignerStore.getState().removeStation('b')).toBe(false)

    useBaseDesignerStore.getState().beginMoveStation()
    useBaseDesignerStore.getState().moveStation('a', { x: CELL_SIZE, y: 0 })
    useBaseDesignerStore.getState().endMoveStation()
    expect(useBaseDesignerStore.getState().stations.map((entry) => entry.position.x)).toEqual([20, 340])

    useBaseDesignerStore.getState().undo()
    expect(useBaseDesignerStore.getState().stations.map((entry) => entry.position.x)).toEqual([0, 320])
    useBaseDesignerStore.getState().toggleStationLock('a', 'b')
    expect(useBaseDesignerStore.getState().stations.map((entry) => entry.lockedTo)).toEqual([[], []])
  })

  it('keeps menu group separate from placement physics', () => {
    expect(PLACEABLES.reactor).toMatchObject({ category: 'machine', paletteGroup: 'power' })
    expect(PLACEABLES.container).toMatchObject({ category: 'machine', paletteGroup: 'storage' })
  })

  it('records the player-confirmed Mk1 and Mk2 logistics capacities', () => {
    for (const type of ['conveyor', 'underground', 'splitter'] as const) {
      expect(PLACEABLES[type].capacityPerMinute).toBe(60)
    }
    for (const type of ['conveyor_mk2', 'underground_mk2', 'splitter_mk2'] as const) {
      expect(PLACEABLES[type].capacityPerMinute).toBe(120)
    }
  })

  it('assigns only real recipes belonging to the selected machine', () => {
    const refineryRecipe = recipesForPlaceable('refinery')[0]
    expect(refineryRecipe.id).toBeTruthy()
    expect(recipesForPlaceable('reactor')).toEqual([])
    expect(recipeForPlaceable('refinery', refineryRecipe.id)).toBe(refineryRecipe)

    useBaseDesignerStore.setState({ stations: [station('a', 'station_1x1', 0)] })
    expect(useBaseDesignerStore.getState().place('a', 'refinery', 1, 1)).toBe(true)
    const pieceId = useBaseDesignerStore.getState().stations[0].placements[0].id
    expect(useBaseDesignerStore.getState().assignRecipe('a', pieceId, refineryRecipe.id ?? null)).toBe(true)
    expect(useBaseDesignerStore.getState().stations[0].placements[0].recipeId).toBe(refineryRecipe.id)
    expect(useBaseDesignerStore.getState().assignRecipe('a', pieceId, 'not-a-recipe')).toBe(false)
    useBaseDesignerStore.getState().undo()
    expect(useBaseDesignerStore.getState().stations[0].placements[0].recipeId).toBeUndefined()
  })

  it('opens only the drone face with two central item outlets', () => {
    const drone = station('drone', 'drone_station', 0)
    const south = { ...station('south', 'station_1x1', 0), position: { x: 0, y: 16 * CELL_SIZE } }
    expect(connectedCorridors([drone, south])).toMatchObject([{ x: 4, y: 14, width: 6, height: 2 }])
    expect(connectedCorridors([drone, station('east', 'station_1x1', 16)])).toEqual([])
    expect(droneOutputPorts(drone)).toMatchObject([
      { slot: 0, x: 6, y: 14, face: 'south', itemId: null },
      { slot: 1, x: 7, y: 14, face: 'south', itemId: null },
    ])
    expect(canPlace(drone, 'refinery', 1, 1)).toBe(false)
    expect(canPlaceInLayout([drone], 'drone', 'conveyor', 6, 6)).toBe(false)
    expect(canPlaceRouteInLayout([drone], 'drone', [{ x: 6, y: 6, direction: 'south', incoming: 'north' }])).toBe(false)
    expect(canPlaceRouteInLayout([drone, south], 'drone', [{ x: 6, y: 14, direction: 'south', incoming: 'north' }])).toBe(true)

    useBaseDesignerStore.setState({ stations: [drone] })
    expect(useBaseDesignerStore.getState().setDroneOutput('drone', 0, items[0].id)).toBe(true)
    expect(useBaseDesignerStore.getState().setDroneOutput('drone', 1, 'not-in-catalog')).toBe(false)
    expect(useBaseDesignerStore.getState().stations[0].droneOutputs).toEqual([items[0].id, null])
  })

  it('treats an assigned external outlet as the start of a directed belt path', () => {
    const pieces: BasePlacement[] = [
      { id: 'belt-a', type: 'conveyor', x: 0, y: 1, direction: 'east', incoming: 'west' },
      { id: 'belt-b', type: 'conveyor', x: 1, y: 1, direction: 'east', incoming: 'west' },
      { id: 'refinery', type: 'refinery', x: 2, y: 0, direction: 'east' },
    ]
    expect(connectedProductionBelts(pieces, indexPlacements(pieces))).toEqual(new Map())
    expect(connectedProductionBelts(pieces, indexPlacements(pieces), undefined, [{ x: 0, y: 1, face: 'east' }]).size).toBe(2)
  })

  it('disconnects a disabled machine output while leaving input delivery transparent', () => {
    const machine: BasePlacement = {
      id: 'refinery',
      type: 'refinery',
      x: 2,
      y: 0,
      direction: 'east',
      disabledOutputPorts: ['west:1'],
    }
    const outgoing: BasePlacement = { id: 'out', type: 'conveyor', x: 1, y: 1, direction: 'west', incoming: 'east' }
    const incoming: BasePlacement = { ...outgoing, id: 'in', direction: 'east', incoming: 'west' }
    expect(machinePortFlow(indexPlacements([machine, outgoing]), machine, { face: 'west', offset: 1 })).toBe('disabled-output')
    expect(beltConnection(indexPlacements([machine, outgoing]), outgoing, 'east')).toBeUndefined()
    expect(machinePortFlow(indexPlacements([machine, incoming]), machine, { face: 'west', offset: 1 })).toBe('input')
    expect(beltConnection(indexPlacements([machine, incoming]), incoming, 'east')).toBe(machine)

    useBaseDesignerStore.setState({
      stations: [{ ...station('a', 'station_1x1', 0), placements: [machine] }],
    })
    expect(useBaseDesignerStore.getState().toggleMachineOutput('a', machine.id, 'west', 1)).toBe(true)
    expect(useBaseDesignerStore.getState().stations[0].placements[0].disabledOutputPorts).toEqual([])
  })

  it('limits straight underground tunnels and leaves their buried cells buildable', () => {
    const mk1 = routeCells([
      { kind: 'floor', x: 1, y: 1 },
      { kind: 'floor', x: 8, y: 1 },
    ])
    expect(isUndergroundPath('underground', mk1, true)).toBe(true)
    expect(isUndergroundPath('underground', [...mk1, { ...mk1.at(-1)!, x: 9 }], true)).toBe(false)
    expect(isUndergroundPath('underground_mk2', [...mk1, { ...mk1.at(-1)!, x: 9 }], true)).toBe(true)
    expect(
      isUndergroundPath(
        'underground',
        routeCells([
          { kind: 'floor', x: 1, y: 1 },
          { kind: 'floor', x: 3, y: 3 },
        ]),
        true,
      ),
    ).toBe(false)

    useBaseDesignerStore.setState({ stations: [station('a', 'station_1x1', 0)] })
    expect(useBaseDesignerStore.getState().placeRoute('a', 'underground', mk1)).toBe(true)
    const route = useBaseDesignerStore.getState().stations[0].placements
    expect(route.filter((piece) => piece.buried)).toHaveLength(6)
    expect(useBaseDesignerStore.getState().place('a', 'refinery', 3, 0)).toBe(true)
    expect(useBaseDesignerStore.getState().stations[0].placements).toHaveLength(9)
  })

  it('walks through a buried tunnel without connecting to surface pieces above it', () => {
    const tunnel = routeCells([
      { kind: 'floor', x: 1, y: 1 },
      { kind: 'floor', x: 4, y: 1 },
    ]).map((cell, index) => ({
      id: `tunnel-${index}`,
      type: 'underground' as const,
      routeId: 'tunnel',
      routeIndex: index,
      buried: index === 1 || index === 2,
      ...cell,
    }))
    const pieces: BasePlacement[] = [
      { id: 'source', type: 'conveyor', x: 0, y: 1, direction: 'east', incoming: 'west' },
      ...tunnel,
      { id: 'next', type: 'conveyor', x: 5, y: 1, direction: 'east', incoming: 'west' },
      { id: 'refinery', type: 'refinery', x: 6, y: 0, direction: 'east' },
    ]
    expect(connectedProductionBelts(pieces, indexPlacements(pieces), undefined, [{ x: 0, y: 1, face: 'east' }]).size).toBe(4)
  })
})
