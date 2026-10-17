// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useBaseDesignerStore } from '@/store/base-designer.store'
import { useEditorTools } from '@/features/base-designer/ui/tools/use-editor-tools'
import { beltConnections } from '@/features/base-designer/lib/belts'
import { readSceneDocument, writeSceneDocument } from '@/features/base-designer/lib/scene-document'
import { allSelections } from '@/features/base-designer/lib/selection'
import { mixedScene } from './scene-fixture'
import { buildingPorts } from '@/features/base-designer/model/buildings'
import { logisticsPorts } from '@/features/base-designer/model/logistics'
import { CELL_SIZE } from '@/features/base-designer/model/scene'

beforeEach(() =>
  useBaseDesignerStore.setState({ stations: [], buildings: [], belts: [], splitters: [], tunnels: [], past: [], future: [] }),
)
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  useBaseDesignerStore.setState({ stations: [], buildings: [], belts: [], splitters: [], tunnels: [], past: [], future: [] })
})

/** Real tool owner and real store, without mocking the transactions under test. */
function editor() {
  const stationId = useBaseDesignerStore.getState().addStation({ x: 0, y: 0 })!
  const hook = renderHook(() => useEditorTools({ current: null }, { current: null }))
  return { ...hook, stationId }
}

describe('Explicit group tool lifecycle', () => {
  it('retains rejection diagnostics and clears them on accepted or unchanged keyboard proposals', () => {
    const { result, stationId } = editor()
    const id = useBaseDesignerStore.getState().addBuilding({ stationId, type: 'refinery', rotation: 0, x: 0, y: 0 })!
    act(() => result.current.setSelection({ kind: 'building', id }))
    const before = useBaseDesignerStore.getState(),
      ids = vi.spyOn(crypto, 'randomUUID')
    act(() => result.current.nudge({ x: -1, y: 0 }))
    expect(useBaseDesignerStore.getState()).toBe(before)
    expect(result.current.feedback).toContain('Keep every building entirely on its station')
    act(() => result.current.nudge({ x: 0, y: 0 }))
    expect(useBaseDesignerStore.getState()).toBe(before)
    expect(result.current.feedback).toBeNull()
    act(() => result.current.rotate())
    const turned = useBaseDesignerStore.getState()
    expect(turned.buildings[0].rotation).toBe(90)
    expect(turned.past).toHaveLength(before.past.length + 1)
    act(() => result.current.nudge({ x: 100, y: 0 }))
    expect(useBaseDesignerStore.getState()).toBe(turned)
    expect(result.current.feedback).toContain('Keep every building entirely on its station')
    act(() => result.current.nudge({ x: 1, y: 0 }))
    expect(useBaseDesignerStore.getState().buildings[0].x).toBe(1)
    expect(result.current.feedback).toBeNull()
    expect(useBaseDesignerStore.getState().past).toHaveLength(turned.past.length + 1)
    expect(ids).not.toHaveBeenCalled()
  })

  it('drops a removed single target through the shared selection filter without retaining actionability', () => {
    const scene = mixedScene()
    useBaseDesignerStore.setState(scene)
    const { result, rerender } = renderHook(() => useEditorTools({ current: null }, { current: null }))
    act(() => result.current.setSelection({ kind: 'building', id: 'machine' }))
    expect(result.current.selection).toEqual({ kind: 'building', id: 'machine' })
    act(() => {
      expect(useBaseDesignerStore.getState().removeElements([{ kind: 'building', id: 'machine' }])).toBe(true)
    })
    rerender()
    expect(result.current.selection).toBeNull()
    expect(result.current.selections).toEqual([])
    expect(result.current.selectedIds.size).toBe(0)
    expect(result.current.copyable).toBe(false)
    expect(result.current.rotatable).toBe(false)
    expect(result.current.removable).toBe(false)
  })

  it('keeps one half-cell pivot across confirmed and preview turns without mutating the clipboard', () => {
    const original = mixedScene()
    // Uneven group bounds force the half-cell adjustment; recalculating the pivot after each turn would drift.
    const scene = { ...original, stations: [original.stations[0], { ...original.stations[1], x: 45 }] }
    useBaseDesignerStore.setState(scene)
    const { result } = renderHook(() => useEditorTools({ current: null }, { current: null }))
    act(() => result.current.setSelections(allSelections(scene)))
    const document = writeSceneDocument(useBaseDesignerStore.getState())
    const ids = vi.spyOn(crypto, 'randomUUID')
    for (let turn = 1; turn <= 4; turn++) {
      act(() => result.current.rotate())
      expect(useBaseDesignerStore.getState().past).toHaveLength(turn)
      expect(result.current.feedback).toBeNull()
    }
    expect(writeSceneDocument(useBaseDesignerStore.getState())).toBe(document)
    expect(ids).not.toHaveBeenCalled()
    act(() => result.current.copy())
    const clipboard = result.current.clipboard!
    const clipboardSnapshot = structuredClone(clipboard)
    expect(clipboard.kind).toBe('group')
    const before = useBaseDesignerStore.getState()
    act(() => result.current.chooseTool({ kind: 'place', item: clipboard }))
    for (let turn = 0; turn < 4; turn++) {
      act(() => result.current.rotate())
      expect(clipboard).toEqual(clipboardSnapshot)
      expect(useBaseDesignerStore.getState()).toBe(before)
    }
    expect(result.current.tool).toEqual({ kind: 'place', item: clipboard, pivot: { x: 29.5, y: 15.5 } })
    expect(result.current.clipboard).toBe(clipboard)
    expect(useBaseDesignerStore.getState()).toBe(before)
    act(() => result.current.escape())
    expect(result.current.tool).toEqual({ kind: 'select' })
    expect(result.current.clipboard).toBe(clipboard)
    expect(useBaseDesignerStore.getState()).toBe(before)
  })

  it('retains an earlier clipboard after a rejected cut, then cuts and repeatedly pastes only explicit contents atomically', () => {
    const scene = mixedScene()
    useBaseDesignerStore.setState(scene)
    const { result } = renderHook(() => useEditorTools({ current: null }, { current: null }))
    act(() =>
      result.current.setSelections([
        { kind: 'building', id: 'machine' },
        { kind: 'belt', id: 'route' },
      ]),
    )
    act(() => result.current.copy())
    const earlierClipboard = result.current.clipboard
    act(() => result.current.setSelection({ kind: 'station', id: 'floor' }))
    const before = useBaseDesignerStore.getState()
    act(() => result.current.remove(true))
    expect(useBaseDesignerStore.getState()).toBe(before)
    expect(result.current.clipboard).toBe(earlierClipboard)
    expect(result.current.feedback).toBeTruthy()
    act(() =>
      result.current.setSelections(
        allSelections(scene)
          .filter((item) => item.id !== 'drone')
          .reverse(),
      ),
    )
    act(() => result.current.remove(true))
    const clipboard = result.current.clipboard!
    expect(clipboard.kind).toBe('group')
    expect(clipboard).not.toBe(earlierClipboard)
    expect(allSelections(useBaseDesignerStore.getState())).toEqual([{ kind: 'station', id: 'drone' }])
    expect(useBaseDesignerStore.getState().past).toHaveLength(1)
    act(() => result.current.restoreHistory('undo'))
    expect(result.current.clipboard).toBe(clipboard)
    expect(result.current.selections).toEqual([])
    expect(result.current.tool).toEqual({ kind: 'select' })
    expect(writeSceneDocument(useBaseDesignerStore.getState())).toBe(writeSceneDocument(before))
    act(() => result.current.chooseTool({ kind: 'place', item: clipboard }))
    act(() => result.current.click({ x: -1200, y: -600 }))
    act(() => result.current.click({ x: -2400, y: -600 }))
    expect(useBaseDesignerStore.getState().past).toHaveLength(2)
    expect(useBaseDesignerStore.getState().buildings).toHaveLength(3)
    expect(useBaseDesignerStore.getState().tunnels).toHaveLength(3)
    expect(result.current.selections).toHaveLength(6)
    const confirmed = useBaseDesignerStore.getState(),
      ids = vi.spyOn(crypto, 'randomUUID')
    act(() => result.current.click({ x: -2400, y: -600 }))
    expect(useBaseDesignerStore.getState()).toBe(confirmed)
    expect(ids).not.toHaveBeenCalled()
    expect(result.current.clipboard).toBe(clipboard)
  })
})

