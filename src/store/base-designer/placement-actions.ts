import { placementAt } from '@/features/base-designer/lib/layout/placement'
import { CELL_SIZE, PLACEABLES, isUndergroundType } from '@/features/base-designer/model/catalog'
import { oppositeDirection, rotateDirection, rotateDisabledOutputPorts } from '@/features/base-designer/lib/connections/ports'
import { createLayoutPaste, createPlacementPaste } from '@/features/base-designer/lib/clipboard/clipboard-operations'
import { createRoutePlacement } from '@/features/base-designer/lib/routes/route-operations'
import { canMoveInLayout, canMovePlacementsInLayout, canPlaceInLayout } from '@/features/base-designer/lib/layout/placement-validation'
import { canMoveRouteInLayout } from '@/features/base-designer/lib/routes/route-validation'
import { routeCellOwner, withoutStationOwner, worldPlacements } from '@/features/base-designer/lib/layout/world-layout'
import { changed } from './history'
import type { BaseDesignerState, BaseStoreContext } from './types'

/** Commits validated placement changes through the shared transaction/history boundary. */
export function createPlacementActions({
  set,
  get,
  makeId,
}: BaseStoreContext): Pick<
  BaseDesignerState,
  | 'pasteLayout'
  | 'pastePlacements'
  | 'place'
  | 'placeRoute'
  | 'movePlacement'
  | 'moveRoute'
  | 'rotateAt'
  | 'removePlacements'
  | 'movePlacements'
> {
  return {
    pasteLayout: (proposal) => {
      const copy = createLayoutPaste({ stations: get().stations, proposal, allocateId: makeId })
      if (!copy) return null
      set((state) => changed(state, [...state.stations, ...copy.stations], [...state.notes, ...copy.notes]))
      return copy.ids
    },
    pastePlacements: (stationId, source, worldCursor) => {
      const proposal = createPlacementPaste({ stations: get().stations, stationId, source, worldCursor, allocateId: makeId })
      if (!proposal) return null
      set((state) => changed(state, proposal.stations))
      return proposal.firstId
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
      // Read the committed layout at release; preview validity cannot authorize a transaction.
      const proposal = createRoutePlacement({
        stations: get().stations,
        stationId,
        type,
        cells,
        allocateId: makeId,
        mergeRouteIds,
        junction,
      })
      if (!proposal) return false
      set((state) => changed(state, proposal))
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
    removePlacements: (ids) =>
      set((state) => {
        const selected = new Set(ids)
        if (selected.size === 0) return state
        const matched = state.stations.flatMap((station) => station.placements.filter((piece) => selected.has(piece.id)))
        if (!matched.length) return state
        const routes = new Set(matched.flatMap((piece) => (piece.routeId ? [piece.routeId] : [])))
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
  }
}
