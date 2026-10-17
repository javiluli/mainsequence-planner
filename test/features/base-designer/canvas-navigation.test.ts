import Konva from 'konva'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MAX_ZOOM, MIN_ZOOM, zoomAt } from '@/features/base-designer/lib/camera'
import { createCameraPan } from '@/features/base-designer/ui/canvas/use-camera-pan'
import { createViewportUpdater, updateViewport } from '@/features/base-designer/ui/canvas/viewport'

afterEach(() => vi.restoreAllMocks())

/** Native Node APIs with an explicit first-layer draw event, without allocating a DOM renderer. */
function camera() {
  const stage = new Konva.Group({ x: 10, y: 20, width: 100, height: 100 }) as unknown as Konva.Stage
  const floor = new Konva.Group() as unknown as Konva.Layer
  stage.getLayers = () => [floor]
  stage.batchDraw = vi.fn(() => stage)
  vi.spyOn(stage, 'draw').mockImplementation(() => stage)
  return { stage, floor }
}

describe('Camera zoom', () => {
  it.each([0.01, 0.5, 2, 100])('keeps the cursor world anchor stationary, including zoom limits (factor %s)', (factor) => {
    const camera = { x: -230, y: 110, zoom: 0.75 }
    const anchor = { x: 421, y: 307 }
    const world = { x: (anchor.x - camera.x) / camera.zoom, y: (anchor.y - camera.y) / camera.zoom }
    const next = zoomAt(camera, anchor, factor)
    expect(next.x + world.x * next.zoom).toBeCloseTo(anchor.x)
    expect(next.y + world.y * next.zoom).toBeCloseTo(anchor.y)
    expect(next.zoom).toBeGreaterThanOrEqual(MIN_ZOOM)
    expect(next.zoom).toBeLessThanOrEqual(MAX_ZOOM)
    expect(camera).toEqual({ x: -230, y: 110, zoom: 0.75 })
  })
})

describe('Frame-coalesced camera navigation', () => {
  it('uses the latest pointer before painting and flushes a fast release', () => {
    const { stage, floor } = camera(),
      pan = createCameraPan(stage)
    pan.start()
    for (let x = 30; x <= 50; x++) stage.dragBoundFunc().call(stage, { x, y: 80 }, new Event('mousemove'))
    expect(stage.position()).toEqual({ x: 10, y: 20 })
    floor.fire('beforeDraw')
    expect(stage.position()).toEqual({ x: 50, y: 80 })
    stage.dragBoundFunc().call(stage, { x: 70, y: 90 }, new Event('mousemove'))
    expect(pan.finish()).toBe(true)
    expect(stage.position()).toEqual({ x: 70, y: 90 })
    floor.fire('beforeDraw')
    expect(stage.position()).toEqual({ x: 70, y: 90 })
    pan.dispose()
    stage.destroy()
    floor.destroy()
  })

  it('discards queued motion on cancellation/teardown and preserves right clicks', () => {
    const { stage, floor } = camera(),
      original = () => ({ x: 0, y: 0 })
    stage.dragBoundFunc(original)
    const pan = createCameraPan(stage)
    pan.start()
    stage.dragBoundFunc().call(stage, { x: 70, y: 90 }, new Event('mousemove'))
    stage.fire('cancelCameraGesture')
    floor.fire('beforeDraw')
    expect(pan.finish()).toBeNull()
    expect(stage.position()).toEqual({ x: 10, y: 20 })
    pan.start()
    expect(pan.finish()).toBe(false)
    pan.start()
    stage.dragBoundFunc().call(stage, { x: 70, y: 90 }, new Event('mousemove'))
    pan.dispose()
    floor.fire('beforeDraw')
    expect(stage.position()).toEqual({ x: 10, y: 20 })
    expect(stage.dragBoundFunc()).toBe(original)
    stage.destroy()
    floor.destroy()
  })
})

describe('Indexed viewport visibility', () => {
  it('culls/reveals actors while preserving hidden drag origins and their recovery', () => {
    const { stage, floor } = camera(),
      actor = new Konva.Rect({ worldBounds: { x: 0, y: 0, width: 20, height: 20 } })
    const update = createViewportUpdater(stage, [actor])
    update()
    expect(actor.visible()).toBe(true)
    stage.x(-200)
    update()
    expect(actor.visible()).toBe(false)
    stage.x(0)
    update()
    actor.setAttrs({ dragHidden: true, visible: false })
    update()
    expect(actor.visible()).toBe(false)
    actor.setAttr('dragHidden', false)
    updateViewport(stage, [actor])
    update()
    expect(actor.visible()).toBe(true)
    actor.setAttr('worldBounds', { x: 300, y: 0, width: 20, height: 20 })
    createViewportUpdater(stage, [actor])()
    expect(actor.visible()).toBe(false)
    actor.destroy()
    stage.destroy()
    floor.destroy()
  })
})
