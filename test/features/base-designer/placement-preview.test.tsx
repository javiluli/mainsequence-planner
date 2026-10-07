// @vitest-environment jsdom
import type { PointerEvent } from 'react'
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ClipboardPasteProposal, LayoutClipboard } from '@/features/base-designer/lib/clipboard/clipboard'
import { recipesForPlaceable } from '@/features/base-designer/lib/products/machine-recipes'
import type { BasePlacement, BaseStation } from '@/features/base-designer/lib/layout/placement'
import { usePlacementPreview } from '@/features/base-designer/ui/placement/use-placement-preview'
import { useBaseDesignerStore } from '@/store/base-designer.store'

function pointer(x: number, y: number): PointerEvent<HTMLDivElement> {
  return {
    clientX: x,
    clientY: y,
    isPrimary: true,
    button: 0,
    currentTarget: document.createElement('div'),
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  } as unknown as PointerEvent<HTMLDivElement>
}

function floor(position = { x: 0, y: 0 }): BaseStation {
  return { id: 'floor', type: 'station_1x1', name: 'Floor', position, lockedTo: [], placements: [] }
}

function machine(): BasePlacement {
  return {
    id: 'source-machine',
    type: 'assembler',
    x: 2,
    y: 2,
    direction: 'east',
    recipeId: recipesForPlaceable('assembler')[0].id,
    disabledOutputPorts: ['east:1', 'south:3'],
  }
}

function renderPreview(project = (point: { x: number; y: number }) => point) {
  const onConfirm = vi.fn((proposal: ClipboardPasteProposal) => {
    const store = useBaseDesignerStore.getState()
    return proposal.kind === 'layout'
      ? Boolean(store.pasteLayout(proposal.draft))
      : Boolean(store.pastePlacements(proposal.stationId, proposal.source, proposal.cursor))
  })
  const hook = renderHook(() => usePlacementPreview({ stations: useBaseDesignerStore((state) => state.stations), project, onConfirm }))
  return { ...hook, onConfirm }
}

afterEach(() => {
  cleanup()
  useBaseDesignerStore.setState({ stations: [], notes: [], past: [], future: [] })
})

