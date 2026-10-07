import { CELL_SIZE, PLACEABLES, isRouteTool, isUndergroundType } from '../../model/catalog'
import { beltConnection } from '../connections/connections'
import { indexPlacements, type BasePlacement, type BaseStation } from './placement'
import { canCrossStationBoundary, connectedCorridors, connectedStationIds } from './stations'
import { oppositeDirection } from '../connections/ports'
import { isUndergroundPath } from '../routes/underground'
import { floorOwner, routeCellOwner, worldPlacements } from './world-layout'
import { canPlaceRouteInLayout } from '../routes/route-validation'

/**
 * Validate a footprint expressed in its owner's local cells, including floors and passages in the connected group.
 * excludedIds removes only the proposal's original identities from surface occupancy.
 */
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

/** Validate a world-cell translation as one proposal; selected routes must be complete and cross-station footprints stay intact. */
export function canMovePlacementsInLayout(stations: readonly BaseStation[], ids: readonly string[], dx: number, dy: number): boolean {
  if (dx === 0 && dy === 0) return false
  const selectedIds = new Set(ids)
  const all = worldPlacements(stations)
  const selected = all.filter((piece) => selectedIds.has(piece.id))
  if (!selected.length) return false
  const routeIds = new Set(selected.flatMap((piece) => (piece.routeId ? [piece.routeId] : [])))
  if (all.some((piece) => piece.routeId && routeIds.has(piece.routeId) && !selectedIds.has(piece.id))) return false
  const stationById = new Map(stations.map((station) => [station.id, station]))
  if (
    selected.some((piece) => {
      if (piece.routeId) return false
      const owner = stationById.get(piece.stationId)
      return (
        !owner ||
        !canPlaceInLayout(
          stations,
          owner.id,
          piece.type,
          piece.x - owner.position.x / CELL_SIZE + dx,
          piece.y - owner.position.y / CELL_SIZE + dy,
          selectedIds,
        )
      )
    })
  )
    return false
  if (
    [...routeIds].some((routeId) => {
      const route = selected.filter((piece) => piece.routeId === routeId).sort((a, b) => (a.routeIndex ?? 0) - (b.routeIndex ?? 0))
      const first = route[0]
      return (
        !first ||
        !canPlaceRouteInLayout(
          stations,
          first.stationId,
          route.map((piece) => ({
            x: piece.x + dx,
            y: piece.y + dy,
            direction: piece.direction,
            incoming: piece.incoming ?? oppositeDirection(piece.direction),
          })),
          selectedIds,
          isUndergroundType(first.type) ? first.type : undefined,
        )
      )
    })
  )
    return false
  return selected.every((piece) => routeCellOwner(stations, piece.stationId, piece.x + dx, piece.y + dy))
}

/** A copied conveyor may branch, but every cell must still connect head-to-tail within its route. */
function isConnectedConveyor(route: readonly BasePlacement[]): boolean {
  const occupied = indexPlacements(route)
  const visited = new Set<string>()
  const pending = [route[0]]
  while (pending.length) {
    const piece = pending.pop()
    if (!piece || visited.has(piece.id)) continue
    visited.add(piece.id)
    for (const face of ['north', 'east', 'south', 'west'] as const) {
      const neighbor = beltConnection(occupied, piece, face)
      if (neighbor && !visited.has(neighbor.id)) pending.push(neighbor)
    }
  }
  return visited.size === route.length
}

/**
 * Validate a complete world-cell paste without mutation; return owners in the input piece order.
 * A missing owner, overlapping footprint or incomplete route rejects the whole proposal before IDs/history change.
 */
export function pastePlacementOwners(
  stations: readonly BaseStation[],
  startId: string,
  pieces: readonly BasePlacement[],
): BaseStation[] | null {
  if (!pieces.length || !stations.some((station) => station.id === startId)) return null
  const groupIds = connectedStationIds(stations, startId)
  const group = stations.filter((station) => groupIds.has(station.id))
  const corridors = connectedCorridors(group)
  const owners: BaseStation[] = []
  const occupied = new Set<string>()
  const routes = new Map<string, BasePlacement[]>()
  const sourceIds = new Set<string>()

  for (const piece of pieces) {
    if (sourceIds.has(piece.id) || !Number.isInteger(piece.x) || !Number.isInteger(piece.y)) return null
    sourceIds.add(piece.id)
    const owner = floorOwner(group, corridors, piece.x, piece.y)
    if (!owner) return null
    owners.push(owner)

    if (piece.routeId) {
      if (!isRouteTool(piece.type)) return null
      const route = routes.get(piece.routeId) ?? []
      route.push(piece)
      routes.set(piece.routeId, route)
    } else if (
      isRouteTool(piece.type) ||
      piece.buried ||
      !canPlaceInLayout(stations, owner.id, piece.type, piece.x - owner.position.x / CELL_SIZE, piece.y - owner.position.y / CELL_SIZE)
    ) {
      return null
    }

    // Buried cells still need an owner and valid route, but never reserve surface cells inside the proposal.
    if (piece.buried) continue
    const footprint = PLACEABLES[piece.type]
    for (let y = piece.y; y < piece.y + footprint.height; y++) {
      for (let x = piece.x; x < piece.x + footprint.width; x++) {
        const key = `${x},${y}`
        if (occupied.has(key)) return null
        occupied.add(key)
      }
    }
  }

  for (const route of routes.values()) {
    const first = route[0]
    if (!isRouteTool(first.type) || route.some((piece) => piece.type !== first.type)) return null
    const underground = isUndergroundType(first.type)
    const ordered = underground ? [...route].sort((a, b) => (a.routeIndex ?? -1) - (b.routeIndex ?? -1)) : route
    if (underground) {
      if (
        ordered.some((piece, index) => piece.routeIndex !== index || Boolean(piece.buried) !== (index > 0 && index < ordered.length - 1)) ||
        !isUndergroundPath(
          first.type,
          ordered.map((piece) => ({
            x: piece.x,
            y: piece.y,
            direction: piece.direction,
            incoming: piece.incoming ?? oppositeDirection(piece.direction),
          })),
          true,
        )
      )
        return null
    } else if (route.some((piece) => piece.buried) || !isConnectedConveyor(route)) {
      return null
    }
    if (
      !canPlaceRouteInLayout(
        stations,
        startId,
        ordered.map((piece) => ({
          x: piece.x,
          y: piece.y,
          direction: piece.direction,
          incoming: piece.incoming ?? oppositeDirection(piece.direction),
        })),
        new Set(),
        first.type,
      )
    )
      return null
  }

  return owners
}
