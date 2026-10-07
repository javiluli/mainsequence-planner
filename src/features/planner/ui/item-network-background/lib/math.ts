import {
  CENTER_LINK_ALPHA,
  MIN_HORIZONTAL_OVERSCAN,
  MIN_VERTICAL_OVERSCAN,
  HORIZONTAL_OVERSCAN_RATIO,
  VERTICAL_OVERSCAN_RATIO,
  CENTER_RADIUS_X_MAX,
  CENTER_RADIUS_X_MIN,
  CENTER_RADIUS_X_RATIO,
  CENTER_RADIUS_Y_MAX,
  CENTER_RADIUS_Y_MIN,
  CENTER_RADIUS_Y_RATIO,
  MAX_POINTER_RADIUS,
  MIN_POINTER_RADIUS,
} from '../network.config'
import type { NetworkNode, Point } from '../network.types'

export const clamp = (value: number, minimum: number, maximum: number) => Math.min(maximum, Math.max(minimum, value))
export const lerp = (start: number, end: number, amount: number) => start + (end - start) * amount
export const randomBetween = (minimum: number, maximum: number) => lerp(minimum, maximum, Math.random())

export const smoothstep = (value: number) => {
  const t = clamp(value, 0, 1)
  return t * t * (3 - 2 * t)
}

export const smootherstep = (value: number) => {
  const t = clamp(value, 0, 1)
  // Rounding near 1 can overshoot: fractional-power decays need nonnegative remaining energy.
  return clamp(t * t * t * (t * (t * 6 - 15) + 10), 0, 1)
}

export const distanceSquared = (first: Point, second: Point) => (second.x - first.x) ** 2 + (second.y - first.y) ** 2

export const getCenterZone = (width: number, height: number) => ({
  radiusX: clamp(width * CENTER_RADIUS_X_RATIO, CENTER_RADIUS_X_MIN, CENTER_RADIUS_X_MAX),
  radiusY: clamp(height * CENTER_RADIUS_Y_RATIO, CENTER_RADIUS_Y_MIN, CENTER_RADIUS_Y_MAX),
})

export const getDistanceToSegment = (px: number, py: number, ax: number, ay: number, bx: number, by: number) => {
  const dx = bx - ax
  const dy = by - ay
  const lengthSquared = dx * dx + dy * dy
  const projection = lengthSquared === 0 ? 0 : clamp(((px - ax) * dx + (py - ay) * dy) / lengthSquared, 0, 1)
  return Math.hypot(px - ax - dx * projection, py - ay - dy * projection)
}

export const getCenterLinkVisibility = (start: Point, end: Point, width: number, height: number) => {
  const { radiusX, radiusY } = getCenterZone(width, height)
  const scale = radiusX / radiusY
  const distance = getDistanceToSegment(width / 2, (height / 2) * scale, start.x, start.y * scale, end.x, end.y * scale)
  return lerp(CENTER_LINK_ALPHA, 1, smoothstep(distance / radiusX))
}

export const getPointerRadius = (width: number, height: number) =>
  clamp(Math.min(width, height) * 0.27, MIN_POINTER_RADIUS, MAX_POINTER_RADIUS)

export const getPointInfluence = (point: Point, pointer: Point | null, radius: number) =>
  pointer ? smoothstep(1 - Math.sqrt(distanceSquared(point, pointer)) / radius) : 0

export const getSegmentInfluence = (start: Point, end: Point, pointer: Point | null, radius: number) =>
  pointer ? smoothstep(1 - getDistanceToSegment(pointer.x, pointer.y, start.x, start.y, end.x, end.y) / radius) : 0

/** One visual radius for bodies, signal endpoints and impact contact points; pointer feedback never enters physics. */
export const getVisualNodeRadius = (node: NetworkNode, radius: number, influence: number, highlighted: boolean) =>
  radius * node.sizeScale * (1 + influence * 0.022 + (highlighted ? 0.05 : 0))

export const isNodeVisible = (node: NetworkNode, width: number, height: number, margin: number) =>
  node.alpha >= 0.01 && node.x >= -margin && node.x <= width + margin && node.y >= -margin && node.y <= height + margin

export const getHorizontalOverscan = (width: number) => Math.max(MIN_HORIZONTAL_OVERSCAN, width * HORIZONTAL_OVERSCAN_RATIO)
export const getVerticalOverscan = (height: number) => Math.max(MIN_VERTICAL_OVERSCAN, height * VERTICAL_OVERSCAN_RATIO)
