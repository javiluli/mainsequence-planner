import { type Direction, type RouteTool } from '../model/catalog'
import { oppositeDirection } from './ports'

export interface GridPoint {
  x: number
  y: number
}

/** A port click anchors the belt in the free cell immediately outside that opening. */
export type RouteAnchor =
  | (GridPoint & { kind: 'floor' })
  | (GridPoint & { kind: 'port'; face: Direction; role?: 'input' | 'output'; routeId?: string; mergeTargetId?: string })

export interface BeltJunction {
  targetId: string
  face: Direction
}

export interface RouteDraft {
  stationId: string
  type: RouteTool
  anchors: RouteAnchor[]
  hover: RouteAnchor | null
}

export interface RouteCell extends GridPoint {
  direction: Direction
  incoming: Direction
}

/** A lateral target is joined separately; including it here would look like a loop from that route. */
export function routeMergeIds(start: RouteAnchor, end: RouteAnchor): string[] {
  return [start, end].flatMap((anchor) => (anchor.kind === 'port' && anchor.routeId && !anchor.mergeTargetId ? [anchor.routeId] : []))
}

/** Hover identity includes routing intent, not just the highlighted cell/face. */
export function sameRouteAnchor(first: RouteAnchor | null, second: RouteAnchor | null): boolean {
  if (first === second) return true
  if (!first || !second || first.kind !== second.kind || first.x !== second.x || first.y !== second.y) return false
  return (
    first.kind === 'floor' ||
    (second.kind === 'port' &&
      first.face === second.face &&
      first.role === second.role &&
      first.routeId === second.routeId &&
      first.mergeTargetId === second.mergeTargetId)
  )
}

/** The cursor preview and the confirmed route use the same anchor projection. */
export function draftRouteCells(draft: RouteDraft): RouteCell[] {
  const last = draft.anchors.at(-1)
  const hover = draft.hover
  return routeCells(hover && last && (last.x !== hover.x || last.y !== hover.y) ? [...draft.anchors, hover] : draft.anchors)
}

/** Each pair of anchors forms a horizontal-first orthogonal segment. Anchors remain editable until the route is confirmed. */
export function routeCells(anchors: readonly RouteAnchor[]): RouteCell[] {
  if (anchors.length === 0) return []
  const path: GridPoint[] = [{ ...anchors[0] }]
  for (let index = 1; index < anchors.length; index++) {
    const end = anchors[index]
    let { x, y } = path[path.length - 1]
    while (x !== end.x) {
      x += Math.sign(end.x - x)
      path.push({ x, y })
    }
    while (y !== end.y) {
      y += Math.sign(end.y - y)
      path.push({ x, y })
    }
  }

  const cells = new Map<string, RouteCell>()
  const start = anchors[0]
  const end = anchors[anchors.length - 1]
  path.forEach((point, index) => {
    const next = path[index + 1]
    const previous = path[index - 1]
    const deltaX = next ? next.x - point.x : previous ? point.x - previous.x : 1
    const deltaY = next ? next.y - point.y : previous ? point.y - previous.y : 0
    const inferredDirection: Direction = deltaX > 0 ? 'east' : deltaX < 0 ? 'west' : deltaY > 0 ? 'south' : 'north'
    let direction = inferredDirection
    if (!next && end.kind === 'port' && anchors.length > 1) direction = oppositeDirection(end.face)
    else if (!next && start.kind === 'port' && anchors.length === 1) direction = start.face
    const inferredIncoming: Direction = previous
      ? previous.x < point.x
        ? 'west'
        : previous.x > point.x
          ? 'east'
          : previous.y < point.y
            ? 'north'
            : 'south'
      : oppositeDirection(direction)
    const incoming = !previous && start.kind === 'port' ? oppositeDirection(start.face) : inferredIncoming
    cells.set(`${point.x},${point.y}`, { ...point, direction, incoming })
  })
  return [...cells.values()]
}
