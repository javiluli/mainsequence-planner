import { itemById } from '@/shared/data'
import type { BuildingPort, Rotation } from '../model/buildings'
import {
  canPlaceStation,
  STATION_CELLS,
  STATIONS,
  DRONE_OUTPUT_KEYS,
  stationSize,
  type DroneCargo,
  type Point,
  type Station,
  type StationTemplate,
} from '../model/scene'

/** Aligned doorways span six cells; ordinary modules leave two cells between their floors. */
export const GATE_CELLS = 6
export const CORRIDOR_CELLS = 2
const gateStart = (STATION_CELLS - GATE_CELLS) / 2
export const DRONE_CORRIDOR_CELLS = 1

/** Validate both cargo slots against the committed catalog, not display names or invented supplies. */
export function isDroneCargo(value: unknown): value is DroneCargo {
  return Array.isArray(value) && value.length === 2 && value.every((id) => id === null || (typeof id === 'string' && itemById.has(id)))
}

/** Rotation zero opens south; clockwise rotation turns the doorway and both outlets together. */
export function droneHeading(rotation: Rotation): Point {
  return [
    { x: 0, y: 1 },
    { x: -1, y: 0 },
    { x: 0, y: -1 },
    { x: 1, y: 0 },
  ][rotation / 90]
}

/** Ordinary floors accept all four doorways; a drone exposes only its oriented opening. */
function opensToward(station: StationTemplate, normal: Point): boolean {
  if (station.type !== 'drone') return true
  const direction = droneHeading(station.rotation)
  return direction.x === normal.x && direction.y === normal.y
}

/** Two dedicated outputs occupy the central cells outside the doorway, using the same physical coordinates as machines. */
export function dronePorts(station: Station): (BuildingPort & { stationId: string; slot: 0 | 1; itemId: string | null })[] {
  if (station.type !== 'drone') return []
  return ([0, 1] as const).map((slot) => {
    let cell = { x: gateStart + 2 + slot, y: STATION_CELLS }
    for (let angle = 0; angle < station.rotation; angle += 90) cell = { x: STATION_CELLS - 1 - cell.y, y: cell.x }
    cell = { x: cell.x + station.x, y: cell.y + station.y }
    const normal = droneHeading(station.rotation)
    const outputKey = DRONE_OUTPUT_KEYS[slot]
    return {
      key: `${station.id}:${outputKey}`,
      outputKey,
      outputEnabled: !station.disabledOutputs?.includes(outputKey),
      stationId: station.id,
      slot,
      itemId: station.cargo[slot],
      cell,
      normal,
      position: { x: cell.x + 0.5 - normal.x * 0.5, y: cell.y + 0.5 - normal.y * 0.5 },
    }
  })
}

/** Derived floor shared by two stations, never persisted as a second source of connections. */
export interface StationCorridor extends Point {
  width: number
  height: number
  stationIds: readonly [string, string]
}

/** Derive each aligned pair once; the temporary lookup avoids comparing every pair of modules. */
export function stationCorridors(stations: readonly Station[]): StationCorridor[] {
  const leftDoors = new Map<string, Station>(),
    topDoors = new Map<string, Station>()
  for (const station of stations)
    for (const gate of STATIONS[station.type ?? 'station'].gates) {
      leftDoors.set(`${station.x},${station.y + gate}`, station)
      topDoors.set(`${station.x + gate},${station.y}`, station)
    }
  const corridors: StationCorridor[] = []
  for (const station of stations) {
    const size = stationSize(station)
    for (const gap of [DRONE_CORRIDOR_CELLS, CORRIDOR_CELLS]) {
      for (const gate of STATIONS[station.type ?? 'station'].gates) {
        const right = leftDoors.get(`${station.x + size + gap},${station.y + gate}`)
        const below = topDoors.get(`${station.x + gate},${station.y + size + gap}`)
        const joins = (other: Station, normal: Point) =>
          gap === (station.type === 'drone' || other.type === 'drone' ? DRONE_CORRIDOR_CELLS : CORRIDOR_CELLS) &&
          opensToward(station, normal) &&
          opensToward(other, { x: -normal.x, y: -normal.y })
        if (right && joins(right, { x: 1, y: 0 }))
          corridors.push({
            x: station.x + size,
            y: station.y + gate,
            width: gap,
            height: GATE_CELLS,
            stationIds: [station.id, right.id],
          })
        if (below && joins(below, { x: 0, y: 1 }))
          corridors.push({
            x: station.x + gate,
            y: station.y + size,
            width: GATE_CELLS,
            height: gap,
            stationIds: [station.id, below.id],
          })
      }
    }
  }
  return corridors
}

/** Half-open world footprint; artwork and outlines cannot enlarge walkable floor. */
export function containsCell(region: Station | StationCorridor, point: Point): boolean {
  const width = 'width' in region ? region.width : stationSize(region)
  const height = 'height' in region ? region.height : stationSize(region)
  return point.x >= region.x && point.y >= region.y && point.x < region.x + width && point.y < region.y + height
}

/** Resolve real floor support, including corridor endpoints; callers can reuse a derived corridor list. */
export function floorAt(
  stations: readonly Station[],
  corridors: readonly StationCorridor[],
  point: Point,
): Station | StationCorridor | undefined {
  return (
    stations.find((station) => station.type !== 'drone' && containsCell(station, point)) ??
    corridors.find((corridor) => containsCell(corridor, point))
  )
}

/** Bound expansion by measured floor areas plus every possible doorway, including both doors on large modules. */
export function floorCellLimit(stations: readonly Station[]): number {
  return stations.reduce(
    (area, station) =>
      area + stationSize(station) ** 2 + STATIONS[station.type ?? 'station'].gates.length * 4 * GATE_CELLS * CORRIDOR_CELLS,
    0,
  )
}

/** Attract within two world cells to the nearest valid aligned neighbor; ignore the moving station itself. */
export function snapStation(stations: readonly Station[], point: Point & StationTemplate, excludedId?: string): Point {
  const moving = stations.find((station) => station.id === excludedId) ?? point
  let best = point
  let distance = 4
  for (const station of stations) {
    if (station.id === excludedId) continue
    const gap = station.type === 'drone' || moving.type === 'drone' ? DRONE_CORRIDOR_CELLS : CORRIDOR_CELLS
    for (const normal of [
      { x: 1, y: 0 },
      { x: -1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: -1 },
    ]) {
      if (!opensToward(station, normal) || !opensToward(moving, { x: -normal.x, y: -normal.y })) continue
      for (const theirGate of STATIONS[station.type ?? 'station'].gates)
        for (const ourGate of STATIONS[moving.type ?? 'station'].gates) {
          const candidate = normal.x
            ? {
                x: normal.x > 0 ? station.x + stationSize(station) + gap : station.x - stationSize(moving) - gap,
                y: station.y + theirGate - ourGate,
              }
            : {
                x: station.x + theirGate - ourGate,
                y: normal.y > 0 ? station.y + stationSize(station) + gap : station.y - stationSize(moving) - gap,
              }
          const squared = (point.x - candidate.x) ** 2 + (point.y - candidate.y) ** 2
          if (squared <= distance && canPlaceStation(stations, { ...moving, ...candidate }, excludedId)) {
            best = candidate
            distance = squared
          }
        }
    }
  }
  return best
}
