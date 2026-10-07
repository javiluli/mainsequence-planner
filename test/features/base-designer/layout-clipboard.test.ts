import { afterEach, describe, expect, it } from 'vitest'
import {
  clipboardLayoutAt,
  copyLayoutSelection,
  canPasteLayout,
  clipboardPlacementPreview,
} from '@/features/base-designer/lib/clipboard/clipboard'
import type { BaseStation } from '@/features/base-designer/lib/layout/placement'
import { routeCells } from '@/features/base-designer/lib/routes/route'
import { worldPlacements } from '@/features/base-designer/lib/layout/world-layout'
import { useBaseDesignerStore } from '@/store/base-designer.store'

const station = (id: string, x: number): BaseStation => ({
  id,
  type: 'station_1x1',
  name: id,
  position: { x, y: 0 },
  lockedTo: [],
  placements: [],
})
function connectedLayout() {
  const stations = [station('a', 0), station('b', 320), station('c', 640)]
  stations[0].lockedTo = ['b']
  stations[1].lockedTo = ['a', 'c']
  stations[2].lockedTo = ['b']
  useBaseDesignerStore.setState({ stations, notes: [], past: [], future: [] })
  for (const [id, x, y] of [
    ['a', 10, 6],
    ['b', 26, 8],
  ] as const) {
    expect(
      useBaseDesignerStore.getState().placeRoute(
        id,
        'conveyor',
        routeCells([
          { kind: 'floor', x, y },
          { kind: 'floor', x: x + 9, y },
        ]),
      ),
    ).toBe(true)
  }
  return useBaseDesignerStore.getState().stations
}
afterEach(() => useBaseDesignerStore.setState({ stations: [], notes: [], past: [], future: [] }))

