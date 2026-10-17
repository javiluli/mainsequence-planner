import { CELL_SIZE, type Point } from '../../model/scene'
import type { BeltPortBridge } from '../../lib/belt-network'
import { insetPortPixel, PORT_INSERT } from './port-geometry'
import type Konva from 'konva'
import type { BeltRun } from '../../lib/belt-network'

/** Keep contextual tier text beside the first rail and outside its supplying machine, including lateral starts. */
export function beltLevelPosition(points: readonly Point[], normal?: Point): Point {
  const first = points[0] ?? { x: 0, y: 0 },
    vertical = points.length > 1 ? points[1].x === first.x : !!normal?.y
  return vertical
    ? { x: first.x * CELL_SIZE + (normal?.x === -1 ? -34 : CELL_SIZE + 2), y: first.y * CELL_SIZE + 6 }
    : { x: first.x * CELL_SIZE - 6, y: first.y * CELL_SIZE + (normal?.y === 1 ? CELL_SIZE + 1 : -9) }
}

/** Bridge direction follows item flow, so the shared slat clock also covers machine entry and exit. */
export function beltBridgePixels({ cell, position, role }: BeltPortBridge): number[] {
  const center = [(cell.x + 0.5) * CELL_SIZE, (cell.y + 0.5) * CELL_SIZE]
  const port = insetPortPixel(cell, position)
  return role === 'output' ? [port.x, port.y, ...center] : [...center, port.x, port.y]
}

/** Free ends cover their complete cell; sockets and shared junctions keep their exact handover point. */
export function beltPixels(
  points: readonly Point[],
  heading?: Point,
  inputPosition?: Point,
  outputPosition?: Point,
  junctions: readonly Point[] = [],
): number[] {
  if (points.length === 1 && heading) {
    const p = points[0],
      x = (p.x + 0.5) * CELL_SIZE,
      y = (p.y + 0.5) * CELL_SIZE,
      input = inputPosition ? insetPortPixel(p, inputPosition) : undefined,
      output = outputPosition ? insetPortPixel(p, outputPosition) : undefined
    return [
      output?.x ?? x - (heading.x * CELL_SIZE) / 2,
      output?.y ?? y - (heading.y * CELL_SIZE) / 2,
      x,
      y,
      input?.x ?? x + (heading.x * CELL_SIZE) / 2,
      input?.y ?? y + (heading.y * CELL_SIZE) / 2,
    ]
  }
  const pixels = points.flatMap((p) => [(p.x + 0.5) * CELL_SIZE, (p.y + 0.5) * CELL_SIZE])
  if (points.length > 1) {
    const first = points[0],
      second = points[1],
      last = points.at(-1)!,
      previous = points.at(-2)!
    if (outputPosition || !junctions.some((p) => p.x === first.x && p.y === first.y)) {
      const start = outputPosition
        ? insetPortPixel(first, outputPosition)
        : {
            x: (first.x + 0.5 + Math.sign(first.x - second.x) / 2) * CELL_SIZE,
            y: (first.y + 0.5 + Math.sign(first.y - second.y) / 2) * CELL_SIZE,
          }
      pixels.unshift(start.x, start.y)
    }
    if (inputPosition || !junctions.some((p) => p.x === last.x && p.y === last.y)) {
      const end = inputPosition
        ? insetPortPixel(last, inputPosition)
        : {
            x: (last.x + 0.5 + Math.sign(last.x - previous.x) / 2) * CELL_SIZE,
            y: (last.y + 0.5 + Math.sign(last.y - previous.y) / 2) * CELL_SIZE,
          }
      pixels.push(end.x, end.y)
    }
  }
  return pixels
}

