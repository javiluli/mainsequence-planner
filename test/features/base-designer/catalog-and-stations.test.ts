import { afterEach, describe, expect, it } from 'vitest'
import { canPlaceInLayout, linkedStationIds } from '@/features/base-designer/lib/world-layout'
import { connectedCorridors } from '@/features/base-designer/lib/stations'
import { CELL_SIZE, PLACEABLES, STATION_TYPES } from '@/features/base-designer/model/catalog'
import type { BaseStation } from '@/features/base-designer/lib/placement'
import { useBaseDesignerStore } from '@/store/base-designer.store'

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
})