describe('Manual drawing and clipboard commands', () => {
  it('places aligned stations and confirms, cuts and pastes one complete route through their corridor', () => {
    const { result } = editor()
    act(() => result.current.chooseTool({ kind: 'place', item: { kind: 'station' } }))
    act(() => result.current.click({ x: 300, y: 20 }))
    expect(useBaseDesignerStore.getState().stations[1]).toMatchObject({ x: 16, y: 0 })
    act(() => result.current.chooseTool({ kind: 'belt', points: [] }))
    act(() => result.current.click({ x: 230, y: 110 }))
    act(() => result.current.click({ x: 390, y: 110 }))
    act(() => result.current.click({ x: 390, y: 110 }))
    expect(useBaseDesignerStore.getState().belts[0].points).toEqual([
      { x: 11, y: 5 },
      { x: 19, y: 5 },
    ])
    act(() => result.current.remove(true))
    const clipboard = result.current.clipboard!
    act(() => result.current.chooseTool({ kind: 'place', item: clipboard }))
    act(() => result.current.click({ x: 230, y: 130 }))
    act(() => result.current.click({ x: 230, y: 170 }))
    const copies = useBaseDesignerStore.getState().belts
    expect(copies.map((belt) => belt.points)).toEqual([
      [
        { x: 11, y: 6 },
        { x: 19, y: 6 },
      ],
      [
        { x: 11, y: 8 },
        { x: 19, y: 8 },
      ],
    ])
    act(() => result.current.click({ x: 230, y: 210 }))
    expect(useBaseDesignerStore.getState().belts).toBe(copies)
    act(() => result.current.restoreHistory('undo'))
    expect(useBaseDesignerStore.getState().belts).toHaveLength(1)
    expect(result.current.clipboard).toBe(clipboard)
  })

  it('undoes cuts and repeated pastes without rewinding the clipboard; history cancels drafts and selection', () => {
    const { result } = editor()
    act(() => result.current.chooseTool({ kind: 'belt', points: [] }))
    act(() => result.current.click({ x: 50, y: 170 }))
    act(() => result.current.click({ x: 130, y: 170 }))
    act(() => result.current.click({ x: 130, y: 170 }))
    const belt = useBaseDesignerStore.getState().belts[0]
    act(() => result.current.remove(true))
    const clipboard = result.current.clipboard!
    act(() => result.current.chooseTool({ kind: 'place', item: clipboard }))
    act(() => result.current.click({ x: 50, y: 210 }))
    act(() => result.current.click({ x: 50, y: 250 }))
    const copies = useBaseDesignerStore.getState().belts
    act(() => result.current.restoreHistory('undo'))
    expect(result.current.tool).toEqual({ kind: 'select' })
    expect(result.current.selection).toBeNull()
    expect(result.current.clipboard).toBe(clipboard)
    expect(useBaseDesignerStore.getState().belts).toEqual([copies[0]])
    act(() => result.current.restoreHistory('undo'))
    act(() => result.current.restoreHistory('undo'))
    expect(useBaseDesignerStore.getState().belts).toEqual([belt])
    const before = useBaseDesignerStore.getState()
    act(() => result.current.chooseTool({ kind: 'belt', points: [] }))
    act(() => result.current.click({ x: 50, y: 130 }))
    expect(useBaseDesignerStore.getState()).toBe(before)
    act(() => result.current.restoreHistory('redo'))
    expect(result.current.tool).toEqual({ kind: 'select' })
    expect(result.current.clipboard).toBe(clipboard)
    expect(useBaseDesignerStore.getState().belts).toHaveLength(0)
    act(() => result.current.restoreHistory('redo'))
    act(() => result.current.restoreHistory('redo'))
    expect(useBaseDesignerStore.getState().belts).toEqual(copies)
  })

  it('right-click removes one anchor, then cancels the initial one; only a repeated final click commits', () => {
    const { result } = editor()
    act(() => result.current.chooseTool({ kind: 'belt', points: [] }))
    act(() => result.current.click({ x: 50, y: 150 }))
    act(() => result.current.click({ x: 130, y: 150 }))
    expect(useBaseDesignerStore.getState().belts).toHaveLength(0)
    act(() => result.current.rightClick())
    expect(result.current.tool).toEqual({ kind: 'belt', points: [{ x: 2, y: 7 }], clickEnds: [1] })
    act(() => result.current.rightClick())
    expect(result.current.tool).toEqual({ kind: 'belt', points: [] })
    act(() => result.current.click({ x: 50, y: 150 }))
    act(() => result.current.click({ x: 130, y: 150 }))
    act(() => result.current.click({ x: 130, y: 150 }))
    expect(useBaseDesignerStore.getState().belts).toHaveLength(1)
    expect(result.current.tool).toEqual({ kind: 'belt', points: [] })
  })

  it('adds an orthogonal elbow for a diagonal click, cancels the whole click, then cuts/pastes complete routes repeatedly', () => {
    const { result } = editor()
    act(() => result.current.chooseTool({ kind: 'belt', points: [] }))
    act(() => result.current.click({ x: 50, y: 150 }))
    act(() => result.current.click({ x: 130, y: 170 }))
    expect(result.current.tool).toEqual({
      kind: 'belt',
      points: [
        { x: 2, y: 7 },
        { x: 6, y: 7 },
        { x: 6, y: 8 },
      ],
      clickEnds: [1, 3],
    })
    // Right-click removes the destination and its automatic elbow as one user action.
    act(() => result.current.rightClick())
    expect(result.current.tool).toEqual({ kind: 'belt', points: [{ x: 2, y: 7 }], clickEnds: [1] })
    act(() => result.current.click({ x: 130, y: 150 }))
    act(() => result.current.click({ x: 130, y: 150 }))
    act(() => result.current.remove(true))
    expect(useBaseDesignerStore.getState().belts).toHaveLength(0)
    const clipboard = result.current.clipboard!
    expect(clipboard).toEqual({
      kind: 'belt',
      points: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
      ],
    })
    act(() => result.current.chooseTool({ kind: 'place', item: clipboard }))
    act(() => result.current.click({ x: 50, y: 170 }))
    act(() => result.current.click({ x: 50, y: 210 }))
    const belts = useBaseDesignerStore.getState().belts
    expect(belts).toHaveLength(2)
    expect(belts[0].id).not.toBe(belts[1].id)
    expect(belts.map((b) => b.points)).toEqual([
      [
        { x: 2, y: 8 },
        { x: 6, y: 8 },
      ],
      [
        { x: 2, y: 10 },
        { x: 6, y: 10 },
      ],
    ])
    const ids = vi.spyOn(crypto, 'randomUUID')
    act(() => result.current.click({ x: 50, y: 170 }))
    expect(ids).not.toHaveBeenCalled()
    expect(result.current.clipboard).toBe(clipboard)
    expect(result.current.tool.kind).toBe('place')
    expect(useBaseDesignerStore.getState().belts).toBe(belts)
  })

  it.each([false, true])('tries the other elbow and preserves a rejected draft when both are blocked (bothBlocked=%s)', (bothBlocked) => {
    const { result, stationId } = editor()
    const store = useBaseDesignerStore.getState()
    store.addBuilding({ stationId, type: 'refinery', rotation: 0, x: 5, y: 5 })
    if (bothBlocked) store.addBuilding({ stationId, type: 'refinery', rotation: 0, x: 1, y: 9 })
    const before = useBaseDesignerStore.getState()
    const ids = vi.spyOn(crypto, 'randomUUID')
    act(() => result.current.chooseTool({ kind: 'belt', points: [] }))
    act(() => result.current.click({ x: 50, y: 150 }))
    const draft = result.current.tool
    act(() => result.current.click({ x: 170, y: 210 }))
    if (bothBlocked) {
      expect(result.current.tool).toBe(draft)
      expect(result.current.feedback).toBeTruthy()
    } else {
      expect(result.current.tool).toEqual({
        kind: 'belt',
        points: [
          { x: 2, y: 7 },
          { x: 2, y: 10 },
          { x: 8, y: 10 },
        ],
        clickEnds: [1, 3],
      })
      expect(result.current.feedback).toBeNull()
    }
    expect(useBaseDesignerStore.getState()).toBe(before)
    expect(ids).not.toHaveBeenCalled()
  })

  it.each([
    ['underground', false],
    ['underground_mk2', true],
  ] as const)('preserves a disabled tunnel exit through clipboard, history and serialization (type=%s, cut=%s)', (type, cut) => {
    const { result } = editor()
    const store = useBaseDesignerStore.getState()
    const id = store.addTunnel({ type, entry: { x: 1, y: 1 }, exit: { x: 4, y: 1 } })!
    expect(id).toBeTruthy()
    expect(store.setPortOutput({ kind: 'tunnel', id }, 'exit', false)).toBe(true)
    act(() => result.current.setSelection({ kind: 'tunnel', id }))
    act(() => (cut ? result.current.remove(true) : result.current.copy()))
    const clipboard = result.current.clipboard!
    expect(clipboard).toEqual({
      kind: 'tunnel',
      type,
      entry: { x: 0, y: 0 },
      exit: { x: 3, y: 0 },
      disabledOutputs: ['exit'],
    })
    const before = useBaseDesignerStore.getState()
    expect(before.tunnels).toHaveLength(cut ? 0 : 1)
    act(() => result.current.chooseTool({ kind: 'place', item: clipboard }))
    act(() => result.current.click({ x: 20, y: 80 }))
    const pasted = useBaseDesignerStore.getState().tunnels.at(-1)!
    expect(pasted).toEqual({
      id: expect.any(String),
      type,
      entry: { x: 1, y: 4 },
      exit: { x: 4, y: 4 },
      disabledOutputs: ['exit'],
    })
    expect(pasted.id).not.toBe(id)
    expect(useBaseDesignerStore.getState().past).toHaveLength(before.past.length + 1)
    const tunnels = useBaseDesignerStore.getState().tunnels
    act(() => result.current.restoreHistory('undo'))
    expect(useBaseDesignerStore.getState().tunnels).toBe(before.tunnels)
    expect(result.current.clipboard).toBe(clipboard)
    act(() => result.current.restoreHistory('redo'))
    expect(useBaseDesignerStore.getState().tunnels).toBe(tunnels)
    expect(readSceneDocument(JSON.parse(writeSceneDocument(useBaseDesignerStore.getState())))?.tunnels).toEqual(tunnels)
    const restored = useBaseDesignerStore.getState()
    const ids = vi.spyOn(crypto, 'randomUUID')
    act(() => result.current.chooseTool({ kind: 'place', item: clipboard }))
    act(() => result.current.click({ x: 20, y: 80 }))
    expect(useBaseDesignerStore.getState()).toBe(restored)
    expect(ids).not.toHaveBeenCalled()
  })

  it('cutting a building keeps its connected belt fixed and paste reconnects it geometrically', () => {
    const { result, stationId } = editor()
    const store = useBaseDesignerStore.getState()
    const id = store.addBuilding({ stationId, type: 'refinery', rotation: 90, x: 1, y: 2 })!
    store.addBuilding({ stationId, type: 'refinery', rotation: 0, x: 8, y: 2 })
    store.addBelt({
      points: [
        { x: 4, y: 3 },
        { x: 7, y: 3 },
      ],
    })
    const belts = useBaseDesignerStore.getState().belts
    act(() => result.current.setSelection({ kind: 'building', id }))
    act(() => result.current.remove(true))
    expect(useBaseDesignerStore.getState().belts).toBe(belts)
    expect(beltConnections(useBaseDesignerStore.getState(), belts[0]).output).toBeUndefined()
    const clipboard = result.current.clipboard!
    act(() => result.current.chooseTool({ kind: 'place', item: clipboard }))
    act(() => result.current.click({ x: 20, y: 40 }))
    expect(beltConnections(useBaseDesignerStore.getState(), belts[0]).output).toBeDefined()
    expect(useBaseDesignerStore.getState().buildings.find((b) => b.x === 1)?.rotation).toBe(90)
    act(() => result.current.chooseTool({ kind: 'select' }))
    act(() => result.current.setSelection({ kind: 'station', id: stationId }))
    act(() => result.current.remove(true))
    expect(result.current.clipboard).toBe(clipboard)
    expect(useBaseDesignerStore.getState().stations).toHaveLength(1)
  })

  it('rotates palette previews and confirmed buildings without publishing scene hover/draft state', () => {
    const { result, stationId } = editor()
    act(() => result.current.chooseTool({ kind: 'place', item: { kind: 'building', type: 'assembler', rotation: 0 } }))
    const before = useBaseDesignerStore.getState()
    act(() => result.current.rotate())
    expect(useBaseDesignerStore.getState()).toBe(before)
    act(() => result.current.click({ x: 40, y: 40 }))
    const building = useBaseDesignerStore.getState().buildings[0]
    expect(building).toMatchObject({ stationId, type: 'assembler', rotation: 90 })
    act(() => result.current.chooseTool({ kind: 'select' }))
    act(() => result.current.rotate())
    expect(useBaseDesignerStore.getState().buildings[0].rotation).toBe(180)
  })

  it('cuts only empty stations and retains the template across repeated placement and Escape', () => {
    const { result, stationId } = editor()
    act(() => result.current.setSelection({ kind: 'station', id: stationId }))
    act(() => result.current.remove(true))
    const clipboard = result.current.clipboard!
    act(() => result.current.chooseTool({ kind: 'place', item: clipboard }))
    act(() => result.current.click({ x: 0, y: 0 }))
    act(() => result.current.click({ x: 280, y: 0 }))
    expect(useBaseDesignerStore.getState().stations).toHaveLength(2)
    act(() => result.current.chooseTool({ kind: 'select' }))
    expect(result.current.clipboard).toBe(clipboard)
  })
})

