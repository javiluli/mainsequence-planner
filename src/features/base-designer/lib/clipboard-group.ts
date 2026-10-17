import { STATIONS, type Point, type Scene, type Selection } from '../model/scene'
import { scenePlacementIssue, stationAt } from './placement'
import { isDroneCargo } from './stations'
import { selectionScene } from './selection'
import { groupBounds, translateGroup } from './scene-geometry'

/** Capture explicit targets only, including occupied floors. Source IDs are snapshot keys, never IDs assigned to pasted objects. */
export function captureGroupClipboard(scene: Scene, selection: readonly Selection[]) {
  const selected = selectionScene(scene, selection)
  if (!selected) return null
  const bounds = groupBounds(selected)
  return bounds ? { kind: 'group' as const, scene: translateGroup(selected, { x: -bounds.x, y: -bounds.y }) } : null
}

/** Validate the final layout with temporary ownership keys; ghost, click and store share the result before allocating real IDs. */
export function checkGroupPlacement(scene: Scene, group: Scene, point: Point): { additions: Required<Scene> | null; issue: string | null } {
  if (!groupBounds(group) || !Number.isSafeInteger(point.x) || !Number.isSafeInteger(point.y))
    return { additions: null, issue: 'Place a non-empty selection on the grid.' }
  const moved = translateGroup(group, point)
  if (moved.belts.some((belt) => belt.points.length < 2 && !belt.heading))
    return { additions: null, issue: 'A one-cell belt needs its direction.' }
  const currentIds = [...scene.stations, ...scene.buildings, ...scene.belts, ...(scene.splitters ?? []), ...(scene.tunnels ?? [])].map(
    (item) => item.id,
  )
  let prefix = 'clipboard:'
  while (currentIds.some((id) => id.startsWith(prefix))) prefix += ':'
  const stations = moved.stations.map((station, index) => ({ ...station, id: `${prefix}station:${index}` }))
  if (
    stations.some((station) =>
      station.type === 'drone'
        ? ![0, 90, 180, 270].includes(station.rotation) || !isDroneCargo(station.cargo)
        : station.type !== undefined && !Object.hasOwn(STATIONS, station.type),
    )
  )
    return { additions: null, issue: 'The copied station configuration is invalid.' }
  const floors = { ...scene, stations: [...scene.stations, ...stations] }
  const additions: Required<Scene> = {
    stations,
    buildings: moved.buildings.map((building, index) => ({
      ...building,
      id: `${prefix}building:${index}`,
      stationId: stationAt(floors, building)?.id ?? '',
    })),
    belts: moved.belts.map((belt, index) => ({ ...belt, id: `${prefix}belt:${index}` })),
    splitters: moved.splitters.map((splitter, index) => ({ ...splitter, id: `${prefix}splitter:${index}` })),
    tunnels: moved.tunnels.map((tunnel, index) => ({ ...tunnel, id: `${prefix}tunnel:${index}` })),
  }
  const combined: Required<Scene> = {
    stations: floors.stations,
    buildings: [...scene.buildings, ...additions.buildings],
    belts: [...scene.belts, ...additions.belts],
    splitters: [...(scene.splitters ?? []), ...additions.splitters],
    tunnels: [...(scene.tunnels ?? []), ...additions.tunnels],
  }
  const issue = scenePlacementIssue(combined)
  return { additions: issue ? null : additions, issue }
}
