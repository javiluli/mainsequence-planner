// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Konva from 'konva'
import type { ReactNode } from 'react'
import { EditorCanvas } from '@/features/base-designer/ui/canvas/editor-canvas'
import { useEditorTools } from '@/features/base-designer/ui/tools/use-editor-tools'
import { beltNetwork } from '@/features/base-designer/lib/belt-network'
import { analyzeProduction } from '@/features/base-designer/lib/production-analysis'
import { useBaseDesignerStore } from '@/store/base-designer.store'

beforeEach(() => {
  // Zero-sized jsdom keeps Konva unallocated; native painting/stacking are verified in Chrome.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  useBaseDesignerStore.setState({
    stations: [{ id: 'floor', x: 0, y: 0 }],
    buildings: [],
    belts: [],
    splitters: [],
    tunnels: [],
    past: [],
    future: [],
  })
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  useBaseDesignerStore.setState({ stations: [], buildings: [], belts: [], splitters: [], tunnels: [], past: [], future: [] })
})

/** Real canvas/tool owners with zero-sized jsdom; native geometry and widgets are exercised in Chrome. */
function editorCanvas(details: ReactNode = null) {
  const stageRef = { current: null as Konva.Stage | null },
    containerRef = { current: null as HTMLDivElement | null }
  const { result } = renderHook(() => useEditorTools(stageRef, containerRef))
  const scene = useBaseDesignerStore.getState(),
    network = beltNetwork(scene),
    analysis = analyzeProduction(scene, network)
  const callbacks = { onOpenCargo: vi.fn(), onOpenRecipe: vi.fn(), onHoverPort: vi.fn(), onTogglePort: vi.fn() }
  const canvas = () => (
    <EditorCanvas
      scene={scene}
      network={network}
      analysis={analysis}
      tools={result.current}
      stageRef={stageRef}
      containerRef={containerRef}
      commands={null}
      details={details}
      portHint={null}
      {...callbacks}
    />
  )
  const view = render(canvas())
  return { result, scene, stageRef, view, canvas }
}

describe('Canvas feedback lifecycle', () => {
  it('updates one persistent live region on rejection and clears it on Escape without a transaction', () => {
    const { result, scene, view, canvas } = editorCanvas()
    const status = screen.getByRole('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.getAttribute('aria-atomic')).toBe('true')
    expect(status.textContent).toBe('')
    const ids = vi.spyOn(crypto, 'randomUUID')
    act(() => result.current.chooseTool({ kind: 'place', item: { kind: 'building', type: 'refinery', rotation: 0 } }))
    act(() => result.current.click({ x: 800, y: 400 }))
    view.rerender(canvas())
    expect(screen.getByRole('status')).toBe(status)
    expect(status.textContent).toBe('Place this building on an ordinary station floor.')
    expect(useBaseDesignerStore.getState()).toBe(scene)
    expect(ids).not.toHaveBeenCalled()
    act(() => result.current.escape())
    view.rerender(canvas())
    expect(screen.getByRole('status')).toBe(status)
    expect(status.textContent).toBe('')
    expect(document.activeElement).toBe(screen.getByRole('region', { name: 'Base canvas' }))
    expect(useBaseDesignerStore.getState()).toBe(scene)
  })
})

describe('Canvas shortcut scope', () => {
  it('centers from a canvas control that stops bubbling without editing the scene', () => {
    const { stageRef, scene } = editorCanvas(<button onKeyDown={(event) => event.stopPropagation()}>Canvas control</button>)
    // No Stage/renderer is allocated: Group supplies the native coordinate APIs used by centering.
    const stage = new Konva.Group({ scaleX: 1.2, scaleY: 1.2 }) as unknown as Konva.Stage
    stageRef.current = stage
    const control = screen.getByRole('button', { name: 'Canvas control' })
    control.focus()
    expect(fireEvent.keyDown(control, { key: 'c' })).toBe(false)
    expect(stage.scaleX()).toBe(1)
    expect(stage.scaleY()).toBe(1)
    expect(useBaseDesignerStore.getState()).toBe(scene)
    expect(document.activeElement).toBe(control)
  })

  it('preserves field/panel keys, modified shortcuts and repeated keys', () => {
    const { stageRef } = editorCanvas(
      <>
        <input aria-label="Text entry" />
        <div id="base-production-panel">
          <button>Production control</button>
        </div>
      </>,
    )
    const stage = new Konva.Group({ scaleX: 1.2, scaleY: 1.2 }) as unknown as Konva.Stage
    stageRef.current = stage
    expect(fireEvent.keyDown(screen.getByRole('textbox'), { key: 'c' })).toBe(true)
    expect(fireEvent.keyDown(screen.getByRole('button', { name: 'Production control' }), { key: 'c' })).toBe(true)
    const canvas = screen.getByRole('region', { name: 'Base canvas' })
    expect(fireEvent.keyDown(canvas, { key: 'c', ctrlKey: true })).toBe(true)
    expect(fireEvent.keyDown(canvas, { key: 'c', metaKey: true })).toBe(true)
    expect(fireEvent.keyDown(canvas, { key: 'c', altKey: true })).toBe(true)
    expect(fireEvent.keyDown(canvas, { key: 'c', repeat: true })).toBe(true)
    expect(stage.scaleX()).toBe(1.2)
  })
})
