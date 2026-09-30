import { CELL_SIZE, STATION_CORRIDOR_CELLS, STATION_GATE_CELLS, STATION_TYPES, type Direction, type StationType } from '../model/catalog'
import type { BaseStation } from './placement'

export interface StationCorridor {
  id: string
  ownerId: string
  otherId: string
  x: number
  y: number
  width: number
  height: number
}

/** A wall is drawn at the edge; it does not consume the adjacent buildable floor cell. */
export function isStationFloorCell(type: StationType, x: number, y: number): boolean {
  const { footprintCells } = STATION_TYPES[type]
  return x >= 0 && y >= 0 && x < footprintCells && y < footprintCells
}

export function isCorridorFloorCell(corridor: StationCorridor, x: number, y: number): boolean {
  return x >= corridor.x && y >= corridor.y && x < corridor.x + corridor.width && y < corridor.y + corridor.height
}

function bounds(station: BaseStation, position = station.position) {
  const size = STATION_TYPES[station.type].footprintCells * CELL_SIZE
  return { left: position.x, top: position.y, right: position.x + size, bottom: position.y + size }
}

function matchingGateStarts(
  a: BaseStation,
  b: BaseStation,
  axis: 'x' | 'y',
  aFace: Direction,
  bFace: Direction,
  aPosition: BaseStation['position'],
  bPosition: BaseStation['position'],
) {
  const aFaces: readonly string[] = STATION_TYPES[a.type].openFaces
  const bFaces: readonly string[] = STATION_TYPES[b.type].openFaces
  if (!aFaces.includes(aFace) || !bFaces.includes(bFace)) return []
  const aOrigin = aPosition[axis] / CELL_SIZE
  const bOrigin = bPosition[axis] / CELL_SIZE
  return STATION_TYPES[a.type].gateStarts
    .map((start) => aOrigin + start)
    .filter((start) => STATION_TYPES[b.type].gateStarts.some((other) => start === bOrigin + other))
}

/** The passage occupies the two empty grid cells between exactly aligned six-cell doorways. */
function corridorsBetween(a: BaseStation, b: BaseStation, aPosition = a.position, bPosition = b.position): StationCorridor[] {
  const first = bounds(a, aPosition)
  const second = bounds(b, bPosition)
  const gap = STATION_CORRIDOR_CELLS * CELL_SIZE
  if (first.right + gap === second.left || second.right + gap === first.left) {
    const left = first.right + gap === second.left ? a : b
    const right = left.id === a.id ? b : a
    const leftPosition = left.id === a.id ? aPosition : bPosition
    const rightPosition = left.id === a.id ? bPosition : aPosition
    return matchingGateStarts(left, right, 'y', 'east', 'west', leftPosition, rightPosition).map((y) => ({
      id: `${left.id}-${right.id}-y${y}`,
      ownerId: left.id,
      otherId: right.id,
      x: bounds(left, leftPosition).right / CELL_SIZE,
      y,
      width: STATION_CORRIDOR_CELLS,
      height: STATION_GATE_CELLS,
    }))
  }
  if (first.bottom + gap === second.top || second.bottom + gap === first.top) {
    const top = first.bottom + gap === second.top ? a : b
    const bottom = top.id === a.id ? b : a
    const topPosition = top.id === a.id ? aPosition : bPosition
    const bottomPosition = top.id === a.id ? bPosition : aPosition
    return matchingGateStarts(top, bottom, 'x', 'south', 'north', topPosition, bottomPosition).map((x) => ({
      id: `${top.id}-${bottom.id}-x${x}`,
      ownerId: top.id,
      otherId: bottom.id,
      x,
      y: bounds(top, topPosition).bottom / CELL_SIZE,
      width: STATION_GATE_CELLS,
      height: STATION_CORRIDOR_CELLS,
    }))
  }
  return []
}

/** Drone belt outlets occupy the two central cells of its only doorway. */
export function droneOutputPorts(station: BaseStation): { slot: 0 | 1; x: number; y: number; face: Direction; itemId: string | null }[] {
  if (station.type !== 'drone_station') return []
  const gateStart = STATION_TYPES.drone_station.gateStarts[0]
  const originX = station.position.x / CELL_SIZE
  const originY = station.position.y / CELL_SIZE
  return ([0, 1] as const).map((slot) => ({
    slot,
    x: originX + gateStart + 2 + slot,
    y: originY + STATION_TYPES.drone_station.footprintCells,
    face: 'south',
    itemId: station.droneOutputs?.[slot] ?? null,
  }))
}

export function connectedCorridors(stations: readonly BaseStation[]): StationCorridor[] {
  const corridors: StationCorridor[] = []
  for (let first = 0; first < stations.length; first += 1) {
    for (let second = first + 1; second < stations.length; second += 1) {
      corridors.push(...corridorsBetween(stations[first], stations[second]))
    }
  }
  return corridors
}

/** A step is traversable inside a station, along its passage, or through either matching doorway. */
export function canCrossStationBoundary(
  stations: readonly BaseStation[],
  from: { x: number; y: number },
  to: { x: number; y: number },
  corridors: readonly StationCorridor[] = connectedCorridors(stations),
): boolean {
  if (Math.abs(from.x - to.x) + Math.abs(from.y - to.y) !== 1) return false
  const stationAt = (point: { x: number; y: number }) =>
    stations.find((station) =>
      isStationFloorCell(station.type, point.x - station.position.x / CELL_SIZE, point.y - station.position.y / CELL_SIZE),
    )
  const source = stationAt(from)
  const target = stationAt(to)
  if (source && source.id === target?.id) return true
  for (const corridor of corridors) {
    const fromPassage = isCorridorFloorCell(corridor, from.x, from.y)
    const toPassage = isCorridorFloorCell(corridor, to.x, to.y)
    if (fromPassage && toPassage) return true
    if (fromPassage && target && (target.id === corridor.ownerId || target.id === corridor.otherId)) return true
    if (toPassage && source && (source.id === corridor.ownerId || source.id === corridor.otherId)) return true
  }
  return false
}

/** Modules connect only across a two-cell gap with complete doorways aligned. */
export function stationsConnect(a: BaseStation, b: BaseStation, aPosition = a.position, bPosition = b.position): boolean {
  return corridorsBetween(a, b, aPosition, bPosition).length > 0
}

export function stationOverlap(a: BaseStation, b: BaseStation, aPosition = a.position, bPosition = b.position): boolean {
  const first = bounds(a, aPosition)
  const second = bounds(b, bPosition)
  return first.left < second.right && first.right > second.left && first.top < second.bottom && first.bottom > second.top
}

/** A connected module group translates rigidly, so its corridors cannot drift apart. */
export function connectedStationIds(stations: readonly BaseStation[], startId: string): Set<string> {
  const connected = new Set([startId])
  let changed = true
  while (changed) {
    changed = false
    for (const station of stations) {
      if (connected.has(station.id)) continue
      if (stations.some((other) => connected.has(other.id) && stationsConnect(station, other))) {
        connected.add(station.id)
        changed = true
      }
    }
  }
  return connected
}
