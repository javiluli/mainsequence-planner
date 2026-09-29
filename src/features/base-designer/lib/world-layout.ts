import { CELL_SIZE, PLACEABLES, STATION_TYPES } from '../model/catalog'
import { indexPlacements, type BasePlacement, type BaseStation } from './placement'
import {
  canCrossStationBoundary,
  connectedCorridors,
  connectedStationIds,
  isCorridorFloorCell,
  isStationFloorCell,
  stationsConnect,
  type StationCorridor,
} from './stations'
import type { RouteCell } from './route'
import { oppositeDirection } from './ports'

export interface WorldPlacement extends BasePlacement {
  stationId: string
}

/** Convert station-local cells to the shared flow grid for connections across doorways. */
export function worldPlacements(stations: readonly BaseStation[]): WorldPlacement[] {
  return stations.flatMap((station) => {
    const offsetX = station.position.x / CELL_SIZE
    const offsetY = station.position.y / CELL_SIZE
    return station.placements.map((piece) => ({ ...piece, stationId: station.id, x: piece.x + offsetX, y: piece.y + offsetY }))
  })
}

/** Include the one-cell halo around the station and its passages so belts can see the next cell across a doorway. */
export function neighboringPlacements(
  station: BaseStation,
  corridors: readonly StationCorridor[],
  pieces: readonly WorldPlacement[],
): WorldPlacement[] {
  const offsetX = station.position.x / CELL_SIZE
  const offsetY = station.position.y / CELL_SIZE
  const size = STATION_TYPES[station.type].footprintCells
  const visibleFloor = [
    { x: offsetX, y: offsetY, width: size, height: size },
    ...corridors.filter((corridor) => corridor.ownerId === station.id || corridor.otherId === station.id),
  ]
  return pieces
    .filter(
      (piece) =>
        piece.stationId !== station.id &&
        visibleFloor.some(
          (floor) =>
            piece.x + PLACEABLES[piece.type].width > floor.x - 1 &&
            piece.x < floor.x + floor.width + 1 &&
            piece.y + PLACEABLES[piece.type].height > floor.y - 1 &&
            piece.y < floor.y + floor.height + 1,
        ),
    )
    .map((piece) => ({ ...piece, x: piece.x - offsetX, y: piece.y - offsetY }))
}

function floorOwner(
  stations: readonly BaseStation[],
  corridors: readonly StationCorridor[],
  x: number,
  y: number,
): BaseStation | undefined {
  const station = stations.find((candidate) =>
    isStationFloorCell(candidate.type, x - candidate.position.x / CELL_SIZE, y - candidate.position.y / CELL_SIZE),
  )
  if (station) return station
  const corridor = corridors.find((candidate) => isCorridorFloorCell(candidate, x, y))
  return corridor && stations.find((candidate) => candidate.id === corridor.ownerId)
}

/** A part belongs to one station, but its footprint may cover station floor or the group's derived corridor. */
export function canPlaceInLayout(
  stations: readonly BaseStation[],
  ownerId: string,
  type: BasePlacement['type'],
  x: number,
  y: number,
  excludedIds: ReadonlySet<string> = new Set(),
): boolean {
  const owner = stations.find((station) => station.id === ownerId)
  if (!owner) return false
  const groupIds = connectedStationIds(stations, ownerId)
  const group = stations.filter((station) => groupIds.has(station.id))
  const corridors = connectedCorridors(group)
  const originX = owner.position.x / CELL_SIZE + x
  const originY = owner.position.y / CELL_SIZE + y
  const footprint = PLACEABLES[type]
  const occupied = indexPlacements(worldPlacements(group).filter((piece) => !excludedIds.has(piece.id)))
  for (let row = originY; row < originY + footprint.height; row++) {
    for (let column = originX; column < originX + footprint.width; column++) {
      if (occupied.has(`${column},${row}`)) return false
      if (!floorOwner(group, corridors, column, row)) return false
      // Every cell of a multi-cell machine must cross the wall through an opening.
      if (column > originX && !canCrossStationBoundary(group, { x: column - 1, y: row }, { x: column, y: row }, corridors)) return false
      if (row > originY && !canCrossStationBoundary(group, { x: column, y: row - 1 }, { x: column, y: row }, corridors)) return false
    }
  }
  return true
}

export function canMoveInLayout(stations: readonly BaseStation[], ownerId: string, pieceId: string, x: number, y: number): boolean {
  const piece = stations.find((station) => station.id === ownerId)?.placements.find((placement) => placement.id === pieceId)
  return Boolean(piece && !piece.routeId && canPlaceInLayout(stations, ownerId, piece.type, x, y, new Set([pieceId])))
}

