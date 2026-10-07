import { PLACEABLES, STATION_TYPES, type Direction, type PlaceableType, type StationType } from '../../model/catalog'
import { isStationFloorCell } from './stations'

/** Persisted x/y use station-local cells; world proposals reuse this shape and must be localized before commit. */
export interface BasePlacement {
  id: string
  type: PlaceableType
  x: number
  y: number
  direction: Direction
  /** Stable catalog recipe ID chosen for this machine; absent means unassigned. */
  recipeId?: string
  /** Disabling an output never blocks an input arriving through the same I/O. */
  disabledOutputPorts?: string[]
  /** Belt face that receives material; omitted for machines. */
  incoming?: Direction
  /** Extra directed inputs on a straight conveyor; never act as outputs. */
  extraIncoming?: Direction[]
  /** All belt cells confirmed in one draw gesture share a route identity. */
  routeId?: string
  /** Buried cells belong to the route but leave the surface free for construction. */
  buried?: boolean
  routeIndex?: number
}

export interface BaseStation {
  id: string
  type: StationType
  name: string
  /** Top-left in flow pixels, snapped to CELL_SIZE; placement contents remain station-local cells. */
  position: { x: number; y: number }
  /** Explicit, reversible group links to aligned neighboring stations. */
  lockedTo: string[]
  /** The drone module's only open face; regular stations have fixed, symmetric doors. */
  direction?: Direction
  /** Drone outlets are optional catalog item IDs, from left to right on its open face. */
  droneOutputs?: [string | null, string | null]
  placements: BasePlacement[]
}

export interface BaseNote {
  id: string
  /** Flow-pixel position; notes stay upright when their layout rotates. */
  position: { x: number; y: number }
  text: string
}

/** Una huella solo cabe si queda íntegramente en la estación y no pisa otra pieza. */
export function canPlace(station: BaseStation, type: PlaceableType, x: number, y: number): boolean {
  if (station.type === 'drone_station') return false
  const footprint = PLACEABLES[type]
  const size = STATION_TYPES[station.type].footprintCells
  if (x < 0 || y < 0 || x + footprint.width > size || y + footprint.height > size) return false
  for (let row = y; row < y + footprint.height; row++) {
    for (let column = x; column < x + footprint.width; column++) {
      if (!isStationFloorCell(station.type, column, row)) return false
    }
  }

  return !station.placements.some((placed) => {
    if (placed.buried) return false
    const other = PLACEABLES[placed.type]
    return x < placed.x + other.width && x + footprint.width > placed.x && y < placed.y + other.height && y + footprint.height > placed.y
  })
}

export function placementAt(station: BaseStation, x: number, y: number): BasePlacement | undefined {
  return station.placements.find((placed) => {
    if (placed.buried) return false
    const footprint = PLACEABLES[placed.type]
    return x >= placed.x && x < placed.x + footprint.width && y >= placed.y && y < placed.y + footprint.height
  })
}

/** Index every occupied cell once for dense layouts and live route previews. */
export function indexPlacements<T extends BasePlacement>(placements: readonly T[]): Map<string, T> {
  const occupied = new Map<string, T>()
  placements.forEach((placed) => {
    if (placed.buried) return
    const footprint = PLACEABLES[placed.type]
    for (let y = placed.y; y < placed.y + footprint.height; y++) {
      for (let x = placed.x; x < placed.x + footprint.width; x++) occupied.set(`${x},${y}`, placed)
    }
  })
  return occupied
}
