import type { Building, Rotation } from './buildings'
import type { BELTS, Splitter, Tunnel } from './logistics'

/** One world pixel scale, independent of camera zoom and decorative artwork. */
export const CELL_SIZE = 20
/** The existing 1×1 station reserves its complete 14×14 floor. */
export const STATION_CELLS = 14

/** Reference footprints and door starts; A/B keep their identities while sharing the same measured geometry. */
export const STATIONS = {
  station: { label: 'Station 1×1', size: 14, gates: [4] },
  station_2x2_a: { label: 'Station 2×2 A', size: 30, gates: [4, 20] },
  station_2x2_b: { label: 'Station 2×2 B', size: 30, gates: [4, 20] },
  drone: { label: 'Drone Station', size: 14, gates: [4] },
} as const

/** A coordinate pair; scene positions are integer world cells, camera positions are pixels. */
export interface Point {
  x: number
  y: number
}

/** Two independently configured catalog cargos; null means this outlet supplies nothing. */
export type DroneCargo = readonly [string | null, string | null]

/** Cargo permission keys follow their slots through rotation, copying and persistence. */
export const DRONE_OUTPUT_KEYS = ['cargo-0', 'cargo-1'] as const

export const STATION_NAME_MAX_LENGTH = 80

/** Legacy names remain readable saved metadata; malformed values must not silently discard the layout. */
export function isStationName(value: unknown): value is string | undefined {
  return (
    value === undefined ||
    (typeof value === 'string' &&
      !!value.trim() &&
      value === value.trim() &&
      value.length <= STATION_NAME_MAX_LENGTH &&
      [...value].every((character) => character.charCodeAt(0) >= 32))
  )
}

/** Legacy 1×1 floors omit their type; large variants retain it and drones own their orientation/cargo. */
export type StationTemplate = (
  | { type?: 'station' | 'station_2x2_a' | 'station_2x2_b' }
  | { type: 'drone'; rotation: Rotation; cargo: DroneCargo; disabledOutputs?: readonly string[] }
) & { name?: string }

/** Missing station type means the original 1×1 floor, preserving confirmed historical layouts. */
export function stationSize(station: Pick<StationTemplate, 'type'>): number {
  return STATIONS[station.type ?? 'station'].size
}

/** Confirmed station footprint in world cells. A drone deck is reserved, not construction floor. */
export type Station = Point & StationTemplate & { id: string }
export type DroneStation = Extract<Station, { type: 'drone' }>

/** One complete world-space route across floors/corridors; its first end sends and its last receives. */
export interface Belt {
  id: string
  points: readonly Point[]
  /** A one-cell route has no segment from which to infer its direction. Longer routes use anchor order. */
  heading?: Point
  /** Old routes omit their tier and remain MK1; mixed tiers share connection geometry, never implied throughput. */
  type?: keyof typeof BELTS
}

/** Confirmed scenario; selection, camera, drafts and clipboard are deliberately absent. */
export interface Scene {
  stations: readonly Station[]
  buildings: readonly Building[]
  belts: readonly Belt[]
  /** Missing collections mean empty in callers using the pre-logistics scene contract. Saved scenes normalize them on read. */
  splitters?: readonly Splitter[]
  tunnels?: readonly Tunnel[]
}

/** One explicit target, independent from the active tool. */
export type Selection = { kind: 'station' | 'building' | 'belt' | 'splitter' | 'tunnel'; id: string }

/** Converts world pixels to the nearest floor-cell origin, including negative coordinates. */
export function snapToGrid(point: Point): Point {
  return { x: Math.round(point.x / CELL_SIZE), y: Math.round(point.y / CELL_SIZE) }
}

/** Rejects off-grid/non-finite proposals and overlapping floors; touching edges are allowed. */
export function canPlaceStation(
  stations: readonly Station[],
  point: Point & Pick<StationTemplate, 'type' | 'name'>,
  excludedId?: string,
): boolean {
  if (!isStationName(point.name)) return false
  if (point.type !== undefined && !Object.hasOwn(STATIONS, point.type)) return false
  const size = stationSize(point)
  if (!Number.isSafeInteger(point.x) || !Number.isSafeInteger(point.y)) return false
  if (!Number.isSafeInteger(point.x + size) || !Number.isSafeInteger(point.y + size)) return false
  return !stations.some(
    (station) =>
      station.id !== excludedId &&
      point.x < station.x + stationSize(station) &&
      point.x + size > station.x &&
      point.y < station.y + stationSize(station) &&
      point.y + size > station.y,
  )
}
