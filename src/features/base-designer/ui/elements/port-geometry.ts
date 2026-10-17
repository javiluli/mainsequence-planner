import type Konva from 'konva'
import type { BuildingPort } from '../../model/buildings'
import { CELL_SIZE, type Point } from '../../model/scene'
import type { WorldBounds } from '../canvas/viewport'

/** Visual insertion only: the logical port remains at the hull boundary. */
export const PORT_INSERT = 2
export const PORT_INSET = 2.25
export const PORT_DEPTH = 4.5
export const PORT_SPAN = 17

// A half-depth seat preserves the visible back of the socket; the 15px aperture clears the complete 14px belt.
const openingBack = 0
const halfOpening = 7.5
const radius = 1.4
const openingAngle = Math.asin((radius - (PORT_SPAN / 2 - halfOpening)) / radius)

/** Trace the approved socket once for native paths, or directly for color-key hit painting. */
function traceSocketPath(context: Pick<CanvasPath, 'arc' | 'lineTo' | 'closePath'>, connected: boolean) {
  context.arc(PORT_DEPTH - radius, radius, radius, connected ? -openingAngle : 0, -Math.PI / 2, true)
  context.lineTo(radius, 0)
  context.arc(radius, radius, radius, -Math.PI / 2, -Math.PI, true)
  context.lineTo(0, PORT_SPAN - radius)
  context.arc(radius, PORT_SPAN - radius, radius, Math.PI, Math.PI / 2, true)
  context.lineTo(PORT_DEPTH - radius, PORT_SPAN)
  context.arc(PORT_DEPTH - radius, PORT_SPAN - radius, radius, Math.PI / 2, connected ? openingAngle : 0, true)
  if (connected) {
    context.lineTo(PORT_INSET + openingBack, PORT_SPAN / 2 + halfOpening)
    context.lineTo(PORT_INSET + openingBack, PORT_SPAN / 2 - halfOpening)
  }
  context.closePath()
}

const outlines = new Map<boolean, Path2D>()

/** Two shared vector outlines avoid replaying arcs for every visible I/O on every camera frame. */
export function socketOutline(connected: boolean): Path2D | undefined {
  if (typeof Path2D === 'undefined') return undefined
  let path = outlines.get(connected)
  if (!path) {
    path = new Path2D()
    traceSocketPath(path, connected)
    outlines.set(connected, path)
  }
  return path
}

/** Free and connected frames retain the same exterior; this also serves hit painting and Path2D fallback. */
export function socketPath(context: Konva.Context, connected: boolean) {
  context.beginPath()
  traceSocketPath(context, connected)
}

/** Cut actual apertures in the whole opaque hull, including its artwork and selection outline. No per-frame React state or extra layer. */
export function portBodyClip(bounds: WorldBounds, ports: readonly BuildingPort[], origin: Point) {
  if (!ports.length) return undefined
  return (context: Konva.Context): [CanvasFillRule] => {
    context.rect(bounds.x, bounds.y, bounds.width, bounds.height)
    for (const port of ports) {
      const x = (port.position.x - origin.x) * CELL_SIZE,
        y = (port.position.y - origin.y) * CELL_SIZE,
        n = port.normal
      context.save()
      context.translate(x, y)
      context.rotate(Math.atan2(n.y, n.x))
      context.rect(openingBack, -halfOpening, PORT_DEPTH - PORT_INSET - openingBack, halfOpening * 2)
      context.restore()
    }
    return ['evenodd']
  }
}

/** A physical bridge determines its outward normal from the adjacent floor cell, without modifying domain coordinates. */
export function insetPortPixel(cell: Point, position: Point): Point {
  return {
    x: position.x * CELL_SIZE - (cell.x + 0.5 - position.x) * 2 * PORT_INSERT,
    y: position.y * CELL_SIZE - (cell.y + 0.5 - position.y) * 2 * PORT_INSERT,
  }
}
