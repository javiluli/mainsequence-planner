import { CELL_SIZE, STATION_GATE_CELLS, STATION_TYPES, isRouteTool, isUndergroundType, type RouteTool } from '../../model/catalog'
import { indexPlacements, type BaseStation } from '../layout/placement'
import { canCrossStationBoundary, connectedCorridors, connectedStationIds, isStationFloorCell, stationOpenFaces } from '../layout/stations'
import type { RouteCell } from './route'
import { oppositeDirection } from '../connections/ports'
import { isUndergroundPath, maxBuriedCells } from './underground'
import { floorOwner, worldPlacements } from '../layout/world-layout'

/** A complete route may cross aligned doorways, but never walls, gaps or occupied cells. */
export type RoutePlacementIssue =
  'empty' | 'tunnel-too-short' | 'tunnel-too-long' | 'tunnel-direction' | 'direction' | 'outside-floor' | 'occupied' | 'belt-tier' | 'wall'

export type RoutePlacementCheck = { ok: true } | { ok: false; issue: RoutePlacementIssue }

function crossesClosedStationWall(stations: readonly BaseStation[], from: RouteCell | undefined, to: RouteCell): boolean {
  if (!from || Math.abs(from.x - to.x) + Math.abs(from.y - to.y) !== 1) return false
  const station = stations.find((candidate) =>
    isStationFloorCell(candidate.type, from.x - candidate.position.x / CELL_SIZE, from.y - candidate.position.y / CELL_SIZE),
  )
  if (!station) return false
  const localX = from.x - station.position.x / CELL_SIZE
  const localY = from.y - station.position.y / CELL_SIZE
  const face = to.x > from.x ? 'east' : to.x < from.x ? 'west' : to.y > from.y ? 'south' : 'north'
  const edgeIndex = face === 'east' || face === 'west' ? localY : localX
  const { gateStarts } = STATION_TYPES[station.type]
  return (
    !stationOpenFaces(station).includes(face) || !gateStarts.some((start) => edgeIndex >= start && edgeIndex < start + STATION_GATE_CELLS)
  )
}

/**
 * Check world-cell route geometry against current floor, doorways and surface occupancy.
 * complete distinguishes a live tunnel draft from a final path; buried cells need floor but leave the surface free.
 */
export function checkRouteInLayout(
  stations: readonly BaseStation[],
  startId: string,
  cells: readonly RouteCell[],
  excludedIds: ReadonlySet<string> = new Set(),
  type?: RouteTool,
  complete = false,
): RoutePlacementCheck {
  if (cells.length === 0) return { ok: false, issue: 'empty' }
  const underground = type ? isUndergroundType(type) : false
  if (underground && type) {
    const maxCells = maxBuriedCells(type)
    if (maxCells !== null && cells.length > maxCells + 2) return { ok: false, issue: 'tunnel-too-long' }
    if (complete && cells.length < 3) return { ok: false, issue: 'tunnel-too-short' }
    if (!isUndergroundPath(type, cells, complete)) return { ok: false, issue: 'tunnel-direction' }
  }
  const occupied = indexPlacements(worldPlacements(stations).filter((piece) => !excludedIds.has(piece.id)))
  const routeCellsByPosition = new Set(cells.map((cell) => `${cell.x},${cell.y}`))
  const groupIds = connectedStationIds(stations, startId)
  const group = stations.filter((station) => groupIds.has(station.id))
  const corridors = connectedCorridors(group)
  for (const [index, cell] of cells.entries()) {
    const buried = underground && index > 0 && index < cells.length - 1
    if (!floorOwner(group, corridors, cell.x, cell.y)) {
      return { ok: false, issue: crossesClosedStationWall(group, cells[index - 1], cell) ? 'wall' : 'outside-floor' }
    }
    const existing = occupied.get(`${cell.x},${cell.y}`)
    if (!buried && existing) {
      return { ok: false, issue: type && isRouteTool(existing.type) && existing.type !== type ? 'belt-tier' : 'occupied' }
    }
    if (cell.direction === cell.incoming) return { ok: false, issue: 'direction' }
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
    ]) {
      if (
        routeCellsByPosition.has(`${cell.x + dx},${cell.y + dy}`) &&
        !canCrossStationBoundary(group, cell, { x: cell.x + dx, y: cell.y + dy }, corridors)
      )
        return { ok: false, issue: 'wall' }
    }
  }
  return { ok: true }
}

/** Boolean draft check; final tunnel completeness remains an explicit decision of the caller. */
export function canPlaceRouteInLayout(
  stations: readonly BaseStation[],
  startId: string,
  cells: readonly RouteCell[],
  excludedIds: ReadonlySet<string> = new Set(),
  type?: RouteTool,
): boolean {
  return checkRouteInLayout(stations, startId, cells, excludedIds, type).ok
}

/** Validate the complete route identity translated by a world-cell delta, excluding only its original surface cells. */
export function canMoveRouteInLayout(stations: readonly BaseStation[], startId: string, routeId: string, dx: number, dy: number): boolean {
  const route = worldPlacements(stations)
    .filter((piece) => piece.routeId === routeId)
    .sort((first, second) => (first.routeIndex ?? 0) - (second.routeIndex ?? 0))
  return (
    route.length > 0 &&
    canPlaceRouteInLayout(
      stations,
      startId,
      route.map((piece) => ({
        x: piece.x + dx,
        y: piece.y + dy,
        direction: piece.direction,
        incoming: piece.incoming ?? oppositeDirection(piece.direction),
      })),
      new Set(route.map((piece) => piece.id)),
      route[0].type === 'underground' || route[0].type === 'underground_mk2' ? route[0].type : undefined,
    )
  )
}