/** Only an inline source belongs in a one-cell path; lateral sources keep their own bridge. */
export function inlineOutputPosition(heading?: Point, bridges?: readonly BeltPortBridge[]): Point | undefined {
  return heading
    ? bridges?.find(
        (bridge) =>
          bridge.role === 'output' && (heading.x ? bridge.position.y === bridge.cell.y + 0.5 : bridge.position.x === bridge.cell.x + 0.5),
      )?.position
    : undefined
}

/** Precomputed visual spans. Curve spacing uses logical cell distance, so every junction shares the same clock. */
export interface BeltSection {
  from: Point
  to: Point
  control?: Point
  /** Signed distance in world pixels from the route's first cell center; source insertion starts before zero. */
  offset: number
  /** Logical distance in world pixels, retaining both straight legs of a rounded corner. */
  length: number
  /** Physical curve length / logical distance, also applied to its dash and phase. */
  scale: number
  active: boolean
}

/** Ordinary turns round smoothly; directed junctions pass through their exact cell center with straight arms. */
export function roundedBeltPath(pixels: readonly number[], offset = 0, junctions: readonly Point[] = []): BeltSection[] {
  const sections: BeltSection[] = []
  if (pixels.length < 4) return sections
  let from = { x: pixels[0], y: pixels[1] }
  const line = (to: Point) => {
    const length = Math.abs(to.x - from.x) + Math.abs(to.y - from.y)
    if (length) sections.push({ from, to, offset, length, scale: 1, active: false })
    offset += length
    from = to
  }
  for (let i = 2; i < pixels.length - 2; i += 2) {
    const corner = { x: pixels[i], y: pixels[i + 1] },
      next = { x: pixels[i + 2], y: pixels[i + 3] },
      incoming = { x: Math.sign(corner.x - from.x), y: Math.sign(corner.y - from.y) },
      outgoing = { x: Math.sign(next.x - corner.x), y: Math.sign(next.y - corner.y) }
    if (incoming.x === outgoing.x && incoming.y === outgoing.y) continue
    if (junctions.some((cell) => (cell.x + 0.5) * CELL_SIZE === corner.x && (cell.y + 0.5) * CELL_SIZE === corner.y)) {
      line(corner)
      continue
    }
    if (incoming.x === -outgoing.x && incoming.y === -outgoing.y) {
      line(corner)
      continue
    }
    // Neighboring corners share a cell edge; a terminal bridge can use its full remaining length.
    const radius = Math.min(
      CELL_SIZE / 2,
      Math.abs(corner.x - from.x) + Math.abs(corner.y - from.y),
      (Math.abs(next.x - corner.x) + Math.abs(next.y - corner.y)) / (i < pixels.length - 4 ? 2 : 1),
    )
    if (!radius) {
      line(corner)
      continue
    }
    line({ x: corner.x - incoming.x * radius, y: corner.y - incoming.y * radius })
    const to = { x: corner.x + outgoing.x * radius, y: corner.y + outgoing.y * radius }
    // Exact length of this symmetric quadratic divided by its two straight half-cell legs.
    sections.push({ from, to, control: corner, offset, length: radius * 2, scale: (1 + Math.asinh(1) / Math.SQRT2) / 2, active: false })
    offset += radius * 2
    from = to
  }
  line({ x: pixels.at(-2)!, y: pixels.at(-1)! })
  return sections
}

/** One contour serves track, items and hit painting, including the final lateral bend into a socket. */
export function traceBeltSection(context: Konva.Context, section: BeltSection) {
  if (section.control) context.quadraticCurveTo(section.control.x, section.control.y, section.to.x, section.to.y)
  else context.lineTo(section.to.x, section.to.y)
}

