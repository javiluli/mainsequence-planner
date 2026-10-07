import { describe, expect, it } from 'vitest'
import { createClipboardPayload } from '@/features/base-designer/lib/clipboard/clipboard'
import { recipesForPlaceable } from '@/features/base-designer/lib/products/machine-recipes'
import type { BaseNote, BasePlacement, BaseStation } from '@/features/base-designer/lib/layout/placement'
import { routeCells } from '@/features/base-designer/lib/routes/route'
import { worldPlacements } from '@/features/base-designer/lib/layout/world-layout'
import type { EditorSelection } from '@/features/base-designer/model/editor-selection'

function station(id: string, x: number, placements: BasePlacement[] = []): BaseStation {
  return { id, type: 'station_1x1', name: id, position: { x, y: -40 }, lockedTo: [], placements }
}

function machine(): BasePlacement {
  return {
    id: 'machine',
    type: 'refinery',
    x: 2,
    y: 2,
    direction: 'east',
    recipeId: recipesForPlaceable('refinery')[0].id,
    disabledOutputPorts: ['west:1'],
  }
}

function snapshot(selection: EditorSelection, stations: BaseStation[], notes: BaseNote[] = []) {
  return createClipboardPayload({ selection, stations, notes, worldPieces: worldPlacements(stations) })
}

describe('clipboard payload from explicit selection', () => {
  it.each<EditorSelection>([
    null,
    { kind: 'nodes', ids: ['missing'] },
    { kind: 'part', stationId: 'missing', placementId: 'machine' },
    { kind: 'part', stationId: 'a', placementId: 'missing' },
    { kind: 'area', ids: ['missing'] },
  ])('returns no copy for an empty or stale selection: %j', (selection) => {
    expect(snapshot(selection, [station('a', 0, [machine()])])).toBeNull()
  })

  it('copies only selected nodes and notes without following external locks', () => {
    const a = station('a', -320, [machine()])
    const b = station('b', 0)
    a.lockedTo = ['b']
    b.lockedTo = ['a']
    const notes = [
      { id: 'selected-note', position: { x: -100, y: -80 }, text: 'Keep' },
      { id: 'other-note', position: { x: 500, y: 0 }, text: 'Leave' },
    ]
    const copy = snapshot({ kind: 'nodes', ids: ['a', 'selected-note'] }, [a, b], notes)
    expect(copy?.kind).toBe('layout')
    if (copy?.kind !== 'layout') throw new Error('Expected layout snapshot')
    expect(copy.source.stations.map((entry) => entry.id)).toEqual(['a'])
    expect(copy.source.stations[0].lockedTo).toEqual([])
    expect(copy.source.stations[0].placements).toEqual(a.placements)
    expect(copy.source.notes).toEqual([notes[0]])
    a.placements[0].disabledOutputPorts?.push('north:1')
    notes[0].text = 'Changed'
    expect(copy.source.stations[0].placements[0].disabledOutputPorts).toEqual(['west:1'])
    expect(copy.source.notes[0].text).toBe('Keep')
    expect(a.lockedTo).toEqual(['b'])
  })

  it('copies a selected route completely across owners in the selected owner local frame', () => {
    const a = station('a', -320)
    const b = station('b', 0)
    const cells = routeCells([
      { kind: 'floor', x: -4, y: 4 },
      { kind: 'floor', x: 2, y: 4 },
    ])
    cells.forEach((cell, index) => {
      const owner = cell.x < 0 ? a : b
      owner.placements.push({
        ...cell,
        id: `cell-${index}`,
        type: 'conveyor',
        routeId: 'cross-module-route',
        routeIndex: index,
        x: cell.x - owner.position.x / 20,
        y: cell.y - owner.position.y / 20,
      })
    })
    const copy = snapshot({ kind: 'part', stationId: 'b', placementId: 'cell-6' }, [a, b])
    expect(copy?.kind).toBe('placements')
    if (copy?.kind !== 'placements') throw new Error('Expected placement snapshot')
    expect(copy.source.map(({ x, y, routeIndex }) => ({ x, y, routeIndex }))).toEqual(
      [-4, -3, -2, -1, 0, 1, 2].map((x, routeIndex) => ({ x, y: 6, routeIndex })),
    )
    expect(copy.source.every((piece) => piece.routeId === 'cross-module-route' && !('stationId' in piece))).toBe(true)
  })

  it('keeps exact area IDs in world cells and detaches mutable metadata and owner annotations', () => {
    const original = machine()
    const stations = [station('a', -320, [original]), station('b', 0, [{ id: 'box', type: 'container', x: 3, y: 7, direction: 'south' }])]
    stations[1].placements.push({ id: 'outside-selection', type: 'conveyor', x: 10, y: 10, direction: 'east', incoming: 'west' })
    const copy = snapshot({ kind: 'area', ids: ['machine', 'box'] }, stations)
    expect(copy?.kind).toBe('placements')
    if (copy?.kind !== 'placements') throw new Error('Expected placement snapshot')
    expect(copy.source.map(({ id, x, y }) => ({ id, x, y }))).toEqual([
      { id: 'machine', x: -14, y: 0 },
      { id: 'box', x: 3, y: 5 },
    ])
    expect(copy.source.every((piece) => !('stationId' in piece))).toBe(true)
    original.x = 9
    original.disabledOutputPorts?.push('north:1')
    expect(copy.source[0]).toMatchObject({ x: -14, recipeId: original.recipeId, disabledOutputPorts: ['west:1'] })
  })
})
