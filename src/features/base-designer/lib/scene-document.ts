import { BUILDINGS, type Building } from '../model/buildings'
import { BELTS, SPLITTERS, TUNNELS, SPLITTER_OUTPUT_KEYS, TUNNEL_OUTPUT_KEYS, type Splitter, type Tunnel } from '../model/logistics'
import { canPlaceStation, isStationName, DRONE_OUTPUT_KEYS, type Belt, type Point, type Scene, type Station } from '../model/scene'
import { canPlaceScenePieces, canPlaceBuilding } from './placement'
import { containsCell, floorCellLimit, isDroneCargo } from './stations'
import { beltCells, isBeltHeading } from './belts'
import { outputKeys, validDisabledOutputs } from './output-ports'

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value)

/** Saved geometry must be expressed in safe integer world cells. */
function isPoint(value: unknown): value is Point {
  return isRecord(value) && Number.isSafeInteger(value.x) && Number.isSafeInteger(value.y)
}

/** Validate a complete versioned document, converting older coordinates without repairing invalid records.
 * @param value - Untrusted parsed JSON, including its format version and scene collections.
 * @returns The restored scene, or null if any record, identity or placement is invalid.
 */
export function readSceneDocument(value: unknown): Scene | null {
  if (
    !isRecord(value) ||
    typeof value.version !== 'number' ||
    ![1, 2, 3, 4, 5, 6, 7, 8, 9, 10].includes(value.version) ||
    !isRecord(value.scene)
  )
    return null
  const saved = value.scene
  const version = value.version
  if (!Array.isArray(saved.stations) || !Array.isArray(saved.buildings) || !Array.isArray(saved.belts)) return null
  if (value.version >= 5 && (!Array.isArray(saved.splitters) || !Array.isArray(saved.tunnels))) return null
  if (
    value.version < 5 &&
    ((saved.splitters !== undefined && (!Array.isArray(saved.splitters) || saved.splitters.length > 0)) ||
      (saved.tunnels !== undefined && (!Array.isArray(saved.tunnels) || saved.tunnels.length > 0)))
  )
    return null
  const stations: Station[] = [],
    buildings: Building[] = [],
    belts: Belt[] = [],
    splitters: Splitter[] = [],
    tunnels: Tunnel[] = []
  const scene = { stations, buildings, belts, splitters, tunnels }
  const ids = new Set<string>()
  /** Older formats cannot smuggle in permissions that their version does not represent. */
  const validPermissions = (disabled: unknown, keys: readonly string[]): disabled is readonly string[] | undefined =>
    (disabled === undefined || version >= 9) && validDisabledOutputs(disabled, keys)
  /** Claim identities globally, so selection cannot ambiguously target two restored objects. */
  const claimId = (id: unknown): id is string => {
    if (typeof id !== 'string' || !id.trim() || ids.has(id)) return false
    ids.add(id)
    return true
  }
  for (const item of saved.stations) {
    if (!isRecord(item) || !isPoint(item) || !claimId(item.id)) return null
    if (!isStationName(item.name) || (item.name !== undefined && version < 10)) return null
    const name = item.name ? { name: item.name } : {}
    if (item.type === 'drone') {
      if (!validPermissions(item.disabledOutputs, DRONE_OUTPUT_KEYS)) return null
      if (value.version < 6 || ![0, 90, 180, 270].includes(item.rotation as number) || !isDroneCargo(item.cargo)) return null
      stations.push({
        id: item.id,
        x: item.x,
        y: item.y,
        type: 'drone',
        rotation: item.rotation as Building['rotation'],
        cargo: [...item.cargo],
        ...name,
        ...(item.disabledOutputs && { disabledOutputs: [...item.disabledOutputs] }),
      })
    } else {
      const large = item.type === 'station_2x2_a' || item.type === 'station_2x2_b'
      if (
        (item.type !== undefined && item.type !== 'station' && !large) ||
        (large && value.version < 7) ||
        item.rotation !== undefined ||
        item.cargo !== undefined ||
        item.disabledOutputs !== undefined
      )
        return null
      stations.push({
        id: item.id,
        x: item.x,
        y: item.y,
        ...name,
        ...(large ? { type: item.type as 'station_2x2_a' | 'station_2x2_b' } : {}),
      })
    }
    const station = stations[stations.length - 1]
    if (!canPlaceStation(stations, station, station.id)) return null
  }
  for (const item of saved.buildings) {
    if (
      !isRecord(item) ||
      !isPoint(item) ||
      !claimId(item.id) ||
      typeof item.stationId !== 'string' ||
      typeof item.type !== 'string' ||
      !Object.hasOwn(BUILDINGS, item.type) ||
      (value.version < 7 && !['refinery', 'assembler', 'reactor'].includes(item.type)) ||
      (item.recipeId !== undefined && (value.version < 8 || typeof item.recipeId !== 'string')) ||
      (item.rotation !== 0 && item.rotation !== 90 && item.rotation !== 180 && item.rotation !== 270)
    )
      return null
    const building: Building = {
      id: item.id,
      stationId: item.stationId,
      type: item.type as Building['type'],
      rotation: item.rotation,
      x: item.x,
      y: item.y,
      ...(typeof item.recipeId === 'string' && { recipeId: item.recipeId }),
    }
    if (!validPermissions(item.disabledOutputs, outputKeys(building))) return null
    if (item.disabledOutputs) building.disabledOutputs = [...item.disabledOutputs]
    if (!canPlaceBuilding(scene, building)) return null
    buildings.push(building)
  }
  for (const item of saved.belts) {
    if (!isRecord(item) || !claimId(item.id) || !Array.isArray(item.points) || !item.points.length || !item.points.every(isPoint))
      return null
    if (item.disabledOutputs !== undefined) return null
    if (item.type !== undefined && (value.version < 7 || typeof item.type !== 'string' || !Object.hasOwn(BELTS, item.type))) return null
    const heading = item.heading
    if (heading !== undefined && (value.version < 4 || !isPoint(heading) || !isBeltHeading(heading) || item.points.length !== 1))
      return null
    if (item.points.length === 1 && (value.version < 4 || heading === undefined)) return null
    if (value.version === 1) {
      const owner = stations.find((station) => station.id === item.stationId)
      if (!owner || !item.points.every((point) => containsCell(owner, point))) return null
    }
    const belt: Belt = {
      id: item.id,
      points: item.points.map(({ x, y }) => ({ x, y })),
      ...(item.type !== undefined && { type: item.type as Belt['type'] }),
      ...(isPoint(heading) && { heading: { ...heading } }),
    }
    belts.push(belt)
  }
  for (const item of value.version >= 5 ? (saved.splitters as unknown[]) : []) {
    if (
      !isRecord(item) ||
      !isPoint(item) ||
      !claimId(item.id) ||
      typeof item.type !== 'string' ||
      !Object.hasOwn(SPLITTERS, item.type) ||
      (item.rotation !== 0 && item.rotation !== 90 && item.rotation !== 180 && item.rotation !== 270)
    )
      return null
    if (!validPermissions(item.disabledOutputs, SPLITTER_OUTPUT_KEYS)) return null
    splitters.push({
      id: item.id,
      type: item.type as Splitter['type'],
      x: item.x,
      y: item.y,
      rotation: item.rotation,
      ...(item.disabledOutputs && { disabledOutputs: [...item.disabledOutputs] }),
    })
  }
  for (const item of value.version >= 5 ? (saved.tunnels as unknown[]) : []) {
    if (
      !isRecord(item) ||
      !claimId(item.id) ||
      typeof item.type !== 'string' ||
      !Object.hasOwn(TUNNELS, item.type) ||
      !isPoint(item.entry) ||
      !isPoint(item.exit)
    )
      return null
    if (!validPermissions(item.disabledOutputs, TUNNEL_OUTPUT_KEYS)) return null
    tunnels.push({
      id: item.id,
      type: item.type as Tunnel['type'],
      entry: { x: item.entry.x, y: item.entry.y },
      exit: { x: item.exit.x, y: item.exit.y },
      ...(item.disabledOutputs && { disabledOutputs: [...item.disabledOutputs] }),
    })
  }
  // Validate against all restored collections, so document order cannot hide surface or underground collisions.
  if (!canPlaceScenePieces(scene)) return null
  const legacyOccupied = new Set<string>()
  for (const belt of belts) {
    if (value.version < 3) {
      for (const cell of beltCells(belt.points, floorCellLimit(stations)) ?? []) {
        const key = `${cell.x},${cell.y}`
        if (legacyOccupied.has(key)) return null
        legacyOccupied.add(key)
      }
    }
  }
  return scene
}

