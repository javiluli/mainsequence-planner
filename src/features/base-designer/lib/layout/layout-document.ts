import { CELL_SIZE, PLACEABLES, STATION_TYPES, type Direction, type PlaceableType, type StationType } from '../../model/catalog'
import { itemById } from '@/shared/data'
import { machinePortKey, machinePorts } from '../connections/ports'
import { recipeForPlaceable } from '../products/machine-recipes'
import { canPasteLayout } from '../clipboard/clipboard'
import { stationsConnect } from './stations'
import type { BaseNote, BasePlacement, BaseStation } from './placement'

/** Confirmed layout only. Stations/notes use flow pixels; placements use station-local cells. */
export interface BaseLayoutDocument {
  stations: BaseStation[]
  notes: BaseNote[]
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
function isDirection(value: unknown): value is Direction {
  return value === 'north' || value === 'east' || value === 'south' || value === 'west'
}
function isPlaceableType(value: unknown): value is PlaceableType {
  return typeof value === 'string' && Object.hasOwn(PLACEABLES, value)
}
function isStationType(value: unknown): value is StationType {
  return typeof value === 'string' && Object.hasOwn(STATION_TYPES, value)
}
function isId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isId)
}
function position(value: unknown): { x: number; y: number } | null {
  if (!isRecord(value) || typeof value.x !== 'number' || typeof value.y !== 'number') return null
  return Number.isFinite(value.x) && Number.isFinite(value.y) ? { x: value.x, y: value.y } : null
}
function arrayOf<T>(value: unknown, parse: (entry: unknown) => T | null): T[] | null {
  if (!Array.isArray(value)) return null
  const entries: T[] = []
  for (const valueEntry of value) {
    const entry = parse(valueEntry)
    if (entry === null) return null
    entries.push(entry)
  }
  return entries
}
function placement(value: unknown): BasePlacement | null {
  if (!isRecord(value) || !isId(value.id) || !isPlaceableType(value.type) || !isDirection(value.direction)) return null
  if (typeof value.x !== 'number' || typeof value.y !== 'number' || !Number.isSafeInteger(value.x) || !Number.isSafeInteger(value.y))
    return null
  if (value.recipeId !== undefined && (!isId(value.recipeId) || !recipeForPlaceable(value.type, value.recipeId))) return null
  if (value.incoming !== undefined && !isDirection(value.incoming)) return null
  if (value.extraIncoming !== undefined && (!Array.isArray(value.extraIncoming) || !value.extraIncoming.every(isDirection))) return null
  if (value.routeId !== undefined && !isId(value.routeId)) return null
  if (value.buried !== undefined && typeof value.buried !== 'boolean') return null
  if (
    value.routeIndex !== undefined &&
    (typeof value.routeIndex !== 'number' || !Number.isSafeInteger(value.routeIndex) || value.routeIndex < 0)
  )
    return null
  if (value.disabledOutputPorts !== undefined && !strings(value.disabledOutputPorts)) return null
  // Construct a whitelist rather than spreading browser data: transient world stationId must never cross this boundary.
  const piece: BasePlacement = { id: value.id, type: value.type, x: value.x, y: value.y, direction: value.direction }
  if (isId(value.recipeId)) piece.recipeId = value.recipeId
  if (isDirection(value.incoming)) piece.incoming = value.incoming
  if (Array.isArray(value.extraIncoming) && value.extraIncoming.every(isDirection)) piece.extraIncoming = value.extraIncoming
  if (isId(value.routeId)) piece.routeId = value.routeId
  if (typeof value.buried === 'boolean') piece.buried = value.buried
  if (typeof value.routeIndex === 'number') piece.routeIndex = value.routeIndex
  if (strings(value.disabledOutputPorts)) {
    const ports = new Set(machinePorts(piece).map(machinePortKey))
    if (value.disabledOutputPorts.some((key) => !ports.has(key))) return null
    piece.disabledOutputPorts = value.disabledOutputPorts
  }
  return piece
}
function station(value: unknown): BaseStation | null {
  if (!isRecord(value) || !isId(value.id) || !isStationType(value.type) || typeof value.name !== 'string' || !strings(value.lockedTo))
    return null
  const point = position(value.position)
  const pieces = arrayOf(value.placements, placement)
  if (!point || !pieces || !Number.isSafeInteger(point.x / CELL_SIZE) || !Number.isSafeInteger(point.y / CELL_SIZE)) return null
  if (value.direction !== undefined && !isDirection(value.direction)) return null
  const result: BaseStation = {
    id: value.id,
    type: value.type,
    name: value.name,
    position: point,
    lockedTo: value.lockedTo,
    placements: pieces,
  }
  if (isDirection(value.direction)) result.direction = value.direction
  if (value.droneOutputs !== undefined) {
    const cargo = value.droneOutputs
    if (!Array.isArray(cargo) || cargo.length !== 2) return null
    const isCargo = (item: unknown): item is string | null => item === null || (typeof item === 'string' && itemById.has(item))
    if (!isCargo(cargo[0]) || !isCargo(cargo[1]) || value.type !== 'drone_station') return null
    result.droneOutputs = [cargo[0], cargo[1]]
  }
  return result
}
function note(value: unknown): BaseNote | null {
  if (!isRecord(value) || !isId(value.id) || typeof value.text !== 'string') return null
  const point = position(value.position)
  return point ? { id: value.id, position: point, text: value.text } : null
}

/**
 * Decode untrusted browser data atomically. Reuse placement/floor validation so a restored route
 * follows the same rules as a committed paste; reject the whole document instead of losing parts silently.
 */
export function decodeBaseLayout(value: unknown): BaseLayoutDocument | null {
  if (!isRecord(value)) return null
  const stations = arrayOf(value.stations, station)
  const notes = arrayOf(value.notes, note)
  if (!stations || !notes) return null
  const ids = [...stations, ...notes, ...stations.flatMap((entry) => entry.placements)].map((entry) => entry.id)
  const identities = new Set(ids)
  if (identities.size !== ids.length) return null
  if (stations.some((entry) => entry.placements.some((piece) => piece.routeId && identities.has(piece.routeId)))) return null
  const byId = new Map(stations.map((entry) => [entry.id, entry]))
  if (
    stations.some(
      (entry) =>
        new Set(entry.lockedTo).size !== entry.lockedTo.length ||
        entry.lockedTo.some((id) => {
          const other = byId.get(id)
          return !other || other.id === entry.id || !other.lockedTo.includes(entry.id) || !stationsConnect(entry, other)
        }),
    )
  )
    return null
  const document = { stations, notes }
  return (!stations.length && !notes.length) || canPasteLayout([], { ...document, skippedParts: 0, skippedRoutes: 0 }) ? document : null
}