/** A world cell has exactly one owning station because station footprints never overlap. */
export function routeCellOwner(stations: readonly BaseStation[], startId: string, x: number, y: number): BaseStation | undefined {
  const groupIds = connectedStationIds(stations, startId)
  const group = stations.filter((station) => groupIds.has(station.id))
  return floorOwner(group, connectedCorridors(group), x, y)
}

/** A complete route may cross aligned doorways, but never walls, gaps or occupied cells. */
export function canPlaceRouteInLayout(
  stations: readonly BaseStation[],
  startId: string,
  cells: readonly RouteCell[],
  excludedIds: ReadonlySet<string> = new Set(),
): boolean {
  if (cells.length === 0) return false
  const occupied = indexPlacements(worldPlacements(stations).filter((piece) => !excludedIds.has(piece.id)))
  const routeCellsByPosition = new Set(cells.map((cell) => `${cell.x},${cell.y}`))
  const groupIds = connectedStationIds(stations, startId)
  const group = stations.filter((station) => groupIds.has(station.id))
  const corridors = connectedCorridors(group)
  return cells.every((cell) => {
    if (cell.direction === cell.incoming || !floorOwner(group, corridors, cell.x, cell.y) || occupied.has(`${cell.x},${cell.y}`))
      return false
    for (const [dx, dy] of [
      [1, 0],
      [0, 1],
    ]) {
      if (
        routeCellsByPosition.has(`${cell.x + dx},${cell.y + dy}`) &&
        !canCrossStationBoundary(group, cell, { x: cell.x + dx, y: cell.y + dy }, corridors)
      )
        return false
    }
    return true
  })
}

export function canMoveRouteInLayout(stations: readonly BaseStation[], startId: string, routeId: string, dx: number, dy: number): boolean {
  const route = worldPlacements(stations).filter((piece) => piece.routeId === routeId)
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
    )
  )
}

/** A neighbor cannot be removed while a part from the connected group covers its floor. */
export function hasSpanningPlacement(stations: readonly BaseStation[], stationId: string): boolean {
  const target = stations.find((station) => station.id === stationId)
  if (!target) return false
  const targetX = target.position.x / CELL_SIZE
  const targetY = target.position.y / CELL_SIZE
  return worldPlacements(stations).some((piece) => {
    const footprint = PLACEABLES[piece.type]
    for (let y = piece.y; y < piece.y + footprint.height; y++) {
      for (let x = piece.x; x < piece.x + footprint.width; x++) {
        if (piece.stationId !== stationId && isStationFloorCell(target.type, x - targetX, y - targetY)) return true
        if (
          piece.stationId === stationId &&
          stations.some(
            (neighbor) =>
              neighbor.id !== stationId &&
              isStationFloorCell(neighbor.type, x - neighbor.position.x / CELL_SIZE, y - neighbor.position.y / CELL_SIZE),
          )
        )
          return true
      }
    }
    return false
  })
}

/** An occupied corridor locks both stations, whether the part is a belt or a spanning machine. */
export function hasLinkedNeighbor(stations: readonly BaseStation[], stationId: string): boolean {
  const corridors = connectedCorridors(stations).filter((corridor) => corridor.ownerId === stationId || corridor.otherId === stationId)
  if (corridors.length === 0) return false
  const pieces = worldPlacements(stations)
  return corridors.some((corridor) =>
    pieces.some((piece) => {
      const footprint = PLACEABLES[piece.type]
      return (
        piece.x < corridor.x + corridor.width &&
        piece.x + footprint.width > corridor.x &&
        piece.y < corridor.y + corridor.height &&
        piece.y + footprint.height > corridor.y
      )
    }),
  )
}

/** Touching stations stay independent until a part actually spans or crosses their shared doorway. */
export function linkedStationIds(stations: readonly BaseStation[], startId: string): Set<string> {
  const linked = new Set([startId])
  let changed = true
  while (changed) {
    changed = false
    for (const station of stations) {
      if (linked.has(station.id)) continue
      const attached = stations.some((other) => {
        if (!linked.has(other.id) || !stationsConnect(station, other)) return false
        const pair = [station, other]
        return (
          station.lockedTo.includes(other.id) ||
          other.lockedTo.includes(station.id) ||
          hasLinkedNeighbor(pair, station.id) ||
          hasLinkedNeighbor(pair, other.id) ||
          hasSpanningPlacement(pair, station.id)
        )
      })
      if (attached) {
        linked.add(station.id)
        changed = true
      }
    }
  }
  return linked
}