/** Persist confirmed content only, never store actions or transient editor state. */
export function writeSceneDocument({ stations, buildings, belts, splitters = [], tunnels = [] }: Scene): string {
  // Declare the minimum format needed: ordinary routes remain readable by format-3 clients.
  const names = stations.some((station) => station.name !== undefined)
  const drones = stations.some((station) => station.type === 'drone')
  const logistics = drones || splitters.length > 0 || tunnels.length > 0
  const recipes = buildings.some((building) => building.recipeId !== undefined)
  const permissions = [...buildings, ...splitters, ...tunnels, ...stations.filter((station) => station.type === 'drone')].some(
    (piece) => piece.disabledOutputs !== undefined,
  )
  const extended =
    stations.some((station) => station.type === 'station_2x2_a' || station.type === 'station_2x2_b') ||
    buildings.some((building) => !['refinery', 'assembler', 'reactor'].includes(building.type)) ||
    belts.some((belt) => belt.type !== undefined)
  return JSON.stringify({
    version: names
      ? 10
      : permissions
        ? 9
        : recipes
          ? 8
          : extended
            ? 7
            : drones
              ? 6
              : logistics
                ? 5
                : belts.some((belt) => belt.heading)
                  ? 4
                  : 3,
    scene: { stations, buildings, belts, ...(names || logistics || extended || recipes || permissions ? { splitters, tunnels } : {}) },
  })
}
