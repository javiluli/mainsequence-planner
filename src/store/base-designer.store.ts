import { canPlace, placementAt, type BasePlacement, type BaseStation } from '@/features/base-designer/lib/placement'
import { oppositeDirection, rotateDirection } from '@/features/base-designer/lib/ports'
import type { RouteCell } from '@/features/base-designer/lib/route'
import { stationOverlap, stationsConnect } from '@/features/base-designer/lib/stations'
import {
  canMoveInLayout,
  canMoveRouteInLayout,
  canPlaceInLayout,
  canPlaceRouteInLayout,
  hasLinkedNeighbor,
  hasSpanningPlacement,
  linkedStationIds,
  routeCellOwner,
  worldPlacements,
} from '@/features/base-designer/lib/world-layout'
import {
  CELL_SIZE,
  PLACEABLES,
  STATION_TYPES,
  type Direction,
  type PlaceableType,
  type RouteTool,
  type StationType,
} from '@/features/base-designer/model/catalog'
import { create } from 'zustand'

interface BaseDesignerState {
  stations: BaseStation[]
  past: BaseStation[][]
  future: BaseStation[][]
  dragStartStations: BaseStation[] | null
  addStation: (type: StationType) => void
  beginMoveStation: () => void
  moveStation: (id: string, position: { x: number; y: number }) => void
  endMoveStation: () => void
  undo: () => void
  redo: () => void
  renameStation: (id: string, name: string) => void
  toggleStationLock: (firstId: string, secondId: string) => void
  removeStation: (id: string) => boolean
  cloneStation: (source: BaseStation) => string
  pastePlacements: (stationId: string, source: readonly BasePlacement[]) => string | null
  place: (stationId: string, type: PlaceableType, x: number, y: number, direction?: Direction) => boolean
  placeRoute: (stationId: string, type: RouteTool, cells: readonly RouteCell[], mergeRouteIds?: readonly string[]) => boolean
  movePlacement: (stationId: string, placementId: string, x: number, y: number) => boolean
  moveRoute: (stationId: string, routeId: string, dx: number, dy: number) => boolean
  rotateAt: (stationId: string, x: number, y: number) => void
  removeAt: (stationId: string, x: number, y: number) => void
}

let nextId = 1
const makeId = () => `base-part-${nextId++}`
const historyLimit = 50

function changed(state: BaseDesignerState, stations: BaseStation[]): Partial<BaseDesignerState> {
  return { stations, past: [...state.past, state.stations].slice(-historyLimit), future: [] }
}

