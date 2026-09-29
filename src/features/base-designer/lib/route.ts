import { STATION_TYPES, type Direction, type RouteTool } from '../model/catalog'
import { placementAt, type BaseStation } from './placement'
import { oppositeDirection } from './ports'
import { isStationFloorCell } from './stations'

export interface GridPoint {
  x: number
  y: number
}

/** A port click anchors the belt in the free cell immediately outside that opening. */
export type RouteAnchor =
  (GridPoint & { kind: 'floor' }) | (GridPoint & { kind: 'port'; face: Direction; role?: 'input' | 'output'; routeId?: string })

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

/** A route is accepted as a whole. Touching an existing route is allowed; overwriting it is not. */
export function canPlaceRoute(
  station: BaseStation,
  _type: RouteTool,
  cells: readonly RouteCell[],
  occupied?: ReadonlyMap<string, BaseStation['placements'][number]>,
): boolean {
  const size = STATION_TYPES[station.type].footprintCells
  return (
    cells.length > 0 &&
    cells.every(({ x, y, direction, incoming }) => {
      if (direction === incoming) return false
      if (x < 0 || y < 0 || x >= size || y >= size || !isStationFloorCell(station.type, x, y)) return false
      const existing = occupied ? occupied.get(`${x},${y}`) : placementAt(station, x, y)
      return !existing
    })
  )
}
