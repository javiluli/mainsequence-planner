import { CELL_SIZE, isConveyorType, isUndergroundType, type RouteTool } from '../../model/catalog'
import { beltConnection, beltIncoming } from '../connections/connections'
import { directionSteps, oppositeDirection } from '../connections/ports'
import { indexPlacements, type BasePlacement, type BaseStation } from '../layout/placement'
import { canCrossStationBoundary, connectedCorridors } from '../layout/stations'
import { routeCellOwners, worldPlacements } from '../layout/world-layout'
import { canPlaceRouteInLayout } from './route-validation'
import { isUndergroundPath } from './underground'
import type { BeltJunction, RouteCell } from './route'

interface RoutePlacementOptions {
  stations: readonly BaseStation[]
  stationId: string
  type: RouteTool
  cells: readonly RouteCell[]
  allocateId: () => string
  mergeRouteIds?: readonly string[]
  junction?: BeltJunction
}

/**
 * Validate a complete world-cell route, then distribute new local pieces and merge compatible identities.
 * Rejection returns null without consuming IDs. allocateId is the only effect: its owner is the store,
 * while this module neither writes state nor records history. Merges keep existing piece IDs and the first matching route ID.
 */
export function createRoutePlacement({
  stations,
  stationId,
  type,
  cells,
  allocateId,
  mergeRouteIds = [],
  junction,
}: RoutePlacementOptions): BaseStation[] | null {
  if (isUndergroundType(type) && (mergeRouteIds.length > 0 || junction || !isUndergroundPath(type, cells, true))) return null
  if (!canPlaceRouteInLayout(stations, stationId, cells, new Set(), type)) return null
  const owners = routeCellOwners(stations, stationId, cells)
  if (!owners) return null
  const merging = new Set(mergeRouteIds)
  if (junction) {
    if (!isConveyorType(type)) return null
    const target = worldPlacements(stations).find((piece) => piece.id === junction.targetId)
    const last = cells.at(-1)
    if (!target || !target.routeId || target.type !== type || !last) return null
    if (merging.has(target.routeId)) return null
    const incoming = beltIncoming(target)
    if (
      incoming !== oppositeDirection(target.direction) ||
      junction.face === incoming ||
      junction.face === target.direction ||
      target.extraIncoming?.includes(junction.face)
    )
      return null
    const [dx, dy] = directionSteps[junction.face]
    if (
      last.x !== target.x + dx ||
      last.y !== target.y + dy ||
      last.direction !== oppositeDirection(junction.face) ||
      !canCrossStationBoundary(stations, last, target, connectedCorridors(stations))
    )
      return null
  }
  const existing = stations.flatMap((station) => station.placements).filter((piece) => piece.routeId && merging.has(piece.routeId))
  if (existing.some((piece) => piece.type !== type)) return null
  // All floor, tunnel, tier and lateral-face checks precede allocation of route/piece identities.
  const routeId = existing[0]?.routeId ?? allocateId()
  return stations.map((candidate) => {
    // Owners follow input cell order, including corridor cells. A route crossing modules stays one identity,
    // but every piece is stored in its owner's local cells without transient world stationId metadata.
    const owned = cells
      .map((cell, index) => ({
        ...cell,
        routeIndex: index,
        buried: isUndergroundType(type) && index > 0 && index < cells.length - 1,
      }))
      .filter((_cell, index) => owners[index].id === candidate.id)
    if (
      !owned.length &&
      !candidate.placements.some((piece) => (piece.routeId && merging.has(piece.routeId)) || piece.id === junction?.targetId)
    )
      return candidate
    return {
      ...candidate,
      placements: [
        ...candidate.placements.map((piece) =>
          junction && piece.id === junction.targetId
            ? { ...piece, extraIncoming: [...(piece.extraIncoming ?? []), junction.face] }
            : piece.routeId && merging.has(piece.routeId)
              ? { ...piece, routeId }
              : piece,
        ),
        ...owned.map((cell) => ({
          id: allocateId(),
          routeId,
          type,
          x: cell.x - candidate.position.x / CELL_SIZE,
          y: cell.y - candidate.position.y / CELL_SIZE,
          direction: cell.direction,
          incoming: cell.incoming,
          buried: cell.buried,
          routeIndex: cell.routeIndex,
        })),
      ],
    }
  })
}

/** Lateral branches have independent route identities. Detaching one must release its receiving face. */
export function pruneDisconnectedBeltJunctions(stations: BaseStation[]): BaseStation[] {
  if (!stations.some((station) => station.placements.some((piece) => piece.extraIncoming?.length))) return stations
  const pieces = worldPlacements(stations)
  const occupied = indexPlacements(pieces)
  const corridors = connectedCorridors(stations)
  const survivingFaces = new Map<string, BasePlacement['extraIncoming']>()
  for (const piece of pieces) {
    if (!piece.extraIncoming?.length) continue
    const remaining = piece.extraIncoming.filter((face) => {
      const neighbor = beltConnection(occupied, piece, face, (x, y, direction) => {
        const step = direction === 'north' ? [0, -1] : direction === 'east' ? [1, 0] : direction === 'south' ? [0, 1] : [-1, 0]
        return canCrossStationBoundary(stations, { x, y }, { x: x + step[0], y: y + step[1] }, corridors)
      })
      return neighbor?.type === piece.type && neighbor.direction === oppositeDirection(face)
    })
    if (remaining.length !== piece.extraIncoming.length) survivingFaces.set(piece.id, remaining.length ? remaining : undefined)
  }
  if (!survivingFaces.size) return stations
  return stations.map((station) =>
    station.placements.some((piece) => survivingFaces.has(piece.id))
      ? {
          ...station,
          placements: station.placements.map((piece) =>
            survivingFaces.has(piece.id) ? { ...piece, extraIncoming: survivingFaces.get(piece.id) } : piece,
          ),
        }
      : station,
  )
}