describe('Middle-click catalog tools', () => {
  it.each([
    ['building', 'machine', { kind: 'place', item: { kind: 'building', type: 'refinery', rotation: 0, recipeId: 'cobalt_plates' } }],
    ['belt', 'route', { kind: 'belt', type: 'conveyor_mk2', points: [] }],
    ['belt', 'one-cell', { kind: 'belt', type: 'conveyor', points: [] }],
    ['splitter', 'splitter', { kind: 'place', item: { kind: 'splitter', type: 'splitter_mk2', rotation: 0 } }],
    ['tunnel', 'tunnel', { kind: 'tunnel', type: 'underground_mk2' }],
    ['station', 'drone', { kind: 'place', item: { kind: 'station', type: 'drone', rotation: 0, cargo: [null, null] } }],
    ['station', 'floor', { kind: 'place', item: { kind: 'station', type: 'station_2x2_a' } }],
  ] as const)('picks the hovered %s (%s) without changing clipboard, selection or history', (kind, id, tool) => {
    useBaseDesignerStore.setState(mixedScene())
    const { result } = renderHook(() => useEditorTools({ current: null }, { current: null }))
    act(() => result.current.setSelection({ kind: 'belt', id: 'route' }))
    act(() => result.current.copy())
    const clipboard = result.current.clipboard
    const before = useBaseDesignerStore.getState(),
      ids = vi.spyOn(crypto, 'randomUUID')
    act(() => expect(result.current.pickTool({ kind, id })).toBe(true))
    expect(result.current.tool).toEqual(tool)
    expect(result.current.clipboard).toBe(clipboard)
    expect(result.current.selection).toEqual({ kind: 'belt', id: 'route' })
    expect(useBaseDesignerStore.getState()).toBe(before)
    expect(ids).not.toHaveBeenCalled()
    act(() => expect(result.current.pickTool({ kind, id: 'deleted' })).toBe(false))
    expect(result.current.tool).toEqual(tool)
    act(() => result.current.escape())
    expect(result.current.clipboard).toBe(clipboard)
    expect(useBaseDesignerStore.getState()).toBe(before)
  })

  it('places the picked machine recipe with fresh catalog orientation and permissions, with undo/redo', () => {
    useBaseDesignerStore.setState(mixedScene())
    const { result } = renderHook(() => useEditorTools({ current: null }, { current: null }))
    act(() => result.current.pickTool({ kind: 'building', id: 'machine' }))
    const before = useBaseDesignerStore.getState()
    act(() => result.current.click({ x: 140, y: 20 }))
    act(() => result.current.click({ x: 220, y: 20 }))
    const after = useBaseDesignerStore.getState()
    expect(after.buildings).toHaveLength(3)
    expect(after.past).toHaveLength(before.past.length + 2)
    for (const building of after.buildings.slice(1)) {
      expect(building).toMatchObject({ type: 'refinery', rotation: 0, recipeId: 'cobalt_plates' })
      expect(building.disabledOutputs).toBeUndefined()
    }
    act(() => result.current.restoreHistory('undo'))
    expect(useBaseDesignerStore.getState().buildings).toHaveLength(2)
    act(() => result.current.restoreHistory('redo'))
    expect(useBaseDesignerStore.getState().buildings).toBe(after.buildings)
    expect(result.current.clipboard).toBeNull()
  })
})

