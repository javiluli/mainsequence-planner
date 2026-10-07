// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import type { PointerEvent } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { changeNodeSelection } from '@/features/base-designer/model/editor-selection'
import { useBaseDesignerStore } from '@/store/base-designer.store'
import type { LayoutClipboard } from '@/features/base-designer/lib/clipboard/clipboard'
import { usePlacementPreview } from '@/features/base-designer/ui/placement/use-placement-preview'
import { useNodeMovement } from '@/features/base-designer/ui/placement/use-node-movement'

const source: LayoutClipboard = {
  stations: [
    { id: 'a', type: 'station_1x1', name: 'A', position: { x: 0, y: 0 }, lockedTo: ['b'], placements: [] },
    { id: 'b', type: 'station_1x1', name: 'B', position: { x: 320, y: 0 }, lockedTo: ['a'], placements: [] },
  ],
  notes: [],
  skippedRoutes: 0,
  skippedParts: 0,
}
function pointer(x: number, y: number, button = 0): PointerEvent<HTMLDivElement> {
  return {
    clientX: x,
    clientY: y,
    isPrimary: true,
    button,
    currentTarget: document.createElement('div'),
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as PointerEvent<HTMLDivElement>
}
afterEach(() => {
  cleanup()
  useBaseDesignerStore.setState({ stations: [], notes: [], past: [], future: [] })
})
describe('explicit editor selection', () => {
  it('keeps the whole area selection, toggles a single node and clears the final node', () => {
    const selected = changeNodeSelection(null, [
      { id: 'a', selected: true },
      { id: 'b', selected: true },
    ])
    expect(selected).toEqual({ kind: 'nodes', ids: ['a', 'b'] })
    const one = changeNodeSelection(selected, [{ id: 'a', selected: false }])
    expect(one).toEqual({ kind: 'nodes', ids: ['b'] })
    expect(changeNodeSelection(one, [{ id: 'b', selected: false }])).toBeNull()
  })
  it('does not replace piece selection with unrelated deselection notifications', () => {
    const piece = { kind: 'part' as const, stationId: 'a', placementId: 'machine' }
    expect(changeNodeSelection(piece, [{ id: 'a', selected: false }])).toBe(piece)
    expect(changeNodeSelection(piece, [{ id: 'b', selected: true }])).toEqual({ kind: 'nodes', ids: ['b'] })
  })
})
describe('repeatable layout clipboard preview', () => {
  it('projects once per pointer, preserves offsets and repeats accepted or rejected placements until cancellation', () => {
    const onConfirm = vi.fn(() => false)
    const { result } = renderHook(() => usePlacementPreview({ stations: [], project: ({ x, y }) => ({ x: x * 2, y: y * 2 }), onConfirm }))
    act(() => result.current.start({ kind: 'layout', source }, { x: 300, y: 200 }))
    const initial = result.current.preview
    if (initial?.kind !== 'layout') throw new Error('Expected layout preview')
    expect(initial.draft.stations[0].position).toEqual({ x: 300, y: 260 })
    expect(onConfirm).not.toHaveBeenCalled()
    act(() => result.current.handlePointerMove(pointer(301, 201)))
    expect(result.current.preview).toBe(initial)
    act(() => result.current.handlePointerMove(pointer(350, 200)))
    const moved = result.current.preview
    if (moved?.kind !== 'layout') throw new Error('Expected layout preview')
    expect(moved.draft.stations[0].position).toEqual({ x: 400, y: 260 })
    expect(moved.draft.stations[1].position.x - moved.draft.stations[0].position.x).toBe(320)
    act(() => result.current.handlePointerDown(pointer(350, 200, 2)))
    expect(onConfirm).not.toHaveBeenCalled()
    act(() => result.current.handlePointerDown(pointer(350, 200)))
    expect(onConfirm).toHaveBeenCalledOnce()
    expect(result.current.active).toBe(true)
    onConfirm.mockReturnValue(true)
    act(() => result.current.handlePointerDown(pointer(550, 200)))
    expect(onConfirm).toHaveBeenCalledTimes(2)
    expect(result.current.active).toBe(true)
    act(() => result.current.cancel())
    expect(result.current.active).toBe(false)
    expect(onConfirm).toHaveBeenCalledTimes(2)
  })
})

describe('node movement cancellation', () => {
  it('cancels a station drag without adding undo history or accepting a late finish', () => {
    const stations = [source.stations[0]]
    const notes = source.notes
    useBaseDesignerStore.setState({ stations, notes: [], past: [], future: [] })
    const { result } = renderHook(() =>
      useNodeMovement({
        stations,
        notes,
        selectedIds: ['a'],
        project: (point) => point,
        onConfirm: useBaseDesignerStore.getState().commitLayoutMove,
      }),
    )
    act(() => result.current.start('a', { x: 0, y: 0 }))
    act(() => result.current.move({ x: 40, y: 20 }))
    expect(result.current.stations[0].position).toEqual({ x: 40, y: 20 })
    expect(useBaseDesignerStore.getState().stations).toBe(stations)
    act(() => result.current.cancel())
    act(() => {
      expect(result.current.end()).toBe(false)
    })
    expect(useBaseDesignerStore.getState().stations).toBe(stations)
    expect(useBaseDesignerStore.getState().past).toEqual([])
    expect(result.current.active).toBe(false)
  })
})
