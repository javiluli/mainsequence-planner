import { placementAt, type BasePlacement, type BaseStation } from '@/features/base-designer/lib/placement'
import {
  machinePortKey,
  machinePorts,
  oppositeDirection,
  rotateDirection,
  rotateDisabledOutputPorts,
} from '@/features/base-designer/lib/ports'
import { recipeForPlaceable } from '@/features/base-designer/lib/machine-recipes'
import { beltIncoming } from '@/features/base-designer/lib/connections'
import type { BeltJunction, RouteCell } from '@/features/base-designer/lib/route'
import { canCrossStationBoundary, connectedCorridors, stationOverlap, stationsConnect } from '@/features/base-designer/lib/stations'
import {
  canMoveInLayout,
  canMovePlacementsInLayout,
  canMoveRouteInLayout,
  canPlaceInLayout,
  canPlaceRouteInLayout,
  hasLinkedNeighbor,
  hasSpanningPlacement,
  linkedStationIds,
  pastePlacementOwners,
  routeCellOwner,
  withoutStationOwner,
  worldPlacements,
} from '@/features/base-designer/lib/world-layout'
import {
  CELL_SIZE,
  PLACEABLES,
  STATION_TYPES,
  isConveyorType,
  isUndergroundType,
  type Direction,
  type PlaceableType,
  type RouteTool,
  type StationType,
} from '@/features/base-designer/model/catalog'
import { isUndergroundPath } from '@/features/base-designer/lib/underground'
import { stationCloneContents } from '@/features/base-designer/lib/station-clone'
import { clipboardPlacementsAt } from '@/features/base-designer/lib/clipboard'
import { create } from 'zustand'
import { itemById } from '@/shared/data'

interface BaseDesignerState {
  stations: BaseStation[]
  notes: BaseNote[]
  past: BaseDesignerSnapshot[]
  future: BaseDesignerSnapshot[]
  dragStartStations: BaseStation[] | null
  dragStartNotes: BaseNote[] | null
  addNote: (position: { x: number; y: number }) => string
  cloneNote: (source: BaseNote) => string
  updateNote: (id: string, text: string) => void
  moveNote: (id: string, position: { x: number; y: number }) => void
  beginMoveNote: () => void
  endMoveNote: () => void
  removeNote: (id: string) => void
  addStation: (type: StationType) => void
  beginMoveStation: () => void
  moveStation: (id: string, position: { x: number; y: number }) => void
  endMoveStation: () => void
  cancelMove: () => void
  undo: () => void
  redo: () => void
  assignRecipe: (stationId: string, placementId: string, recipeId: string | null) => boolean
  setMachineInputItem: (stationId: string, placementId: string, itemId: string | null) => boolean
  toggleMachineOutput: (stationId: string, placementId: string, face: Direction, offset: number) => boolean
  setDroneOutput: (stationId: string, slot: 0 | 1, itemId: string | null) => boolean
  toggleStationLock: (firstId: string, secondId: string) => void
  removeStation: (id: string) => boolean
  cloneStation: (source: BaseStation, externalRouteIds: readonly string[]) => { id: string; skippedRoutes: number; skippedParts: number }
  pastePlacements: (stationId: string, source: readonly BasePlacement[], worldCursor: { x: number; y: number }) => string | null
  place: (stationId: string, type: PlaceableType, x: number, y: number, direction?: Direction) => boolean
  placeRoute: (
    stationId: string,
    type: RouteTool,
    cells: readonly RouteCell[],
    mergeRouteIds?: readonly string[],
    junction?: BeltJunction,
  ) => boolean
  movePlacement: (stationId: string, placementId: string, x: number, y: number) => boolean
  moveRoute: (stationId: string, routeId: string, dx: number, dy: number) => boolean
  rotateAt: (stationId: string, x: number, y: number) => void
  removeAt: (stationId: string, x: number, y: number) => void
  removePlacements: (ids: readonly string[]) => void
  movePlacements: (ids: readonly string[], dx: number, dy: number) => boolean
}

let nextId = 1
const makeId = () => `base-part-${nextId++}`
const historyLimit = 50

export interface BaseNote {
  id: string
  position: { x: number; y: number }
  text: string
}

interface BaseDesignerSnapshot {
  stations: BaseStation[]
  notes: BaseNote[]
}

function changed(state: BaseDesignerState, stations: BaseStation[], notes = state.notes): Partial<BaseDesignerState> {
  return {
    stations,
    notes,
    past: [...state.past, { stations: state.dragStartStations ?? state.stations, notes: state.dragStartNotes ?? state.notes }].slice(
      -historyLimit,
    ),
    future: [],
    dragStartStations: null,
    dragStartNotes: null,
  }
}

