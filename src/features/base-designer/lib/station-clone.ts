import { canPlace, type BasePlacement, type BaseStation } from './placement'

export interface StationCloneContents {
  placements: BasePlacement[]
  skippedRoutes: number
  skippedParts: number
}

/** Capture routes that extend beyond the copied station before the clipboard outlives the current layout. */
export function externalStationRouteIds(stations: readonly BaseStation[], sourceId: string): string[] {
  const source = stations.find((station) => station.id === sourceId)
  if (!source) return []
  const localRouteIds = new Set(source.placements.flatMap((piece) => (piece.routeId ? [piece.routeId] : [])))
  return [
    ...new Set(
      stations
        .filter((station) => station.id !== sourceId)
        .flatMap((station) =>
          station.placements.flatMap((piece) => (piece.routeId && localRouteIds.has(piece.routeId) ? [piece.routeId] : [])),
        ),
    ),
  ]
}

/** Cloning a single station never retains only part of a route, including cells owned in a shared corridor. */
export function stationCloneContents(source: BaseStation, externalRouteIds: readonly string[]): StationCloneContents {
  const empty = { ...source, placements: [] }
  const external = new Set(externalRouteIds)
  const routes = new Map<string, BasePlacement[]>()

  for (const piece of source.placements) {
    if (piece.routeId) {
      const route = routes.get(piece.routeId) ?? []
      route.push(piece)
      routes.set(piece.routeId, route)
    }
  }

  const rejectedRoutes = new Set(
    [...routes]
      .filter(([routeId, route]) => external.has(routeId) || route.some((piece) => !canPlace(empty, piece.type, piece.x, piece.y)))
      .map(([id]) => id),
  )
  const placements = source.placements.filter((piece) =>
    piece.routeId ? !rejectedRoutes.has(piece.routeId) : canPlace(empty, piece.type, piece.x, piece.y),
  )
  const skippedParts = source.placements.filter((piece) => !piece.routeId && !canPlace(empty, piece.type, piece.x, piece.y)).length

  return { placements, skippedRoutes: rejectedRoutes.size, skippedParts }
}
