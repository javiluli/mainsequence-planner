import { BUILDINGS } from '../model/buildings'
import { CELL_SIZE, stationSize, type Point, type Scene, type Selection } from '../model/scene'
import { canPlaceScenePieces } from './placement'

/** Session selection follows explicit IDs; removed objects never remain actionable. */
export function selectionExists(scene: Scene, item: Selection): boolean {
  const collection =
    item.kind === 'station'
      ? scene.stations
      : item.kind === 'building'
        ? scene.buildings
        : item.kind === 'belt'
          ? scene.belts
          : item.kind === 'splitter'
            ? scene.splitters
            : scene.tunnels
  return collection?.some((element) => element.id === item.id) ?? false
}

/** Capture only explicit, current targets; floors never implicitly include their contents. */
export function selectionScene(scene: Scene, selection: readonly Selection[]): Scene | null {
  if (!selection.length || selection.some((item) => !selectionExists(scene, item))) return null
  const ids = new Set(selection.map((item) => item.id))
  return {
    stations: scene.stations.filter((item) => ids.has(item.id)),
    buildings: scene.buildings.filter((item) => ids.has(item.id)),
    belts: scene.belts.filter((item) => ids.has(item.id)),
    splitters: scene.splitters?.filter((item) => ids.has(item.id)),
    tunnels: scene.tunnels?.filter((item) => ids.has(item.id)),
  }
}

/** Keyboard select-all follows the same station exclusion as rectangle selection. */
export function allSelections(scene: Scene, piecesOnly = false): Selection[] {
  return [
    ...(!piecesOnly ? scene.stations.map(({ id }) => ({ kind: 'station' as const, id })) : []),
    ...scene.buildings.map(({ id }) => ({ kind: 'building' as const, id })),
    ...scene.belts.map(({ id }) => ({ kind: 'belt' as const, id })),
    ...(scene.splitters ?? []).map(({ id }) => ({ kind: 'splitter' as const, id })),
    ...(scene.tunnels ?? []).map(({ id }) => ({ kind: 'tunnel' as const, id })),
  ]
}

/** Remove explicit complete objects only; reject the entire proposal if any surviving piece loses its floor or corridor support. */
export function proposeSelectionRemoval(scene: Scene, selection: readonly Selection[]): Scene | null {
  if (!selection.length || selection.some((item) => !selectionExists(scene, item))) return null
  const ids = new Set(selection.map((item) => item.id))
  // Preserve unaffected collections for shared history snapshots and derived geometry.
  const retain = <T extends { id: string }>(items: readonly T[]) => {
    const remaining = items.filter((item) => !ids.has(item.id))
    return remaining.length === items.length ? items : remaining
  }
  const remaining: Scene = {
    stations: retain(scene.stations),
    buildings: retain(scene.buildings),
    belts: retain(scene.belts),
    splitters: scene.splitters && retain(scene.splitters),
    tunnels: scene.tunnels && retain(scene.tunnels),
  }
  // Removing pieces only releases occupancy. Removing floors can invalidate any complete surface or buried route.
  return selection.some((item) => item.kind === 'station') && !canPlaceScenePieces(remaining) ? null : remaining
}

/** Normal clicks replace; modifier clicks toggle. The pieces filter excludes both ordinary and drone stations. */
export function selectElement(
  current: readonly Selection[],
  item: Selection | null,
  additive = false,
  piecesOnly = false,
): readonly Selection[] {
  const eligible = item && (!piecesOnly || item.kind !== 'station') ? item : null
  if (!additive) return eligible ? [eligible] : []
  const previous = piecesOnly ? current.filter((target) => target.kind !== 'station') : current
  if (!eligible) return previous
  return previous.some((target) => target.id === eligible.id)
    ? previous.filter((target) => target.id !== eligible.id)
    : [...previous, eligible]
}

/** Touching logical footprints selects whole objects. Belt segments are tested separately, avoiding empty space inside an L-shaped route. */
export function selectInRectangle(scene: Scene, from: Point, to: Point, piecesOnly: boolean): Selection[] {
  const left = Math.min(from.x, to.x) / CELL_SIZE,
    right = Math.max(from.x, to.x) / CELL_SIZE,
    top = Math.min(from.y, to.y) / CELL_SIZE,
    bottom = Math.max(from.y, to.y) / CELL_SIZE
  const touches = (point: Point, width: number, height = width) =>
    point.x <= right && point.x + width >= left && point.y <= bottom && point.y + height >= top
  const result: Selection[] = []
  if (!piecesOnly)
    for (const station of scene.stations) if (touches(station, stationSize(station))) result.push({ kind: 'station', id: station.id })
  for (const building of scene.buildings)
    if (touches(building, BUILDINGS[building.type].size)) result.push({ kind: 'building', id: building.id })
  for (const belt of scene.belts) {
    const hit = belt.points.some((point, index) => {
      const previous = belt.points[index - 1] ?? point
      return touches(
        { x: Math.min(point.x, previous.x), y: Math.min(point.y, previous.y) },
        Math.abs(point.x - previous.x) + 1,
        Math.abs(point.y - previous.y) + 1,
      )
    })
    if (hit) result.push({ kind: 'belt', id: belt.id })
  }
  for (const splitter of scene.splitters ?? []) if (touches(splitter, 1)) result.push({ kind: 'splitter', id: splitter.id })
  for (const tunnel of scene.tunnels ?? [])
    if (touches(tunnel.entry, 1) || touches(tunnel.exit, 1)) result.push({ kind: 'tunnel', id: tunnel.id })
  return result
}
