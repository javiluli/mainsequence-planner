import { CELL_SIZE, PLACEABLES, STATION_TYPES } from '../../model/catalog'
import type { LayoutClipboard } from '../clipboard/clipboard'
import type { BaseNote, BasePlacement, BaseStation } from './placement'
import { rotateDirection, rotateDisabledOutputPorts } from '../connections/ports'
import { connectedStationIds, connectedCorridors } from './stations'
import { floorOwner, linkedStationIds, worldPlacements } from './world-layout'
import { pastePlacementOwners } from './placement-validation'

export type QuarterTurn = 1 | -1
type Point = { x: number; y: number }

function turnBox(position: Point, height: number, pivot: Point): Point {
  return { x: pivot.x + pivot.y - position.y - height, y: pivot.y + position.x - pivot.x }
}

function turnPiece(piece: BasePlacement, pivot: Point): BasePlacement {
  const footprint = PLACEABLES[piece.type]
  return {
    ...piece,
    ...turnBox(piece, footprint.height, pivot),
    direction: rotateDirection(piece.direction),
    incoming: piece.incoming ? rotateDirection(piece.incoming) : undefined,
    extraIncoming: piece.extraIncoming?.map(rotateDirection),
    disabledOutputPorts: rotateDisabledOutputPorts(piece),
  }
}

/** A fixed grid pivot makes four turns reversible, including mixed footprints and underground routes. */
export function rotatePlacements(source: readonly BasePlacement[], turns: number): BasePlacement[] {
  if (!source.length) return []
  const left = Math.min(...source.map((piece) => piece.x))
  const top = Math.min(...source.map((piece) => piece.y))
  const right = Math.max(...source.map((piece) => piece.x + PLACEABLES[piece.type].width))
  const bottom = Math.max(...source.map((piece) => piece.y + PLACEABLES[piece.type].height))
  const sameParity = (right - left) % 2 === (bottom - top) % 2
  const pivot = { x: (left + right) / 2, y: (top + bottom) / 2 }
  if (!sameParity) {
    pivot.x = Math.round(pivot.x)
    pivot.y = Math.round(pivot.y)
  }
  let pieces = [...source]
  for (let index = 0; index < ((turns % 4) + 4) % 4; index++) pieces = pieces.map((piece) => turnPiece(piece, pivot))
  return pieces
}

export function placementProposal(source: readonly BasePlacement[], dx: number, dy: number, turns = 0): BasePlacement[] {
  return rotatePlacements(source, turns).map((piece) => ({ ...piece, x: piece.x + dx, y: piece.y + dy }))
}

/** Moving floor includes its linked modules; unlike copying, movement cannot leave spanning contents behind. */
export function layoutMovementSource(
  stations: readonly BaseStation[],
  notes: readonly BaseNote[],
  ids: readonly string[],
): LayoutClipboard {
  const moving = new Set(ids)
  for (const station of stations) {
    if (moving.has(station.id)) linkedStationIds(stations, station.id).forEach((id) => moving.add(id))
  }
  return {
    stations: stations.filter((station) => moving.has(station.id)),
    notes: notes.filter((note) => moving.has(note.id)),
    skippedParts: 0,
    skippedRoutes: 0,
  }
}

/** The offset is in flow pixels; contents retain their local cell coordinates inside the moving floor. */
export function translateLayout(source: LayoutClipboard, offset: Point): LayoutClipboard {
  const translate = (position: Point) => ({ x: position.x + offset.x, y: position.y + offset.y })
  return {
    ...source,
    stations: source.stations.map((station) => ({ ...station, position: translate(station.position) })),
    notes: source.notes.map((note) => ({ ...note, position: translate(note.position) })),
  }
}

/** Choose a grid-aligned flow-pixel pivot from layout bounds; callers retain it for the whole movement/rotation gesture. */
export function layoutRotationPivot(source: LayoutClipboard): Point {
  const entries = [
    ...source.stations.map((station) => ({ position: station.position, size: STATION_TYPES[station.type].footprintCells * CELL_SIZE })),
    ...source.notes.map((note) => ({ position: note.position, size: 0 })),
  ]
  if (!entries.length) return { x: 0, y: 0 }
  return {
    x:
      Math.round(
        (Math.min(...entries.map((entry) => entry.position.x)) + Math.max(...entries.map((entry) => entry.position.x + entry.size))) /
          (2 * CELL_SIZE),
      ) * CELL_SIZE,
    y:
      Math.round(
        (Math.min(...entries.map((entry) => entry.position.y)) + Math.max(...entries.map((entry) => entry.position.y + entry.size))) /
          (2 * CELL_SIZE),
      ) * CELL_SIZE,
  }
}

/** Keep the same pivot throughout a gesture, even when a one-cell drone corridor makes the group asymmetric. */
export function rotateLayout(source: LayoutClipboard, turn: QuarterTurn, pivot = layoutRotationPivot(source)): LayoutClipboard {
  if (!source.stations.length && source.notes.length < 2) return source
  let layout = source
  for (let index = 0; index < (turn === 1 ? 1 : 3); index++) {
    layout = {
      ...layout,
      stations: layout.stations.map((station) => {
        const size = STATION_TYPES[station.type].footprintCells
        return {
          ...station,
          position: turnBox(station.position, size * CELL_SIZE, pivot),
          direction: rotateDirection(station.direction ?? 'south'),
          placements: station.placements.map((piece) => turnPiece(piece, { x: size / 2, y: size / 2 })),
        }
      }),
      notes: layout.notes.map((note) => ({ ...note, position: turnBox(note.position, 0, pivot) })),
    }
  }
  return layout
}

/** Validate transformed pieces against the real floor after removing only their original identities. */
export function transformedPlacementOwners(stations: readonly BaseStation[], proposal: readonly BasePlacement[]): BaseStation[] | null {
  if (!proposal.length) return null
  const selected = new Set(proposal.map((piece) => piece.id))
  const original = worldPlacements(stations)
  if (selected.size !== proposal.length || proposal.some((piece) => !original.some((source) => source.id === piece.id))) return null
  const routes = new Set(original.filter((piece) => selected.has(piece.id) && piece.routeId).map((piece) => piece.routeId))
  if (original.some((piece) => piece.routeId && routes.has(piece.routeId) && !selected.has(piece.id))) return null
  const empty = stations.map((station) => ({ ...station, placements: station.placements.filter((piece) => !selected.has(piece.id)) }))
  const corridors = connectedCorridors(empty)
  const owners = new Map<string, BaseStation>()
  const remaining = new Set(selected)
  for (const piece of proposal) {
    if (!remaining.has(piece.id)) continue
    const owner = floorOwner(empty, corridors, piece.x, piece.y)
    if (!owner) return null
    const group = connectedStationIds(empty, owner.id)
    const contents = proposal.filter((candidate) => {
      const target = floorOwner(empty, corridors, candidate.x, candidate.y)
      return target && group.has(target.id)
    })
    const contained = new Set(contents.map((candidate) => candidate.id))
    if (
      contents.some(
        (candidate) => candidate.routeId && proposal.some((other) => other.routeId === candidate.routeId && !contained.has(other.id)),
      )
    )
      return null
    const resolved = pastePlacementOwners(empty, owner.id, contents)
    if (!resolved) return null
    contents.forEach((candidate, index) => {
      owners.set(candidate.id, resolved[index])
      remaining.delete(candidate.id)
    })
  }
  const resolved = proposal.flatMap((piece) => {
    const owner = owners.get(piece.id)
    return owner ? [owner] : []
  })
  return resolved.length === proposal.length ? resolved : null
}
