import type { BaseStation } from '@/features/base-designer/lib/layout/placement'
import { CELL_SIZE, STATION_TYPES } from '@/features/base-designer/model/catalog'
import { canPlaceStation, stationsConnect } from '@/features/base-designer/lib/layout/stations'
import { hasLinkedNeighbor, withoutStationOwner, worldPlacements } from '@/features/base-designer/lib/layout/world-layout'
import { rotateDirection } from '@/features/base-designer/lib/connections/ports'
import { canPasteLayout } from '@/features/base-designer/lib/clipboard/clipboard'
import { transformedPlacementOwners } from '@/features/base-designer/lib/layout/layout-transform'
import { stationRemovalCheck } from '@/features/base-designer/lib/layout/removal'
import { historyLimit } from './history'
import { changed } from './history'
import type { BaseDesignerState, BaseStoreContext } from './types'

/** Commits validated layout changes through the shared transaction/history boundary. */
export function createLayoutActions({
  set,
  get,
  makeId,
}: BaseStoreContext): Pick<
  BaseDesignerState,
  | 'addNote'
  | 'updateNote'
  | 'removeNote'
  | 'addStation'
  | 'rotateStation'
  | 'commitLayoutMove'
  | 'transformPlacements'
  | 'undo'
  | 'redo'
  | 'toggleStationLock'
  | 'removeStation'
> {
  return {
    addNote: (position) => {
      const id = makeId()
      set((state) => changed(state, state.stations, [...state.notes, { id, position, text: '' }]))
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
    addStation: (type, position, direction = 'south') => {
      const state = get()
      const candidate: BaseStation = {
        id: '',
        type,
        name: `${STATION_TYPES[type].label} ${state.stations.length + 1}`,
        position,
        direction,
        lockedTo: [],
        droneOutputs: type === 'drone_station' ? [null, null] : undefined,
        placements: [],
      }
      if (!canPlaceStation(state.stations, candidate)) return null
      const id = makeId()
      set(changed(state, [...state.stations, { ...candidate, id }]))
      return id
    },
    rotateStation: (id) => {
      const state = get()
      const station = state.stations.find((candidate) => candidate.id === id)
      if (
        !station ||
        station.type !== 'drone_station' ||
        hasLinkedNeighbor(state.stations, id) ||
        station.lockedTo.length ||
        state.stations.some((candidate) => candidate.lockedTo.includes(id))
      )
        return false
      set(
        changed(
          state,
          state.stations.map((candidate) =>
            candidate.id === id ? { ...candidate, direction: rotateDirection(candidate.direction ?? 'south') } : candidate,
          ),
        ),
      )
      return true
    },
    commitLayoutMove: (stations, notes) => {
      const state = get()
      if (
        stations.length !== state.stations.length ||
        notes.length !== state.notes.length ||
        stations.some((station, index) => station.id !== state.stations[index].id) ||
        notes.some((note, index) => note.id !== state.notes[index].id) ||
        !canPasteLayout([], { stations, notes, skippedParts: 0, skippedRoutes: 0 })
      )
        return false
      if (JSON.stringify({ stations, notes }) === JSON.stringify({ stations: state.stations, notes: state.notes })) return true
      set(changed(state, stations, notes))
      return true
    },
    transformPlacements: (proposal) => {
      const state = get()
      const owners = transformedPlacementOwners(state.stations, proposal)
      if (!owners || owners.length !== proposal.length) return false
      const ids = new Set(proposal.map((piece) => piece.id))
      const originals = worldPlacements(state.stations).filter((piece) => ids.has(piece.id))
      if (
        proposal.every((piece) => {
          const before = originals.find((source) => source.id === piece.id)
          return before && JSON.stringify({ ...before, stationId: undefined }) === JSON.stringify({ ...piece, stationId: undefined })
        })
      )
        return true
      set(
        changed(
          state,
          state.stations.map((station) => ({
            ...station,
            placements: [
              ...station.placements.filter((piece) => !ids.has(piece.id)),
              ...proposal.flatMap((piece, index) =>
                owners[index].id === station.id
                  ? [
                      {
                        ...withoutStationOwner({ ...piece, stationId: owners[index].id }),
                        x: piece.x - station.position.x / CELL_SIZE,
                        y: piece.y - station.position.y / CELL_SIZE,
                      },
                    ]
                  : [],
              ),
            ],
          })),
        ),
      )
      return true
    },
    undo: () =>
      set((state) => {
        const previous = state.past.at(-1)
        return previous
          ? {
              ...previous,
              past: state.past.slice(0, -1),
              future: [{ stations: state.stations, notes: state.notes }, ...state.future],
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
            }
          : state
      }),
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
      if (!stationRemovalCheck(stations, id).allowed) return false
      set((state) =>
        changed(
          state,
          state.stations.filter((station) => station.id !== id),
        ),
      )
      return true
    },
  }
}
