import { CELL_SIZE, PLACEABLES, STATION_TYPES } from '../../model/catalog'
import { type BasePlacement, type BaseStation } from './placement'
import {
  connectedCorridors,
  connectedStationIds,
  isCorridorFloorCell,
  isStationFloorCell,
  stationsConnect,
  type StationCorridor,
} from './stations'

export interface WorldPlacement extends BasePlacement {
  stationId: string
}

/** A world owner is transient metadata, not part of a persisted or copied placement. */
export function withoutStationOwner(piece: WorldPlacement): BasePlacement {
  const placement: BasePlacement & { stationId?: string } = { ...piece }
  delete placement.stationId
  return placement
}

/** Convert local placement cells to world cells using the station origin in flow pixels; stationId stays transient. */
export function worldPlacements(stations: readonly BaseStation[]): WorldPlacement[] {
  return stations.flatMap((station) => {
    const offsetX = station.position.x / CELL_SIZE
    const offsetY = station.position.y / CELL_SIZE
    return station.placements.map((piece) => ({ ...piece, stationId: station.id, x: piece.x + offsetX, y: piece.y + offsetY }))
  })
}

/**
 * Project neighboring world pieces into the receiving station's local cells.
 * The one-cell halo around floor/passages lets belts see the next cell across a doorway.
 */
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

/** Resolve a world-cell floor owner, including derived corridor floor; drone bodies are not buildable floor. */
export function floorOwner(
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

/** A world cell has exactly one owning station because station footprints never overlap. */
export function routeCellOwner(stations: readonly BaseStation[], startId: string, x: number, y: number): BaseStation | undefined {
  const groupIds = connectedStationIds(stations, startId)
  const group = stations.filter((station) => groupIds.has(station.id))
  return floorOwner(group, connectedCorridors(group), x, y)
}

/** Resolve a route in its origin's connected group using one geometry pass.
 * The result follows cell order so commits can distribute cells without rebuilding corridors per node/cell.
 * Missing ownership rejects the complete proposal; it must never silently drop a cell.
 */
export function routeCellOwners(
  stations: readonly BaseStation[],
  startId: string,
  cells: readonly Pick<BasePlacement, 'x' | 'y'>[],
): BaseStation[] | null {
  const groupIds = connectedStationIds(stations, startId)
  const group = stations.filter((station) => groupIds.has(station.id))
  const corridors = connectedCorridors(group)
  const owners: BaseStation[] = []
  for (const cell of cells) {
    const owner = floorOwner(group, corridors, cell.x, cell.y)
    if (!owner) return null
    owners.push(owner)
  }
  return owners
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