describe('Route continuation and joins', () => {
  it.each(['building', 'splitter', 'tunnel'] as const)(
    'finishes on a direct %s I/O hit with one transaction and no extra anchor',
    (kind) => {
      const { result, stationId } = editor(),
        store = useBaseDesignerStore.getState()
      store.addBuilding({ stationId, type: 'refinery', rotation: 0, x: 1, y: 2 })
      if (kind === 'building') store.addBuilding({ stationId, type: 'refinery', rotation: 0, x: 8, y: 2 })
      if (kind === 'splitter') store.addSplitter({ type: 'splitter_mk2', rotation: 0, x: 8, y: 3 })
      if (kind === 'tunnel') store.addTunnel({ type: 'underground_mk2', entry: { x: 8, y: 3 }, exit: { x: 11, y: 3 } })
      const before = useBaseDesignerStore.getState()
      const source = buildingPorts(before.buildings[0]).find((port) => port.normal.x === 1)!
      const destination =
        kind === 'building'
          ? buildingPorts(before.buildings[1]).find((port) => port.normal.x === -1)!
          : logisticsPorts(before).find((port) => port.role === 'input')!
      const ids = vi.spyOn(crypto, 'randomUUID')
      act(() => result.current.chooseTool({ kind: 'belt', type: 'conveyor_mk2', points: [] }))
      act(() => result.current.click({ x: source.position.x * CELL_SIZE, y: source.position.y * CELL_SIZE }, source.cell, source.normal))
      expect(useBaseDesignerStore.getState()).toBe(before)
      act(() =>
        result.current.click(
          { x: destination.position.x * CELL_SIZE, y: destination.position.y * CELL_SIZE },
          destination.cell,
          destination.normal,
        ),
      )
      const after = useBaseDesignerStore.getState(),
        route = after.belts[0]
      expect(route.points).toEqual([source.cell, destination.cell])
      expect(route.type).toBe('conveyor_mk2')
      expect(after.past).toHaveLength(before.past.length + 1)
      expect(ids).toHaveBeenCalledTimes(1)
      expect(result.current.tool).toEqual({ kind: 'belt', type: 'conveyor_mk2', points: [] })
      expect(result.current.feedback).toBeNull()
      expect(beltConnections(after, route).output?.buildingId).toBe(before.buildings[0].id)
      expect(kind === 'building' ? beltConnections(after, route).input : beltConnections(after, route).logisticsInput).toBeDefined()
      act(() => result.current.restoreHistory('undo'))
      expect(useBaseDesignerStore.getState().belts).toBe(before.belts)
      act(() => result.current.restoreHistory('redo'))
      expect(useBaseDesignerStore.getState().belts).toBe(after.belts)
    },
  )

  it.each([undefined, 'conveyor_mk2'] as const)('completes a one-cell I/O connection while retaining its direction (type=%s)', (type) => {
    const { result, stationId } = editor(),
      store = useBaseDesignerStore.getState()
    store.addBuilding({ stationId, type: 'refinery', rotation: 0, x: 1, y: 2 })
    store.addBuilding({ stationId, type: 'refinery', rotation: 0, x: 5, y: 2 })
    const before = useBaseDesignerStore.getState()
    act(() => result.current.chooseTool({ kind: 'belt', type, points: [] }))
    act(() => result.current.click({ x: 80, y: 70 }, { x: 4, y: 3 }, { x: 1, y: 0 }))
    act(() => result.current.click({ x: 100, y: 70 }, { x: 4, y: 3 }, { x: -1, y: 0 }))
    const after = useBaseDesignerStore.getState()
    expect(after.belts).toMatchObject([{ points: [{ x: 4, y: 3 }], heading: { x: 1, y: 0 } }])
    expect(after.belts[0].type).toBe(type)
    expect(after.past).toHaveLength(before.past.length + 1)
    expect(beltConnections(after, after.belts[0]).input?.buildingId).toBe(before.buildings[1].id)
  })

  it('keeps a repeated click on the same sole port cancellable without creating a one-cell route or transaction', () => {
    const { result, stationId } = editor()
    useBaseDesignerStore.getState().addBuilding({ stationId, type: 'refinery', rotation: 0, x: 1, y: 2 })
    const before = useBaseDesignerStore.getState(),
      source = buildingPorts(before.buildings[0]).find((port) => port.normal.x === 1)!,
      ids = vi.spyOn(crypto, 'randomUUID')
    act(() => result.current.chooseTool({ kind: 'belt', points: [] }))
    act(() => result.current.click({ x: 80, y: 70 }, source.cell, source.normal))
    const draft = result.current.tool
    act(() => result.current.click({ x: 80, y: 70 }, source.cell, source.normal))
    expect(result.current.tool).toBe(draft)
    expect(useBaseDesignerStore.getState()).toBe(before)
    expect(ids).not.toHaveBeenCalled()
    act(() => result.current.rightClick())
    expect(result.current.tool).toEqual({ kind: 'belt', points: [] })
    act(() => result.current.escape())
    expect(useBaseDesignerStore.getState()).toBe(before)
    expect(ids).not.toHaveBeenCalled()
  })

  it('finishes an extended route on I/O without replacing its identity or original level', () => {
    const { result, stationId } = editor(),
      store = useBaseDesignerStore.getState()
    store.addBuilding({ stationId, type: 'refinery', rotation: 0, x: 8, y: 2 })
    const id = store.addBelt({
      type: 'conveyor',
      points: [
        { x: 4, y: 3 },
        { x: 5, y: 3 },
      ],
    })!
    const before = useBaseDesignerStore.getState(),
      ids = vi.spyOn(crypto, 'randomUUID')
    act(() => result.current.chooseTool({ kind: 'belt', type: 'conveyor_mk2', points: [] }))
    act(() => result.current.click({ x: 110, y: 70 }))
    act(() => result.current.click({ x: 160, y: 70 }, { x: 7, y: 3 }, { x: -1, y: 0 }))
    const after = useBaseDesignerStore.getState()
    expect(after.belts).toEqual([
      {
        id,
        type: 'conveyor',
        points: [
          { x: 4, y: 3 },
          { x: 5, y: 3 },
          { x: 7, y: 3 },
        ],
      },
    ])
    expect(after.past).toHaveLength(before.past.length + 1)
    expect(ids).not.toHaveBeenCalled()
  })

  it('keeps proximity clicks as anchors and an invalid I/O hit cancellable without IDs or history', () => {
    const { result, stationId } = editor()
    useBaseDesignerStore.getState().addBuilding({ stationId, type: 'refinery', rotation: 0, x: 8, y: 2 })
    const before = useBaseDesignerStore.getState(),
      ids = vi.spyOn(crypto, 'randomUUID')
    act(() => result.current.chooseTool({ kind: 'belt', points: [] }))
    act(() => result.current.click({ x: 90, y: 70 }))
    act(() => result.current.click({ x: 150, y: 70 }))
    const draft = result.current.tool
    expect(useBaseDesignerStore.getState()).toBe(before)
    expect(draft.kind === 'belt' && draft.points).toHaveLength(2)
    act(() => result.current.click({ x: 500, y: 70 }, { x: 25, y: 3 }, { x: -1, y: 0 }))
    expect(result.current.tool).toBe(draft)
    expect(result.current.feedback).toBeTruthy()
    expect(useBaseDesignerStore.getState()).toBe(before)
    expect(ids).not.toHaveBeenCalled()
    act(() => result.current.escape())
    expect(useBaseDesignerStore.getState()).toBe(before)
  })

  it('keeps extension drafts cancellable, then commits one edit with the same ID and undo/redo', () => {
    const { result } = editor()
    const original = {
      points: [
        { x: 2, y: 10 },
        { x: 5, y: 10 },
      ],
    }
    const id = useBaseDesignerStore.getState().addBelt(original)!
    const before = useBaseDesignerStore.getState()
    const ids = vi.spyOn(crypto, 'randomUUID')
    act(() => result.current.chooseTool({ kind: 'belt', points: [] }))
    act(() => result.current.click({ x: 110, y: 210 }))
    act(() => result.current.click({ x: 170, y: 210 }))
    expect(useBaseDesignerStore.getState()).toBe(before)
    act(() => result.current.rightClick())
    act(() => result.current.rightClick())
    expect(result.current.tool).toEqual({ kind: 'belt', points: [] })
    expect(useBaseDesignerStore.getState()).toBe(before)
    act(() => result.current.click({ x: 110, y: 210 }))
    act(() => result.current.click({ x: 170, y: 210 }))
    act(() => result.current.click({ x: 170, y: 210 }))
    const extended = useBaseDesignerStore.getState()
    expect(extended.belts).toEqual([{ id, points: [...original.points, { x: 8, y: 10 }] }])
    expect(extended.past).toHaveLength(before.past.length + 1)
    expect(ids).not.toHaveBeenCalled()
    act(() => result.current.restoreHistory('undo'))
    expect(useBaseDesignerStore.getState().belts).toBe(before.belts)
    act(() => result.current.restoreHistory('redo'))
    expect(useBaseDesignerStore.getState().belts).toBe(extended.belts)
  })

  it('joins a continuation into one route, then cuts and pastes that complete route', () => {
    const { result, stationId } = editor()
    const store = useBaseDesignerStore.getState()
    store.addBuilding({ stationId, type: 'refinery', rotation: 0, x: 1, y: 6 })
    store.addBuilding({ stationId, type: 'refinery', rotation: 0, x: 10, y: 6 })
    const id = store.addBelt({
      points: [
        { x: 6, y: 7 },
        { x: 9, y: 7 },
      ],
    })!
    act(() => result.current.chooseTool({ kind: 'belt', points: [] }))
    for (const x of [90, 130, 130]) act(() => result.current.click({ x, y: 150 }))
    expect(useBaseDesignerStore.getState().belts).toEqual([
      {
        id,
        points: [
          { x: 4, y: 7 },
          { x: 6, y: 7 },
          { x: 9, y: 7 },
        ],
      },
    ])
    act(() => result.current.remove(true))
    expect(useBaseDesignerStore.getState().belts).toEqual([])
    const clipboard = result.current.clipboard!
    act(() => result.current.chooseTool({ kind: 'place', item: clipboard }))
    act(() => result.current.click({ x: 90, y: 150 }))
    expect(useBaseDesignerStore.getState().belts).toHaveLength(1)
    expect(useBaseDesignerStore.getState().belts[0].points).toEqual([
      { x: 4, y: 7 },
      { x: 6, y: 7 },
      { x: 9, y: 7 },
    ])
    expect(result.current.clipboard).toBe(clipboard)
  })

  it('confirms a T explicitly, blocks drawing through it and keeps the branch when cutting/pasting its receiver', () => {
    const { result } = editor()
    const id = useBaseDesignerStore.getState().addBelt({
      points: [
        { x: 4, y: 7 },
        { x: 9, y: 7 },
      ],
    })!
    act(() => result.current.chooseTool({ kind: 'belt', points: [] }))
    act(() => result.current.click({ x: 130, y: 90 }))
    act(() => result.current.click({ x: 130, y: 150 }))
    const draft = result.current.tool
    act(() => result.current.click({ x: 130, y: 190 }))
    expect(result.current.tool).toBe(draft)
    act(() => result.current.click({ x: 130, y: 150 }))
    const branch = useBaseDesignerStore.getState().belts[1]
    expect(branch.points).toEqual([
      { x: 6, y: 4 },
      { x: 6, y: 7 },
    ])
    act(() => result.current.chooseTool({ kind: 'select' }))
    act(() => result.current.setSelection({ kind: 'belt', id }))
    act(() => result.current.remove(true))
    expect(useBaseDesignerStore.getState().belts).toEqual([branch])
    act(() => result.current.chooseTool({ kind: 'place', item: result.current.clipboard! }))
    act(() => result.current.click({ x: 90, y: 150 }))
    expect(useBaseDesignerStore.getState().belts).toHaveLength(2)
    expect(useBaseDesignerStore.getState().belts[0]).toBe(branch)
  })
})
