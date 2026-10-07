import { CELL_SIZE, PLACEABLES, STATION_TYPES, type RouteTool } from '../../model/catalog'
import type { EditorSelection } from '../../model/editor-selection'
import type { BaseNote, BasePlacement, BaseStation } from '../layout/placement'
import type { RouteCell } from '../routes/route'
import { canPlaceStation, connectedCorridors, connectedStationIds } from '../layout/stations'
import { canPlaceInLayout, pastePlacementOwners } from '../layout/placement-validation'
import { floorOwner, withoutStationOwner, worldPlacements, type WorldPlacement } from '../layout/world-layout'

export type EditorClipboard = { kind: 'layout'; source: LayoutClipboard } | { kind: 'placements'; source: BasePlacement[] }

export type ClipboardPasteProposal =
  | { kind: 'layout'; draft: LayoutClipboard }
  | { kind: 'placements'; source: readonly BasePlacement[]; cursor: { x: number; y: number }; stationId: string }

export interface LayoutClipboard {
  stations: BaseStation[]
  notes: BaseNote[]
  skippedRoutes: number
  skippedParts: number
}

/** Snapshot explicit selection only. Area uses world cells; a picked route keeps its selected owner's local frame. */
export function createClipboardPayload({
  selection,
  stations,
  notes,
  worldPieces,
}: {
  selection: EditorSelection
  stations: readonly BaseStation[]
  notes: readonly BaseNote[]
  worldPieces: readonly WorldPlacement[]
}): EditorClipboard | null {
  if (!selection) return null
  if (selection.kind === 'nodes') {
    const source = copyLayoutSelection(stations, notes, selection.ids)
    return source.stations.length || source.notes.length ? { kind: 'layout', source } : null
  }
  if (selection.kind === 'area') {
    const ids = new Set(selection.ids)
    const source = worldPieces.filter((piece) => ids.has(piece.id)).map(withoutStationOwner)
    return source.length ? { kind: 'placements', source: structuredClone(source) } : null
  }
  const station = stations.find((candidate) => candidate.id === selection.stationId)
  const piece = station?.placements.find((candidate) => candidate.id === selection.placementId)
  if (!station || !piece) return null
  // Routes can span modules. Copy the complete identity, translating every cell by the same selected-owner offset.
  const source = piece.routeId
    ? worldPieces
        .filter((candidate) => candidate.routeId === piece.routeId)
        .map((candidate) => ({
          ...withoutStationOwner(candidate),
          x: candidate.x - station.position.x / CELL_SIZE,
          y: candidate.y - station.position.y / CELL_SIZE,
        }))
    : [piece]
  return source.length ? { kind: 'placements', source: structuredClone(source) } : null
}

/** Detach a drawn route from its anchors before rotation; its free preview must not carry external port references. */
export function createRoutePlacementPreview(
  type: RouteTool,
  cells: readonly (RouteCell & { buried: boolean; routeIndex: number })[],
): { source: BasePlacement[]; cursor: { x: number; y: number } } | null {
  if (!cells.length) return null
  const source = cells.map((cell, index): BasePlacement => ({
    x: cell.x,
    y: cell.y,
    direction: cell.direction,
    incoming: cell.incoming,
    buried: cell.buried,
    routeIndex: cell.routeIndex,
    id: `rotated-route-${index}`,
    type,
    routeId: 'rotated-route',
  }))
  const left = Math.min(...cells.map((cell) => cell.x))
  const top = Math.min(...cells.map((cell) => cell.y))
  const right = Math.max(...cells.map((cell) => cell.x))
  const bottom = Math.max(...cells.map((cell) => cell.y))
  // The same integer anchor as clipboardPlacementsAt keeps the unrotated route exactly where it was drawn.
  return { source, cursor: { x: left + Math.floor((right - left) / 2), y: top + Math.floor((bottom - top) / 2) } }
}

/** The selected boundary is explicit: do not expand it to rescue a partial route or machine. */
export function copyLayoutSelection(stations: readonly BaseStation[], notes: readonly BaseNote[], ids: readonly string[]): LayoutClipboard {
  const selected = new Set(ids)
  const sources = stations.filter((station) => selected.has(station.id))
  const empty = sources.map((station) => ({ ...station, placements: [] }))
  const pieces = worldPlacements(sources)
  const externalRoutes = new Set(
    stations
      .filter((station) => !selected.has(station.id))
      .flatMap((station) => station.placements.flatMap((piece) => (piece.routeId ? [piece.routeId] : []))),
  )
  const routes = new Map<string, typeof pieces>()
  for (const piece of pieces) {
    if (!piece.routeId) continue
    const route = routes.get(piece.routeId) ?? []
    route.push(piece)
    routes.set(piece.routeId, route)
  }
  const rejectedRoutes = new Set(
    [...routes]
      .filter(([id, route]) => externalRoutes.has(id) || !pastePlacementOwners(empty, route[0].stationId, route))
      .map(([id]) => id),
  )
  let skippedParts = 0
  const copies = sources.map((station) => ({
    ...station,
    lockedTo: station.lockedTo.filter((id) => selected.has(id)),
    placements: station.placements.filter((piece) => {
      if (piece.routeId) return !rejectedRoutes.has(piece.routeId)
      if (canPlaceInLayout(empty, station.id, piece.type, piece.x, piece.y)) return true
      skippedParts++
      return false
    }),
  }))
  return structuredClone({
    stations: copies,
    notes: notes.filter((note) => selected.has(note.id)),
    skippedRoutes: rejectedRoutes.size,
    skippedParts,
  })
}

