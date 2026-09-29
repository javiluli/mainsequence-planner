import { PLACEABLES, STATION_TYPES, type Direction, type PlaceableType, type StationType } from '../model/catalog'
import { isStationFloorCell } from './stations'

export interface BasePlacement {
  id: string
  type: PlaceableType
  x: number
  y: number
  direction: Direction
  /** Belt face that receives material; omitted for machines. */
  incoming?: Direction
  /** All belt cells confirmed in one draw gesture share a route identity. */
  routeId?: string
}

export interface BaseStation {
  id: string
  type: StationType
  name: string
  position: { x: number; y: number }
  /** Explicit, reversible group links to aligned neighboring stations. */
  lockedTo: string[]
  placements: BasePlacement[]
}

/** Una huella solo cabe si queda íntegramente en la estación y no pisa otra pieza. */
export function canPlace(station: BaseStation, type: PlaceableType, x: number, y: number): boolean {
  const footprint = PLACEABLES[type]
  const size = STATION_TYPES[station.type].footprintCells
  if (x < 0 || y < 0 || x + footprint.width > size || y + footprint.height > size) return false
  for (let row = y; row < y + footprint.height; row++) {
    for (let column = x; column < x + footprint.width; column++) {
      if (!isStationFloorCell(station.type, column, row)) return false
    }
  }

  return !station.placements.some((placed) => {
    const other = PLACEABLES[placed.type]
    return x < placed.x + other.width && x + footprint.width > placed.x && y < placed.y + other.height && y + footprint.height > placed.y
  })
}

/** A drawn route translates rigidly: every cell must remain on free floor. */
export function canMoveRoute(station: BaseStation, routeId: string, dx: number, dy: number): boolean {
  const route = station.placements.filter((piece) => piece.routeId === routeId)
  if (route.length === 0) return false
  const withoutRoute = { ...station, placements: station.placements.filter((piece) => piece.routeId !== routeId) }
  return route.every((piece) => canPlace(withoutRoute, piece.type, piece.x + dx, piece.y + dy))
}

export function placementAt(station: BaseStation, x: number, y: number): BasePlacement | undefined {
  return station.placements.find((placed) => {
    const footprint = PLACEABLES[placed.type]
    return x >= placed.x && x < placed.x + footprint.width && y >= placed.y && y < placed.y + footprint.height
  })
}

/** Index every occupied cell once for dense layouts and live route previews. */
export function indexPlacements<T extends BasePlacement>(placements: readonly T[]): Map<string, T> {
  const occupied = new Map<string, T>()
  placements.forEach((placed) => {
    const footprint = PLACEABLES[placed.type]
    for (let y = placed.y; y < placed.y + footprint.height; y++) {
      for (let x = placed.x; x < placed.x + footprint.width; x++) occupied.set(`${x},${y}`, placed)
    }
  })
  return occupied
}
