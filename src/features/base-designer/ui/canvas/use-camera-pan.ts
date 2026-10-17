import type Konva from 'konva'
import { useLayoutEffect, useRef, type RefObject } from 'react'
import type { Point } from '../../model/scene'
import { cancelCanvasDrag } from './cancel-drag'

/**
 * Keep native pointer capture, but apply only the latest camera pose per frame.
 * Returning the drag's fixed origin prevents Konva from invalidating the complete
 * scene twice per input event through setAbsolutePosition. The existing Konva batch
 * applies the pose before painting, without another animation-frame queue. Only this Stage is affected.
 */
export function createCameraPan(stage: Konva.Stage) {
  let origin: Point | null = null,
    pending: Point | null = null,
    moved = false
  const previousBound = stage.dragBoundFunc(),
    floor = stage.getLayers()[0]
  /** Apply the latest pose before drawing or before a release needs accurate hit geometry. */
  const flush = () => {
    const point = pending
    pending = null
    if (point) stage.position(point)
    return point !== null
  }
  /** Context changes discard queued motion before native dragend can deliver it. */
  const cancel = () => {
    pending = origin = null
    moved = false
  }
  stage.dragBoundFunc((point) => {
    if (!origin) return point
    pending = point
    if (Math.hypot(point.x - origin.x, point.y - origin.y) >= 3) moved = true
    stage.batchDraw()
    return origin
  })
  stage.on('cancelCameraGesture.camera-pan', cancel)
  // The floor paints first: drain before viewport culling, then all queued layers share this pose.
  floor?.on('beforeDraw.camera-pan', flush)
  return {
    /** Start from the current Stage pose, discarding any pending position from an earlier gesture. */
    start() {
      cancel()
      origin = stage.position()
    },
    /** Null means canceled/no gesture; false means a right click, true means navigation. */
    finish(): boolean | null {
      if (!origin) return null
      const wasMoved = moved,
        changed = flush()
      origin = null
      moved = false
      if (changed) stage.draw()
      return wasMoved
    },
    /** Drop queued motion and restore the Stage's previous drag behavior without moving the scene. */
    dispose() {
      cancel()
      stage.off('.camera-pan')
      floor?.off('.camera-pan')
      stage.setAttr('dragBoundFunc', previousBound)
    },
  }
}

/** Own the pending camera pose across rerenders, cancellation, blur and teardown. */
export function useCameraPan(stageRef: RefObject<Konva.Stage | null>, ready: boolean) {
  const controller = useRef<ReturnType<typeof createCameraPan> | null>(null)
  useLayoutEffect(() => {
    const stage = stageRef.current
    if (!stage || !ready) return
    const pan = createCameraPan(stage),
      blur = () => cancelCanvasDrag(stage)
    controller.current = pan
    window.addEventListener('blur', blur)
    return () => {
      window.removeEventListener('blur', blur)
      pan.dispose()
      controller.current = null
    }
  }, [stageRef, ready])
  return {
    start: () => controller.current?.start(),
    finish: () => controller.current?.finish() ?? null,
  }
}