describe('layout clipboard', () => {
  it.each(['station_1x1', 'station_2x2_a', 'station_2x2_b', 'drone_station'] as const)(
    'preserves %s metadata in a single-station paste',
    (type) => {
      const original: BaseStation = {
        ...station('a', 0),
        type,
        direction: 'east',
        droneOutputs: type === 'drone_station' ? ['T_CobaltOre', null] : undefined,
      }
      const copy = copyLayoutSelection([original], [], ['a'])
      expect(useBaseDesignerStore.getState().pasteLayout(copy)).toHaveLength(1)
      expect(useBaseDesignerStore.getState().stations[0]).toMatchObject({
        type,
        direction: 'east',
        position: original.position,
        droneOutputs: original.droneOutputs,
      })
      expect(useBaseDesignerStore.getState().stations[0].id).not.toBe(original.id)
    },
  )
  it('preserves a complete underground route with its buried indices and a machine above it', () => {
    useBaseDesignerStore.setState({ stations: [station('a', 0), station('b', 320)], past: [], future: [] })
    expect(
      useBaseDesignerStore.getState().placeRoute(
        'a',
        'underground',
        routeCells([
          { kind: 'floor', x: 12, y: 6 },
          { kind: 'floor', x: 18, y: 6 },
        ]),
      ),
    ).toBe(true)
    expect(useBaseDesignerStore.getState().place('a', 'assembler', 13, 4)).toBe(true)
    const copy = copyLayoutSelection(useBaseDesignerStore.getState().stations, [], ['a', 'b'])
    expect(copy.skippedRoutes).toBe(0)
    expect(copy.skippedParts).toBe(0)
    expect(useBaseDesignerStore.getState().pasteLayout(clipboardLayoutAt(copy, { x: 1200, y: 600 }))).toHaveLength(2)
    const pasted = worldPlacements(useBaseDesignerStore.getState().stations.slice(-2))
    expect(pasted.filter((piece) => piece.buried)).toHaveLength(5)
    expect(pasted.filter((piece) => piece.routeId).map((piece) => piece.routeIndex)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(pasted.filter((piece) => piece.type === 'assembler')).toHaveLength(1)
  })
  it('keeps an invalid piece preview in empty space and validates the same copy on station floor', () => {
    const floor = station('a', 0)
    const source = [
      {
        id: 'machine',
        type: 'refinery' as const,
        x: 2,
        y: 2,
        direction: 'east' as const,
        recipeId: 'cobalt_plates',
        disabledOutputPorts: ['west:1'],
      },
    ]
    const outside = clipboardPlacementPreview([floor], source, { x: 30, y: 30 })
    expect(outside.pieces).toHaveLength(1)
    expect(outside.pieces[0]).toMatchObject({ x: 29, y: 29, recipeId: 'cobalt_plates', disabledOutputPorts: ['west:1'] })
    expect(outside.valid).toBe(false)
    expect(outside.stationId).toBeNull()
    expect(clipboardPlacementPreview([floor], source, { x: 5, y: 5 }).valid).toBe(true)
  })
  it('rejects malformed contents and duplicate node identities without partial mutation', () => {
    const source = station('a', 0)
    source.placements = [{ id: 'outside', type: 'refinery', x: 13, y: 13, direction: 'east' }]
    const proposal = { stations: [source], notes: [], skippedParts: 0, skippedRoutes: 0 }
    expect(useBaseDesignerStore.getState().pasteLayout(proposal)).toBeNull()
    expect(useBaseDesignerStore.getState().past).toEqual([])
    expect(canPasteLayout([], { ...proposal, stations: [station('a', 0), station('a', 500)] })).toBe(false)
  })
  it('keeps complete internal routes and locks, omitting external routes as a whole', () => {
    const source = connectedLayout()
    const copy = copyLayoutSelection(source, [], ['a', 'b'])
    expect(copy.stations.map((entry) => entry.lockedTo)).toEqual([['b'], ['a']])
    expect(worldPlacements(copy.stations)).toHaveLength(10)
    expect(copy.skippedRoutes).toBe(1)
    expect(source[1].lockedTo).toEqual(['a', 'c'])
    const single = copyLayoutSelection(source, [], ['a'])
    expect(single.stations[0].placements).toEqual([])
    expect(single.skippedRoutes).toBe(1)
  })
  it('keeps a spanning machine only when its complete floor is selected', () => {
    const source = [station('a', 0), station('b', 320)]
    source[0].placements = [{ id: 'bridge', type: 'assembler', x: 12, y: 4, direction: 'east', disabledOutputPorts: ['west:2'] }]
    expect(copyLayoutSelection(source, [], ['a', 'b']).stations[0].placements).toEqual(source[0].placements)
    expect(copyLayoutSelection(source, [], ['a']).skippedParts).toBe(1)
    expect(copyLayoutSelection(source, [], ['a']).stations[0].placements).toEqual([])
  })
  it('snapshots mutable metadata independently and translates stations and notes together on the grid', () => {
    const source = station('drone', 0)
    source.type = 'drone_station'
    source.droneOutputs = ['T_CobaltOre', null]
    const note = { id: 'note', position: { x: 320, y: 40 }, text: 'Snapshot' }
    const copy = copyLayoutSelection([source], [note], ['drone', 'note'])
    source.position.x = 900
    source.droneOutputs[0] = null
    note.text = 'Changed'
    expect(copy.stations[0].position.x).toBe(0)
    expect(copy.stations[0].droneOutputs).toEqual(['T_CobaltOre', null])
    expect(copy.notes[0].text).toBe('Snapshot')
    const draft = clipboardLayoutAt(copy, { x: 1201, y: 701 })
    const dx = draft.stations[0].position.x
    const dy = draft.stations[0].position.y
    expect(dx % 20).toBe(0)
    expect(dy % 20).toBe(0)
    expect(draft.notes[0].position).toEqual({ x: 320 + dx, y: 40 + dy })
  })
  it('rejects a whole group when one station overlaps without changing state or history', () => {
    const copy = copyLayoutSelection([station('a', 0), station('b', 320)], [], ['a', 'b'])
    const existing = [station('obstacle', 320)]
    useBaseDesignerStore.setState({ stations: existing, past: [], future: [] })
    expect(canPasteLayout(existing, copy)).toBe(false)
    expect(useBaseDesignerStore.getState().pasteLayout(copy)).toBeNull()
    expect(useBaseDesignerStore.getState().stations).toBe(existing)
    expect(useBaseDesignerStore.getState().past).toEqual([])
  })
  it('remaps all identities and internal links, preserves relative positions and records one undo per repeat', () => {
    const copy = copyLayoutSelection(connectedLayout(), [], ['a', 'b'])
    const before = useBaseDesignerStore.getState().stations
    const historyLength = useBaseDesignerStore.getState().past.length
    const ids = useBaseDesignerStore.getState().pasteLayout(clipboardLayoutAt(copy, { x: 1200, y: 600 }))
    expect(ids).toHaveLength(2)
    const pasted = useBaseDesignerStore.getState().stations.slice(-2)
    expect(pasted.map((entry) => entry.lockedTo)).toEqual([[pasted[1].id], [pasted[0].id]])
    expect(pasted[1].position.x - pasted[0].position.x).toBe(320)
    const originalIDs = new Set(
      copy.stations.flatMap((entry) => [entry.id, ...entry.placements.flatMap((piece) => [piece.id, piece.routeId])]),
    )
    for (const entry of pasted) {
      expect(originalIDs.has(entry.id)).toBe(false)
      for (const piece of entry.placements) {
        expect(originalIDs.has(piece.id)).toBe(false)
        expect(originalIDs.has(piece.routeId)).toBe(false)
      }
    }
    expect(new Set(worldPlacements(pasted).map((piece) => piece.routeId)).size).toBe(1)
    expect(useBaseDesignerStore.getState().past).toHaveLength(historyLength + 1)
    const after = useBaseDesignerStore.getState().stations
    useBaseDesignerStore.getState().undo()
    expect(useBaseDesignerStore.getState().stations).toEqual(before)
    useBaseDesignerStore.getState().redo()
    expect(useBaseDesignerStore.getState().stations).toEqual(after)
    const again = useBaseDesignerStore.getState().pasteLayout(clipboardLayoutAt(copy, { x: 1200, y: 1000 }))
    expect(again).toHaveLength(2)
    expect(again?.some((id) => ids?.includes(id))).toBe(false)
  })
  it('pastes station and note snapshots after originals disappear, with one atomic undo', () => {
    const note = { id: 'note', position: { x: 60, y: 40 }, text: 'Snapshot' }
    const copy = copyLayoutSelection([station('a', 0)], [note], ['a', 'note'])
    useBaseDesignerStore.setState({ stations: [], notes: [], past: [] })
    expect(useBaseDesignerStore.getState().pasteLayout(copy)).toHaveLength(2)
    expect(useBaseDesignerStore.getState().notes[0].text).toBe('Snapshot')
    expect(useBaseDesignerStore.getState().past).toHaveLength(1)
    useBaseDesignerStore.getState().undo()
    expect(useBaseDesignerStore.getState().notes).toEqual([])
    expect(useBaseDesignerStore.getState().stations).toEqual([])
  })
})