/** Compile complete routes before splitting their activity; a state boundary in a bend keeps both halves of the same curve. */
export function beltRenderGeometry(
  points: readonly Point[],
  heading?: Point,
  bridges: readonly BeltPortBridge[] = [],
  runs: readonly BeltRun[] = [],
  junctions: readonly Point[] = [],
): BeltSection[][] {
  const source = bridges.find((b) => b.role === 'output' && b.cell.x === points[0]?.x && b.cell.y === points[0]?.y),
    target = bridges.find((b) => b.role === 'input'),
    inlineSource = inlineOutputPosition(heading, bridges)
  const pixels = beltPixels(points, heading, target?.position, heading ? inlineSource : source?.position, junctions)
  // Keep phase zero at the first cell center even when its cap or socket starts before it.
  const offset = points.length
    ? -Math.abs(pixels[0] - (points[0].x + 0.5) * CELL_SIZE) - Math.abs(pixels[1] - (points[0].y + 0.5) * CELL_SIZE)
    : 0
  const spans: { from: number; to: number; active: boolean }[] = []
  let distance = 0
  for (const run of runs) {
    const length =
      run.points.slice(1).reduce((sum, p, i) => sum + Math.abs(p.x - run.points[i].x) + Math.abs(p.y - run.points[i].y), 0) * CELL_SIZE
    spans.push({ from: distance, to: distance + length, active: run.active })
    distance += length
  }
  const logicalState = (at: number) =>
    (at < 0
      ? (source?.active ?? spans[0]?.active)
      : at > distance
        ? (target?.active ?? spans.at(-1)?.active)
        : spans.find((span) => at >= span.from && at <= span.to)?.active) ?? false
  const branches = bridges.filter((b) => b !== target && !(b === source && (!heading || inlineSource)))
  // A side supply adds another arm, including two facing machine outputs sharing a single belt cell.
  const complete = roundedBeltPath(pixels, offset, [...junctions, ...branches.map((bridge) => bridge.cell)])
  const transitions = [...new Set([0, ...spans.map((s) => s.to)])]
    .filter((at) => logicalState(at - 0.01) !== logicalState(at + 0.01))
    .map((at) => ({ at, active: !!logicalState(at + 0.01) }))
    .sort((a, b) => a.at - b.at)
  const boundaries = transitions.map((t) => t.at),
    state = (at: number) => transitions.reduce((active, t) => (t.at <= at ? t.active : active), !!logicalState(-Infinity))
  const main = complete.flatMap((section) => {
    const cuts = [
      section.offset,
      ...boundaries.filter((at) => at > section.offset && at < section.offset + section.length),
      section.offset + section.length,
    ]
    return cuts.slice(1).map((end, i) => {
      const start = cuts[i],
        a = (start - section.offset) / section.length,
        b = (end - section.offset) / section.length
      /** Evaluate the original curve so activity cuts retain its shape and spatial clock. */
      const at = (t: number): Point =>
        section.control
          ? {
              x: (1 - t) ** 2 * section.from.x + 2 * (1 - t) * t * section.control.x + t ** 2 * section.to.x,
              y: (1 - t) ** 2 * section.from.y + 2 * (1 - t) * t * section.control.y + t ** 2 * section.to.y,
            }
          : { x: section.from.x + (section.to.x - section.from.x) * t, y: section.from.y + (section.to.y - section.from.y) * t }
      const from = at(a),
        to = at(b)
      // The subcurve's control follows the original derivative; a new rounded corner would create a visible seam.
      const control = section.control
        ? {
            x: from.x + (b - a) * ((1 - a) * (section.control.x - section.from.x) + a * (section.to.x - section.control.x)),
            y: from.y + (b - a) * ((1 - a) * (section.control.y - section.from.y) + a * (section.to.y - section.control.y)),
          }
        : undefined
      return { from, to, control, offset: start, length: end - start, scale: section.scale, active: !!state((start + end) / 2) }
    })
  })
  return [
    main,
    ...branches.map((bridge) => {
      const pixels = beltBridgePixels(bridge),
        offset = bridge.role === 'output' ? -(CELL_SIZE / 2 + PORT_INSERT) : 0
      return roundedBeltPath(pixels, offset).map((s) => ({
        ...s,
        active: bridge.active,
      }))
    }),
  ]
}