describe('unified placement preview', () => {
  it('projects client pixels to negative world cells, preserving relative offsets without insertion', () => {
    const source: BasePlacement[] = [machine(), { id: 'box', type: 'container', x: 10, y: 3, direction: 'north' }]
    const original = structuredClone(source)
    const { result, onConfirm } = renderPreview(({ x, y }) => ({ x: x * 2 - 40, y: y * 2 + 20 }))
    act(() => result.current.start({ kind: 'placements', source }, { x: -1, y: -21 }))
    const preview = result.current.preview
    expect(preview?.kind).toBe('placements')
    if (preview?.kind !== 'placements') throw new Error('Expected placement preview')
    expect(preview.cursor).toEqual({ x: -3, y: -2 })
    expect(preview.pieces.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: -7, y: -4 },
      { x: 1, y: -3 },
    ])
    expect(preview.valid).toBe(false)
    expect(source).toEqual(original)
    expect(onConfirm).not.toHaveBeenCalled()
    expect(useBaseDesignerStore.getState().past).toEqual([])
  })

  it('rotates mixed footprints and physical output offsets from a fixed source and returns after four turns', () => {
    const source: BasePlacement[] = [machine(), { id: 'box', type: 'container', x: 10, y: 3, direction: 'north' }]
    const original = structuredClone(source)
    const { result } = renderPreview()
    act(() => result.current.start({ kind: 'placements', source }, { x: 200, y: 200 }))
    const before = structuredClone(result.current.preview)
    act(() => result.current.rotate(1))
    const rotated = result.current.preview
    expect(rotated?.kind).toBe('placements')
    if (rotated?.kind !== 'placements') throw new Error('Expected placement preview')
    expect(rotated.source[0]).toMatchObject({
      direction: 'south',
      recipeId: original[0].recipeId,
      disabledOutputPorts: ['south:3', 'west:3'],
    })
    expect(rotated.source.every((piece) => Number.isInteger(piece.x) && Number.isInteger(piece.y))).toBe(true)
    act(() => {
      result.current.rotate(1)
      result.current.rotate(1)
      result.current.rotate(1)
    })
    expect(result.current.preview).toEqual(before)
    expect(source).toEqual(original)
    expect(useBaseDesignerStore.getState().past).toEqual([])
  })

  it('repeats placement with fresh identities, rejects an occupied repeat and records one undo per success', () => {
    useBaseDesignerStore.setState({ stations: [floor()] })
    const { result, onConfirm } = renderPreview()
    const source = machine()
    act(() => result.current.start({ kind: 'placements', source: [source] }, { x: 100, y: 100 }))
    act(() => result.current.handlePointerDown(pointer(100, 100)))
    const first = useBaseDesignerStore.getState()
    expect(first.stations[0].placements).toHaveLength(1)
    expect(first.past).toHaveLength(1)
    expect(first.stations[0].placements[0]).toMatchObject({
      x: 3,
      y: 3,
      recipeId: source.recipeId,
      disabledOutputPorts: source.disabledOutputPorts,
    })
    expect(result.current.active).toBe(true)
    act(() => result.current.handlePointerDown(pointer(100, 100)))
    expect(onConfirm).toHaveLastReturnedWith(false)
    expect(useBaseDesignerStore.getState()).toBe(first)
    act(() => {
      result.current.handlePointerMove(pointer(220, 100))
      result.current.handlePointerDown(pointer(220, 100))
    })
    const second = useBaseDesignerStore.getState()
    expect(second.past).toHaveLength(2)
    expect(second.stations[0].placements.map((piece) => piece.x)).toEqual([3, 9])
    expect(new Set(second.stations[0].placements.map((piece) => piece.id)).size).toBe(2)
    expect(second.stations[0].placements.every((piece) => piece.id !== source.id && !('stationId' in piece))).toBe(true)
    act(() => result.current.cancel())
    expect(useBaseDesignerStore.getState()).toBe(second)
    act(() => useBaseDesignerStore.getState().undo())
    expect(useBaseDesignerStore.getState().stations).toEqual(first.stations)
    act(() => useBaseDesignerStore.getState().redo())
    expect(useBaseDesignerStore.getState().stations).toEqual(second.stations)
  })

  it('revalidates confirmation when another operation occupies the destination before React paints', () => {
    useBaseDesignerStore.setState({ stations: [floor()] })
    const { result, onConfirm } = renderPreview()
    act(() => result.current.start({ kind: 'placements', source: [machine()] }, { x: 100, y: 100 }))
    expect(result.current.preview?.valid).toBe(true)
    act(() => {
      expect(useBaseDesignerStore.getState().place('floor', 'refinery', 4, 4)).toBe(true)
      result.current.handlePointerDown(pointer(100, 100))
    })
    expect(onConfirm).toHaveLastReturnedWith(false)
    expect(useBaseDesignerStore.getState().stations[0].placements).toHaveLength(1)
    expect(useBaseDesignerStore.getState().past).toHaveLength(1)
    expect(result.current.preview?.valid).toBe(false)
    expect(result.current.active).toBe(true)
  })

  it('replaces layout and piece sessions, preserving a translated layout pivot across consecutive turns', () => {
    const source: LayoutClipboard = {
      stations: [
        { ...floor(), direction: 'south' },
        { ...floor({ x: 320, y: 0 }), id: 'drone', type: 'drone_station', direction: 'south' },
      ],
      notes: [{ id: 'note', position: { x: 660, y: 40 }, text: 'Upright' }],
      skippedRoutes: 0,
      skippedParts: 0,
    }
    const { result, onConfirm } = renderPreview()
    act(() => result.current.start({ kind: 'layout', source }, { x: 800, y: 600 }))
    act(() => result.current.handlePointerMove(pointer(820, 600)))
    const translated = structuredClone(result.current.preview)
    act(() => {
      for (let turn = 0; turn < 4; turn++) result.current.rotate(1)
    })
    expect(result.current.preview).toEqual(translated)
    act(() => result.current.start({ kind: 'placements', source: [machine()] }, { x: 100, y: 100 }))
    expect(result.current.preview?.kind).toBe('placements')
    act(() => result.current.start({ kind: 'layout', source }, { x: 800, y: 600 }))
    expect(result.current.preview?.kind).toBe('layout')
    act(() => result.current.cancel())
    expect(result.current.preview).toBeNull()
    expect(onConfirm).not.toHaveBeenCalled()
    expect(useBaseDesignerStore.getState().past).toEqual([])
  })

  it('keeps route handoff in world cells without reprojecting and rotates tunnel metadata together', () => {
    const project = vi.fn((point: { x: number; y: number }) => ({ x: point.x + 1000, y: point.y + 1000 }))
    const { result } = renderPreview(project)
    const cells = [
      { x: -4, y: 6, direction: 'east', incoming: 'west', buried: false, routeIndex: 0 },
      { x: -3, y: 6, direction: 'east', incoming: 'west', buried: true, routeIndex: 1 },
      { x: -2, y: 6, direction: 'east', incoming: 'west', buried: false, routeIndex: 2 },
    ] satisfies Parameters<typeof result.current.startRoute>[1]
    act(() => result.current.startRoute('underground_mk2', cells, 1))
    const preview = result.current.preview
    expect(preview?.kind).toBe('placements')
    if (preview?.kind !== 'placements') throw new Error('Expected placement preview')
    expect(preview.cursor).toEqual({ x: -3, y: 6 })
    expect(preview.pieces.map(({ x, y }) => ({ x, y }))).toEqual([
      { x: -3, y: 5 },
      { x: -3, y: 6 },
      { x: -3, y: 7 },
    ])
    expect(preview.source.every((piece) => piece.direction === 'south' && piece.incoming === 'north')).toBe(true)
    expect(preview.source.map(({ buried, routeIndex }) => ({ buried, routeIndex }))).toEqual([
      { buried: false, routeIndex: 0 },
      { buried: true, routeIndex: 1 },
      { buried: false, routeIndex: 2 },
    ])
    expect(project).not.toHaveBeenCalled()
    expect(useBaseDesignerStore.getState().past).toEqual([])
  })
})
