// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useCanvasPan } from '@/features/base-designer/ui/canvas/use-canvas-pan'

const viewport = { x: 120, y: 100, zoom: 0.5 }

function Canvas({ onPan, onContext }: { onPan: Parameters<typeof useCanvasPan>[0]['onPan']; onContext: () => void }) {
  const pan = useCanvasPan({ getViewport: () => viewport, onPan })
  return (
    <div
      data-testid="canvas"
      onPointerDownCapture={pan.handlePointerDown}
      onPointerMoveCapture={pan.handlePointerMove}
      onPointerUpCapture={pan.handlePointerUp}
      onLostPointerCapture={pan.handleLostPointerCapture}
      onPointerCancelCapture={pan.cancel}
      onContextMenuCapture={pan.handleContextMenu}
    >
      <div data-testid="station" onContextMenu={onContext} />
      <button onContextMenu={onContext}>Assign product</button>
    </div>
  )
}

function setup() {
  const onPan = vi.fn()
  const onContext = vi.fn()
  const view = render(<Canvas onPan={onPan} onContext={onContext} />)
  const canvas = screen.getByTestId('canvas')
  const station = screen.getByTestId('station')
  const setCapture = vi.fn()
  const releaseCapture = vi.fn()
  Object.defineProperties(canvas, {
    setPointerCapture: { value: setCapture },
    hasPointerCapture: { value: () => setCapture.mock.calls.length > releaseCapture.mock.calls.length },
    releasePointerCapture: { value: releaseCapture },
  })
  return { ...view, canvas, station, onPan, onContext, setCapture, releaseCapture }
}

function pointer(target: HTMLElement, type: string, { x = 10, y = 20, button = 2, id = 1 } = {}) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button })
  Object.defineProperties(event, { isPrimary: { value: true }, pointerId: { value: id } })
  fireEvent(target, event)
}

afterEach(cleanup)

describe('canvas gesture priorities', () => {
  it('pans over a station in screen pixels, preserving zoom and suppressing contextual actions', () => {
    const { station, canvas, onPan, onContext, setCapture, releaseCapture } = setup()
    pointer(station, 'pointerdown')
    expect(setCapture).not.toHaveBeenCalled()
    pointer(station, 'pointermove', { x: 70, y: 50 })
    expect(onPan).toHaveBeenLastCalledWith({ x: 180, y: 130, zoom: 0.5 })
    expect(setCapture).toHaveBeenCalledWith(1)
    pointer(canvas, 'pointerup', { x: 70, y: 50 })
    expect(releaseCapture).toHaveBeenCalledWith(1)
    fireEvent.contextMenu(station)
    expect(onContext).not.toHaveBeenCalled()
  })

  it('keeps a stationary right-click contextual, including small pointer jitter', () => {
    const { station, onPan, onContext, setCapture } = setup()
    pointer(station, 'pointerdown')
    pointer(station, 'pointermove', { x: 11, y: 21 })
    pointer(station, 'pointerup')
    fireEvent.contextMenu(station)
    expect(onPan).not.toHaveBeenCalled()
    expect(setCapture).not.toHaveBeenCalled()
    expect(onContext).toHaveBeenCalledOnce()
  })

  it('leaves left-button selection and element dragging to their owners', () => {
    const { station, onPan, setCapture } = setup()
    pointer(station, 'pointerdown', { button: 0 })
    pointer(station, 'pointermove', { button: 0, x: 80 })
    expect(onPan).not.toHaveBeenCalled()
    expect(setCapture).not.toHaveBeenCalled()
  })

  it('does not steal right-clicks or dragging from interactive controls', () => {
    const { onPan, onContext, setCapture } = setup()
    const button = screen.getByRole('button')
    pointer(button, 'pointerdown')
    pointer(button, 'pointermove', { x: 80 })
    fireEvent.contextMenu(button)
    expect(onPan).not.toHaveBeenCalled()
    expect(setCapture).not.toHaveBeenCalled()
    expect(onContext).toHaveBeenCalledOnce()
  })

  it('distinguishes a pan that returns to its origin from the next stationary click', () => {
    const { station, onContext } = setup()
    pointer(station, 'pointerdown')
    pointer(station, 'pointermove', { x: 80 })
    pointer(station, 'pointermove')
    pointer(station, 'pointerup')
    fireEvent.contextMenu(station)
    expect(onContext).not.toHaveBeenCalled()
    pointer(station, 'pointerdown')
    pointer(station, 'pointerup')
    fireEvent.contextMenu(station)
    expect(onContext).toHaveBeenCalledOnce()
  })

  it('ignores another pointer and releases a cancelled capture without a stale gesture', () => {
    const { canvas, station, onPan, releaseCapture, onContext } = setup()
    pointer(station, 'pointerdown')
    pointer(station, 'pointermove', { id: 2, x: 80 })
    expect(onPan).not.toHaveBeenCalled()
    pointer(station, 'pointermove', { x: 80 })
    fireEvent.pointerCancel(canvas)
    expect(releaseCapture).toHaveBeenCalledWith(1)
    onPan.mockClear()
    pointer(station, 'pointermove', { x: 90 })
    fireEvent.contextMenu(station)
    expect(onPan).not.toHaveBeenCalled()
    expect(onContext).toHaveBeenCalledOnce()
  })

  it('releases a capture on unmount', () => {
    const { station, unmount, releaseCapture } = setup()
    pointer(station, 'pointerdown')
    pointer(station, 'pointermove', { x: 80 })
    unmount()
    expect(releaseCapture).toHaveBeenCalledWith(1)
  })

  it('cancels on unexpected capture loss instead of keeping a stuck pan', () => {
    const { canvas, station, onPan, releaseCapture } = setup()
    pointer(station, 'pointerdown')
    pointer(station, 'pointermove', { x: 80 })
    pointer(canvas, 'lostpointercapture')
    onPan.mockClear()
    pointer(station, 'pointermove', { x: 90 })
    expect(onPan).not.toHaveBeenCalled()
    expect(releaseCapture).toHaveBeenCalledWith(1)
  })
})