/** A rejected move or a round trip must not consume undo history. */
function samePositions<T extends { id: string; position: { x: number; y: number } }>(before: readonly T[], after: readonly T[]): boolean {
  return (
    before === after ||
    (before.length === after.length &&
      before.every((entry, index) => {
        const current = after[index]
        return entry.id === current.id && entry.position.x === current.position.x && entry.position.y === current.position.y
      }))
  )
}

/** Estado de sesión deliberado: al recargar se empieza de nuevo, sin escribir en localStorage. */
export const useBaseDesignerStore = create<BaseDesignerState>((set, get) => ({
  stations: [],
  notes: [],
  past: [],
  future: [],
  dragStartStations: null,
  dragStartNotes: null,
  addNote: (position) => {
    const id = makeId()
    set((state) => changed(state, state.stations, [...state.notes, { id, position, text: '' }]))
    return id
  },
  cloneNote: (source) => {
    const id = makeId()
    set((state) =>
      changed(state, state.stations, [
        ...state.notes,
        { ...source, id, position: { x: source.position.x + 40, y: source.position.y + 40 } },
      ]),
    )
    return id
  },
  updateNote: (id, text) =>
    set((state) => {
      const note = state.notes.find((entry) => entry.id === id)
      return !note || note.text === text
        ? state
        : changed(
            state,
            state.stations,
            state.notes.map((entry) => (entry.id === id ? { ...entry, text } : entry)),
          )
    }),
  moveNote: (id, position) =>
    set((state) => {
      const note = state.notes.find((entry) => entry.id === id)
      return !note || (note.position.x === position.x && note.position.y === position.y)
        ? state
        : { notes: state.notes.map((entry) => (entry.id === id ? { ...entry, position } : entry)) }
    }),
  beginMoveNote: () => set((state) => ({ dragStartNotes: state.notes })),
  endMoveNote: () =>
    set((state) =>
      state.dragStartNotes && !samePositions(state.dragStartNotes, state.notes)
        ? {
            past: [...state.past, { stations: state.stations, notes: state.dragStartNotes }].slice(-historyLimit),
            future: [],
            dragStartNotes: null,
          }
        : { dragStartNotes: null },
    ),
  removeNote: (id) =>
    set((state) =>
      state.notes.some((note) => note.id === id)
        ? changed(
            state,
            state.stations,
            state.notes.filter((note) => note.id !== id),
          )
        : state,
    ),
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
          droneOutputs: type === 'drone_station' ? [null, null] : undefined,
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
      state.dragStartStations && !samePositions(state.dragStartStations, state.stations)
        ? {
            past: [...state.past, { stations: state.dragStartStations, notes: state.notes }].slice(-historyLimit),
            future: [],
            dragStartStations: null,
          }
        : { dragStartStations: null },
    ),
  cancelMove: () =>
    set((state) =>
      state.dragStartStations || state.dragStartNotes
        ? {
            stations: state.dragStartStations ?? state.stations,
            notes: state.dragStartNotes ?? state.notes,
            dragStartStations: null,
            dragStartNotes: null,
          }
        : state,
    ),
  undo: () =>
    set((state) => {
      const previous = state.past.at(-1)
      return previous
        ? {
            ...previous,
            past: state.past.slice(0, -1),
            future: [{ stations: state.stations, notes: state.notes }, ...state.future],
            dragStartStations: null,
            dragStartNotes: null,
          }
        : state
    }),
  redo: () =>
    set((state) => {
      const [next, ...rest] = state.future
      return next
        ? {
            ...next,
            past: [...state.past, { stations: state.stations, notes: state.notes }].slice(-historyLimit),
            future: rest,
            dragStartStations: null,
            dragStartNotes: null,
          }
        : state
    }),
  assignRecipe: (stationId, placementId, recipeId) => {
    const station = get().stations.find((candidate) => candidate.id === stationId)
    const piece = station?.placements.find((placement) => placement.id === placementId)
    if (!piece || PLACEABLES[piece.type].category !== 'machine') return false
    if (recipeId !== null && !recipeForPlaceable(piece.type, recipeId)) return false
    if (piece.recipeId === (recipeId ?? undefined)) return true
    set((state) =>
      changed(
        state,
        state.stations.map((candidate) =>
          candidate.id === stationId
            ? {
                ...candidate,
                placements: candidate.placements.map((placement) =>
                  placement.id === placementId
                    ? {
                        ...placement,
                        recipeId: recipeId ?? undefined,
                        inputItemId:
                          recipeId &&
                          recipeForPlaceable(placement.type, recipeId)?.inputs.some((input) => input.id === placement.inputItemId)
                            ? placement.inputItemId
                            : undefined,
                      }
                    : placement,
                ),
              }
            : candidate,
        ),
      ),
    )
    return true
  },
  setMachineInputItem: (stationId, placementId, itemId) => {
    const piece = get()
      .stations.find((station) => station.id === stationId)
      ?.placements.find((placement) => placement.id === placementId)
    if (!piece || PLACEABLES[piece.type].category !== 'machine') return false
    const recipe = recipeForPlaceable(piece.type, piece.recipeId)
    if (itemId !== null && !recipe?.inputs.some((input) => input.id === itemId)) return false
    if (piece.inputItemId === (itemId ?? undefined)) return true
    set((state) =>
      changed(
        state,
        state.stations.map((station) =>
          station.id === stationId
            ? {
                ...station,
                placements: station.placements.map((placement) =>
                  placement.id === placementId ? { ...placement, inputItemId: itemId ?? undefined } : placement,
                ),
              }
            : station,
        ),
      ),
    )
    return true
  },
  toggleMachineOutput: (stationId, placementId, face, offset) => {
    const piece = get()
      .stations.find((station) => station.id === stationId)
      ?.placements.find((placement) => placement.id === placementId)
    if (!piece || !machinePorts(piece).some((port) => port.face === face && port.offset === offset)) return false
    const key = machinePortKey({ face, offset })
    set((state) =>
      changed(
        state,
        state.stations.map((station) =>
          station.id === stationId
            ? {
                ...station,
                placements: station.placements.map((placement) =>
                  placement.id === placementId
                    ? {
                        ...placement,
                        disabledOutputPorts: placement.disabledOutputPorts?.includes(key)
                          ? placement.disabledOutputPorts.filter((entry) => entry !== key)
                          : [...(placement.disabledOutputPorts ?? []), key],
                      }
                    : placement,
                ),
              }
            : station,
        ),
      ),
    )
    return true
  },
  setDroneOutput: (stationId, slot, itemId) => {
    const station = get().stations.find((candidate) => candidate.id === stationId)
    if (station?.type !== 'drone_station' || (itemId !== null && !itemById.has(itemId))) return false
    const outputs = station.droneOutputs ?? [null, null]
    if (outputs[slot] === itemId) return true
    set((state) =>
      changed(
        state,
        state.stations.map((candidate) =>
          candidate.id === stationId ? { ...candidate, droneOutputs: slot === 0 ? [itemId, outputs[1]] : [outputs[0], itemId] } : candidate,
        ),
      ),
    )
    return true
  },
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
  cloneStation: (source, externalRouteIds) => {
    const newId = makeId()
    const routeIds = new Map<string, string>()
    const contents = stationCloneContents(source, externalRouteIds)
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
          placements: contents.placements.map((piece) => {
            if (piece.routeId && !routeIds.has(piece.routeId)) routeIds.set(piece.routeId, makeId())
            return { ...piece, id: makeId(), routeId: piece.routeId ? routeIds.get(piece.routeId) : undefined }
          }),
        },
      ]),
    )
    return { id: newId, skippedRoutes: contents.skippedRoutes, skippedParts: contents.skippedParts }
  },
  pastePlacements: (stationId, source, worldCursor) => {
    const stations = get().stations
    const worldPieces = clipboardPlacementsAt(source, worldCursor)
    const owners = pastePlacementOwners(stations, stationId, worldPieces)
    if (!owners) return null
    const routeIds = new Map<string, string>()
    const firstId = makeId()
    const planned = worldPieces.map((piece, index) => {
      if (piece.routeId && !routeIds.has(piece.routeId)) routeIds.set(piece.routeId, makeId())
      return {
        ...piece,
        id: index === 0 ? firstId : makeId(),
        routeId: piece.routeId ? routeIds.get(piece.routeId) : undefined,
      }
    })
    set((state) =>
      changed(
        state,
        state.stations.map((owner) => {
          const copies = planned.flatMap((piece, index) =>
            owners[index].id === owner.id
              ? [{ ...piece, x: piece.x - owner.position.x / CELL_SIZE, y: piece.y - owner.position.y / CELL_SIZE }]
              : [],
          )
          return copies.length ? { ...owner, placements: [...owner.placements, ...copies] } : owner
        }),
      ),
    )
    return firstId
  },
  place: (stationId, type, x, y, direction) => {
    if (isUndergroundType(type)) return false
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
  placeRoute: (stationId, type, cells, mergeRouteIds = [], junction) => {
    const stations = get().stations
    if (isUndergroundType(type) && (mergeRouteIds.length > 0 || junction || !isUndergroundPath(type, cells, true))) return false
    if (!canPlaceRouteInLayout(stations, stationId, cells, new Set(), type)) return false
    const merging = new Set(mergeRouteIds)
    if (junction) {
      if (!isConveyorType(type)) return false
      const target = worldPlacements(stations).find((piece) => piece.id === junction.targetId)
      const last = cells.at(-1)
      if (!target || !target.routeId || target.type !== type || !last) return false
      if (merging.has(target.routeId)) return false
      const incoming = beltIncoming(target)
      if (
        incoming !== oppositeDirection(target.direction) ||
        junction.face === incoming ||
        junction.face === target.direction ||
        target.extraIncoming?.includes(junction.face)
      )
        return false
      const step: Record<Direction, readonly [number, number]> = {
        north: [0, -1],
        east: [1, 0],
        south: [0, 1],
        west: [-1, 0],
      }
      const [dx, dy] = step[junction.face]
      if (
        last.x !== target.x + dx ||
        last.y !== target.y + dy ||
        last.direction !== oppositeDirection(junction.face) ||
        !canCrossStationBoundary(stations, last, target, connectedCorridors(stations))
      )
        return false
      merging.add(target.routeId)
    }
    const existing = stations.flatMap((station) => station.placements).filter((piece) => piece.routeId && merging.has(piece.routeId))
    if (existing.some((piece) => piece.type !== type)) return false
    const routeId = existing[0]?.routeId ?? makeId()
    set((state) =>
      changed(
        state,
        state.stations.map((candidate) => {
          const owned = cells
            .map((cell, index) => ({
              ...cell,
              routeIndex: index,
              buried: isUndergroundType(type) && index > 0 && index < cells.length - 1,
            }))
            .filter((cell) => routeCellOwner(state.stations, stationId, cell.x, cell.y)?.id === candidate.id)
          if (!owned.length && !candidate.placements.some((piece) => piece.routeId && merging.has(piece.routeId))) return candidate
          return {
            ...candidate,
            placements: [
              ...candidate.placements.map((piece) =>
                piece.routeId && merging.has(piece.routeId)
                  ? {
                      ...piece,
                      routeId,
                      extraIncoming:
                        junction && piece.id === junction.targetId ? [...(piece.extraIncoming ?? []), junction.face] : piece.extraIncoming,
                    }
                  : piece,
              ),
              ...owned.map((cell) => ({
                id: makeId(),
                routeId,
                type,
                x: cell.x - candidate.position.x / CELL_SIZE,
                y: cell.y - candidate.position.y / CELL_SIZE,
                direction: cell.direction,
                incoming: cell.incoming,
                buried: cell.buried,
                routeIndex: cell.routeIndex,
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
                extraIncoming: piece.extraIncoming,
                buried: piece.buried,
                routeIndex: piece.routeIndex,
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
                        disabledOutputPorts: rotateDisabledOutputPorts(piece),
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
  removePlacements: (ids) =>
    set((state) => {
      const selected = new Set(ids)
      const routes = new Set(
        state.stations.flatMap((station) =>
          station.placements.flatMap((piece) => (selected.has(piece.id) && piece.routeId ? [piece.routeId] : [])),
        ),
      )
      if (selected.size === 0) return state
      return changed(
        state,
        state.stations.map((station) => ({
          ...station,
          placements: station.placements.filter((piece) => !selected.has(piece.id) && (!piece.routeId || !routes.has(piece.routeId))),
        })),
      )
    }),
  movePlacements: (ids, dx, dy) => {
    const stations = get().stations
    const selectedIds = new Set(ids)
    const selected = worldPlacements(stations).filter((piece) => selectedIds.has(piece.id))
    if (!canMovePlacementsInLayout(stations, ids, dx, dy)) return false
    const moved = selected.map((piece) => ({ ...piece, x: piece.x + dx, y: piece.y + dy }))
    set((state) =>
      changed(
        state,
        state.stations.map((station) => ({
          ...station,
          placements: [
            ...station.placements.filter((piece) => !selectedIds.has(piece.id)),
            ...moved
              .filter((piece) => routeCellOwner(state.stations, piece.stationId, piece.x, piece.y)?.id === station.id)
              .map((piece) => ({
                ...withoutStationOwner(piece),
                x: piece.x - station.position.x / CELL_SIZE,
                y: piece.y - station.position.y / CELL_SIZE,
              })),
          ],
        })),
      ),
    )
    return true
  },
}))
