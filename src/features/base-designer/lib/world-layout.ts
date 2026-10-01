import { CELL_SIZE, PLACEABLES, STATION_GATE_CELLS, STATION_TYPES, isRouteTool, isUndergroundType, type RouteTool } from '../model/catalog'
import { beltConnection } from './connections'
import { indexPlacements, type BasePlacement, type BaseStation } from './placement'
import {
  canCrossStationBoundary,
  connectedCorridors,
  connectedStationIds,
  isCorridorFloorCell,
  isStationFloorCell,
  stationOpenFaces,
  stationsConnect,
  type StationCorridor,
} from './stations'
import type { RouteCell } from './route'
import { oppositeDirection } from './ports'
import { isUndergroundPath, maxBuriedCells } from './underground'

export interface WorldPlacement extends BasePlacement {
  stationId: string
}

/** A world owner is transient metadata, not part of a persisted or copied placement. */
export function withoutStationOwner(piece: WorldPlacement): BasePlacement {
  const placement: BasePlacement & { stationId?: string } = { ...piece }
  delete placement.stationId
  return placement
}

/** Convert station-local cells to the shared flow grid for connections across doorways. */
export function worldPlacements(stations: readonly BaseStation[]): WorldPlacement[] {
  return stations.flatMap((station) => {
    const offsetX = station.position.x / CELL_SIZE
    const offsetY = station.position.y / CELL_SIZE
    return station.placements.map((piece) => ({ ...piece, stationId: station.id, x: piece.x + offsetX, y: piece.y + offsetY }))
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
  if (station) return station.type === 'drone_station' ? undefined : station
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

/** Validate a whole selection as one transaction, including complete routes and cross-station footprints. */
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

/** A world cell has exactly one owning station because station footprints never overlap. */
export function routeCellOwner(stations: readonly BaseStation[], startId: string, x: number, y: number): BaseStation | undefined {
  const groupIds = connectedStationIds(stations, startId)
  const group = stations.filter((station) => groupIds.has(station.id))
  return floorOwner(group, connectedCorridors(group), x, y)
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

/** Resolve every copied origin before mutation; a single invalid footprint rejects the whole paste. */
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

export function canPlaceRouteInLayout(
  stations: readonly BaseStation[],
  startId: string,
  cells: readonly RouteCell[],
  excludedIds: ReadonlySet<string> = new Set(),
  type?: RouteTool,
): boolean {
  return checkRouteInLayout(stations, startId, cells, excludedIds, type).ok
}

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