/** One snapped translation preserves both world module spacing and local piece coordinates. */
export function clipboardLayoutAt(source: LayoutClipboard, cursor: { x: number; y: number }): LayoutClipboard {
  const entries = [
    ...source.stations.map((station) => ({ position: station.position, size: STATION_TYPES[station.type].footprintCells * CELL_SIZE })),
    ...source.notes.map((note) => ({ position: note.position, size: 0 })),
  ]
  if (!entries.length) return source
  const left = Math.min(...entries.map((entry) => entry.position.x))
  const top = Math.min(...entries.map((entry) => entry.position.y))
  const right = Math.max(...entries.map((entry) => entry.position.x + entry.size))
  const bottom = Math.max(...entries.map((entry) => entry.position.y + entry.size))
  const dx = Math.round((cursor.x - (left + right) / 2) / CELL_SIZE) * CELL_SIZE
  const dy = Math.round((cursor.y - (top + bottom) / 2) / CELL_SIZE) * CELL_SIZE
  const translate = (position: { x: number; y: number }) => ({ x: position.x + dx, y: position.y + dy })
  return {
    ...source,
    stations: source.stations.map((station) => ({ ...station, position: translate(station.position) })),
    notes: source.notes.map((note) => ({ ...note, position: translate(note.position) })),
  }
}

/** Validate the complete proposal before allocating identities or creating an undo entry. */
export function canPasteLayout(stations: readonly BaseStation[], proposal: LayoutClipboard): boolean {
  if (!proposal.stations.length && !proposal.notes.length) return false
  const identities = [...proposal.stations, ...proposal.notes].map((entry) => entry.id)
  if (new Set(identities).size !== identities.length) return false
  if (proposal.notes.some((note) => !Number.isFinite(note.position.x) || !Number.isFinite(note.position.y))) return false
  if (
    proposal.stations.some(
      (station, index) => !canPlaceStation([...stations, ...proposal.stations.filter((_, other) => other !== index)], station),
    )
  )
    return false
  const empty = proposal.stations.map((station) => ({ ...station, placements: [] }))
  const pieces = worldPlacements(proposal.stations)
  const checked = new Set<string>()
  for (const station of empty) {
    if (checked.has(station.id)) continue
    const group = connectedStationIds(empty, station.id)
    group.forEach((id) => checked.add(id))
    const contents = pieces.filter((piece) => group.has(piece.stationId))
    if (contents.length && !pastePlacementOwners(empty, station.id, contents)) return false
  }
  return true
}

/** Center the entire copied footprint on one snapped world cell, preserving relative positions. */
export function clipboardPlacementsAt(source: readonly BasePlacement[], cursor: { x: number; y: number }): BasePlacement[] {
  if (!source.length) return []
  const left = Math.min(...source.map((piece) => piece.x))
  const top = Math.min(...source.map((piece) => piece.y))
  const right = Math.max(...source.map((piece) => piece.x + PLACEABLES[piece.type].width))
  const bottom = Math.max(...source.map((piece) => piece.y + PLACEABLES[piece.type].height))
  const dx = cursor.x - left - Math.floor((right - left - 1) / 2)
  const dy = cursor.y - top - Math.floor((bottom - top - 1) / 2)
  return source.map((piece) => ({ ...piece, x: piece.x + dx, y: piece.y + dy }))
}

export function clipboardPlacementPreview(
  stations: readonly BaseStation[],
  source: readonly BasePlacement[],
  cursor: { x: number; y: number },
): { pieces: BasePlacement[]; stationId: string | null; valid: boolean } {
  const pieces = clipboardPlacementsAt(source, cursor)
  const origin = pieces[0]
  const owner = origin && floorOwner(stations, connectedCorridors(stations), origin.x, origin.y)
  return { pieces, stationId: owner?.id ?? null, valid: Boolean(owner && pastePlacementOwners(stations, owner.id, pieces)) }
}
