import type Konva from 'konva'
import { CELL_SIZE } from '../../model/scene'

/** Pixel rectangle; viewport consumers require world coordinates, while artwork helpers may use local coordinates.
 * Visual bounds, including contextual labels, never redefine the scene's grid-cell footprints.
 */
export interface WorldBounds {
  x: number
  y: number
  width: number
  height: number
}

/** Expand camera bounds by one cell to retain decorative edges without enlarging footprints. */
function viewportBounds(stage: Konva.Stage) {
  const zoom = stage.scaleX(),
    margin = CELL_SIZE
  const left = -stage.x() / zoom - margin,
    top = -stage.y() / zoom - margin
  const right = left + stage.width() / zoom + margin * 2,
    bottom = top + stage.height() / zoom + margin * 2
  return { left, top, right, bottom }
}

/** Drag-hidden originals stay hidden even if dragging; other actors keep their visibility while dragging. */
function visibleInViewport(element: Konva.Node, bounds: WorldBounds, viewport: ReturnType<typeof viewportBounds>) {
  return (
    !element.getAttr('dragHidden') &&
    (element.isDragging() ||
      (bounds.x <= viewport.right &&
        bounds.y <= viewport.bottom &&
        bounds.x + bounds.width >= viewport.left &&
        bounds.y + bounds.height >= viewport.top))
  )
}

/** Restore explicit drag sources against the current camera without retaining an index.
 * Every supplied node must carry worldBounds in world pixels, as required for viewport membership.
 */
export function updateViewport(stage: Konva.Stage, elements: readonly Konva.Node[]) {
  const viewport = viewportBounds(stage)
  for (const element of elements) element.visible(visibleInViewport(element, element.getAttr('worldBounds'), viewport))
}

/**
 * Index worldBounds in world pixels once, then change only visibility transitions during navigation.
 * Every supplied node must carry those bounds. Rebuild after geometry/contextual nodes change. Other owners hide origins through
 * dragHidden and restore them with updateViewport, keeping this index's ownership explicit.
 */
export function createViewportUpdater(stage: Konva.Stage, elements: readonly Konva.Node[]) {
  const entries = elements.map((element) => ({
    element,
    bounds: element.getAttr('worldBounds') as WorldBounds,
    visible: element.visible(),
  }))
  return () => {
    const viewport = viewportBounds(stage)
    for (const entry of entries) {
      const next = visibleInViewport(entry.element, entry.bounds, viewport)
      if (next === entry.visible) continue
      entry.element.visible(next)
      entry.visible = next
    }
  }
}