/** Estado de sesión deliberado: al recargar se empieza de nuevo, sin escribir en localStorage. */
export const useBaseDesignerStore = create<BaseDesignerState>((set, get) => ({
  stations: [],
  past: [],
  future: [],
  dragStartStations: null,
  addStation: (type) =>
    set((state) => {
      const nextX = state.stations.reduce(
        (furthest, station) => Math.max(furthest, station.position.x + STATION_TYPES[station.type].footprintCells * CELL_SIZE + 120),
        0,
      )
      return changed(state, [
        ...state.stations,
        {
          id: makeId(),
          type,
          name: `${STATION_TYPES[type].label} ${state.stations.length + 1}`,
          position: { x: nextX, y: 0 },
          lockedTo: [],
          placements: [],
        },
      ])
    }),
  beginMoveStation: () => set((state) => ({ dragStartStations: state.stations })),
  moveStation: (id, position) =>
    set((state) => {
      const moving = state.stations.find((station) => station.id === id)
      if (!moving) return state
      const group = linkedStationIds(state.stations, id)
      const others = state.stations.filter((station) => !group.has(station.id))
      const candidate = { x: Math.round(position.x / CELL_SIZE) * CELL_SIZE, y: Math.round(position.y / CELL_SIZE) * CELL_SIZE }
      const dx = candidate.x - moving.position.x
      const dy = candidate.y - moving.position.y
      if (dx === 0 && dy === 0) return state
      const translated = state.stations.map((station) =>
        group.has(station.id) ? { ...station, position: { x: station.position.x + dx, y: station.position.y + dy } } : station,
      )
      if (translated.some((station) => group.has(station.id) && others.some((other) => stationOverlap(station, other)))) {
        // Re-send the authoritative positions so React Flow cannot leave an invalid drag ghost behind.
        return { stations: [...state.stations] }
      }
      return { stations: translated }
    }),
  endMoveStation: () =>
    set((state) =>
      state.dragStartStations && state.dragStartStations !== state.stations
        ? { past: [...state.past, state.dragStartStations].slice(-historyLimit), future: [], dragStartStations: null }
        : { dragStartStations: null },
    ),
  undo: () =>
    set((state) => {
      const previous = state.past.at(-1)
      return previous
        ? { stations: previous, past: state.past.slice(0, -1), future: [state.stations, ...state.future], dragStartStations: null }
        : state
    }),
  redo: () =>
    set((state) => {
      const [next, ...rest] = state.future
      return next
        ? { stations: next, past: [...state.past, state.stations].slice(-historyLimit), future: rest, dragStartStations: null }
        : state
    }),
  renameStation: (id, name) =>
    set((state) =>
      changed(
        state,
        state.stations.map((station) => (station.id === id ? { ...station, name } : station)),
      ),
    ),
  toggleStationLock: (firstId, secondId) =>
    set((state) => {
      const first = state.stations.find((station) => station.id === firstId)
      const second = state.stations.find((station) => station.id === secondId)
      if (!first || !second || !stationsConnect(first, second)) return state
      const locked = first.lockedTo.includes(secondId)
      return changed(
        state,
        state.stations.map((station) => {
          const neighborId = station.id === firstId ? secondId : station.id === secondId ? firstId : null
          if (!neighborId) return station
          return {
            ...station,
            lockedTo: locked ? station.lockedTo.filter((id) => id !== neighborId) : [...station.lockedTo, neighborId],
          }
        }),
      )
    }),
  removeStation: (id) => {
    const stations = get().stations
    const station = stations.find((candidate) => candidate.id === id)
    if (!station || station.lockedTo.length > 0 || hasLinkedNeighbor(stations, id) || hasSpanningPlacement(stations, id)) return false
    set((state) =>
      changed(
        state,
        state.stations.filter((station) => station.id !== id),
      ),
    )
    return true
  },
  cloneStation: (source) => {
    const newId = makeId()
    const routeIds = new Map<string, string>()
    const farRight = get().stations.reduce(
      (right, station) => Math.max(right, station.position.x + STATION_TYPES[station.type].footprintCells * CELL_SIZE),
      0,
    )
    set((state) =>
      changed(state, [
        ...state.stations,
        {
          ...source,
          id: newId,
          name: `${STATION_TYPES[source.type].label} ${state.stations.length + 1}`,
          position: { x: farRight + 120, y: source.position.y },
          lockedTo: [],
          // Shared pieces cannot be cloned into an isolated station without their neighboring floor.
          placements: source.placements
            .filter((piece) => canPlace({ ...source, placements: [] }, piece.type, piece.x, piece.y))
            .map((piece) => {
              if (piece.routeId && !routeIds.has(piece.routeId)) routeIds.set(piece.routeId, makeId())
              return { ...piece, id: makeId(), routeId: piece.routeId ? routeIds.get(piece.routeId) : undefined }
            }),
        },
      ]),
    )
    return newId
  },
  pastePlacements: (stationId, source) => {
    const station = get().stations.find((candidate) => candidate.id === stationId)
    if (!station || source.length === 0) return null
    const minX = Math.min(...source.map((piece) => piece.x))
    const minY = Math.min(...source.map((piece) => piece.y))
    const size = STATION_TYPES[station.type].footprintCells
    const positions: { x: number; y: number }[] = []
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) positions.push({ x, y })
    positions.sort((a, b) => {
      const distanceA = Math.abs(a.x - minX - 1) + Math.abs(a.y - minY - 1)
      const distanceB = Math.abs(b.x - minX - 1) + Math.abs(b.y - minY - 1)
      return distanceA - distanceB
    })
    const anchor = positions.find(({ x, y }) =>
      source.every((piece) => canPlaceInLayout(get().stations, stationId, piece.type, x + piece.x - minX, y + piece.y - minY)),
    )
    if (!anchor) return null
    const routeId = source[0].routeId ? makeId() : undefined
    const firstId = makeId()
    set((state) =>
      changed(
        state,
        state.stations.map((candidate) =>
          candidate.id === stationId
            ? {
                ...candidate,
                placements: [
                  ...candidate.placements,
                  ...source.map((piece, index) => ({
                    ...piece,
                    id: index === 0 ? firstId : makeId(),
                    routeId,
                    x: anchor.x + piece.x - minX,
                    y: anchor.y + piece.y - minY,
                  })),
                ],
              }
            : candidate,
        ),
      ),
    )
    return firstId
  },
  place: (stationId, type, x, y, direction) => {
    const station = get().stations.find((candidate) => candidate.id === stationId)
    if (!station) return false
    const existing = placementAt(station, x, y)
    if (existing?.type === type && PLACEABLES[type].category === 'logistics') {
      if (direction && existing.direction !== direction) {
        set((state) =>
          changed(
            state,
            state.stations.map((candidate) =>
              candidate.id === stationId
                ? {
                    ...candidate,
                    placements: candidate.placements.map((piece) =>
                      piece.id === existing.id ? { ...piece, direction, incoming: oppositeDirection(direction) } : piece,
                    ),
                  }
                : candidate,
            ),
          ),
        )
      }
      return true
    }
    if (!canPlaceInLayout(get().stations, stationId, type, x, y)) return false
    set((state) =>
      changed(
        state,
        state.stations.map((candidate) =>
          candidate.id === stationId
            ? {
                ...candidate,
                placements: [
                  ...candidate.placements,
                  {
                    id: makeId(),
                    type,
                    x,
                    y,
                    direction: direction ?? (type === 'material_lab' || type === 'computation_lab' ? 'south' : 'east'),
                    incoming: PLACEABLES[type].category === 'logistics' ? oppositeDirection(direction ?? 'east') : undefined,
                  },
                ],
              }
            : candidate,
        ),
      ),
    )
    return true
  },
  placeRoute: (stationId, type, cells, mergeRouteIds = []) => {
    const stations = get().stations
    if (!canPlaceRouteInLayout(stations, stationId, cells)) return false
    const merging = new Set(mergeRouteIds)
    const existing = stations.flatMap((station) => station.placements).filter((piece) => piece.routeId && merging.has(piece.routeId))
    if (existing.some((piece) => piece.type !== type)) return false
    const routeId = existing[0]?.routeId ?? makeId()
    set((state) =>
      changed(
        state,
        state.stations.map((candidate) => {
          const owned = cells.filter((cell) => routeCellOwner(state.stations, stationId, cell.x, cell.y)?.id === candidate.id)
          if (!owned.length && !candidate.placements.some((piece) => piece.routeId && merging.has(piece.routeId))) return candidate
          return {
            ...candidate,
            placements: [
              ...candidate.placements.map((piece) => (piece.routeId && merging.has(piece.routeId) ? { ...piece, routeId } : piece)),
              ...owned.map((cell) => ({
                id: makeId(),
                routeId,
                type,
                x: cell.x - candidate.position.x / CELL_SIZE,
                y: cell.y - candidate.position.y / CELL_SIZE,
                direction: cell.direction,
                incoming: cell.incoming,
              })),
            ],
          }
        }),
      ),
    )
    return true
  },
  movePlacement: (stationId, placementId, x, y) => {
    const stations = get().stations
    const station = stations.find((candidate) => candidate.id === stationId)
    if (!station || !canMoveInLayout(stations, stationId, placementId, x, y)) return false
    const worldX = station.position.x / CELL_SIZE + x
    const worldY = station.position.y / CELL_SIZE + y
    // Rehome a part once its origin enters another module; its world position and ID stay stable.
    const nextOwner = routeCellOwner(stations, stationId, worldX, worldY) ?? station
    set((state) =>
      changed(
        state,
        state.stations.map((candidate) => {
          if (candidate.id !== stationId && candidate.id !== nextOwner.id) return candidate
          const moving = station.placements.find((piece) => piece.id === placementId)
          if (!moving) return candidate
          const remaining = candidate.placements.filter((piece) => piece.id !== placementId)
          return candidate.id === nextOwner.id
            ? {
                ...candidate,
                placements: [
                  ...remaining,
                  { ...moving, x: worldX - nextOwner.position.x / CELL_SIZE, y: worldY - nextOwner.position.y / CELL_SIZE },
                ],
              }
            : { ...candidate, placements: remaining }
        }),
      ),
    )
    return true
  },
  moveRoute: (stationId, routeId, dx, dy) => {
    const stations = get().stations
    if (!canMoveRouteInLayout(stations, stationId, routeId, dx, dy)) return false
    const moved = worldPlacements(stations)
      .filter((piece) => piece.routeId === routeId)
      .map((piece) => ({ ...piece, x: piece.x + dx, y: piece.y + dy }))
    set((state) =>
      changed(
        state,
        state.stations.map((candidate) => ({
          ...candidate,
          placements: [
            ...candidate.placements.filter((piece) => piece.routeId !== routeId),
            ...moved
              .filter((piece) => routeCellOwner(state.stations, stationId, piece.x, piece.y)?.id === candidate.id)
              .map((piece) => ({
                id: piece.id,
                routeId,
                type: piece.type,
                x: piece.x - candidate.position.x / CELL_SIZE,
                y: piece.y - candidate.position.y / CELL_SIZE,
                direction: piece.direction,
                incoming: piece.incoming,
              })),
          ],
        })),
      ),
    )
    return true
  },
  rotateAt: (stationId, x, y) =>
    set((state) =>
      changed(
        state,
        state.stations.map((station) => {
          if (station.id !== stationId) return station
          const placed = placementAt(station, x, y)
          if (placed?.routeId) {
            return station
          }
          return placed
            ? {
                ...station,
                placements: station.placements.map((piece) =>
                  piece.id === placed.id
                    ? {
                        ...piece,
                        direction: rotateDirection(piece.direction),
                        incoming: piece.incoming ? rotateDirection(piece.incoming) : undefined,
                      }
                    : piece,
                ),
              }
            : station
        }),
      ),
    ),
  removeAt: (stationId, x, y) =>
    set((state) => {
      const owner = state.stations.find((station) => station.id === stationId)
      const placed = owner && placementAt(owner, x, y)
      if (!placed) return state
      return changed(
        state,
        state.stations.map((station) => ({
          ...station,
          placements: station.placements.filter((piece) =>
            placed.routeId ? piece.routeId !== placed.routeId : station.id !== stationId || piece.id !== placed.id,
          ),
        })),
      )
    }),
}))
