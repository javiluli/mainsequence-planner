import { BUILDINGS, nextRotation } from '../model/buildings'
import { stationSize, type Point, type Scene } from '../model/scene'

/** Logical bounds in grid cells, including complete routes and tunnel mouths; an empty scene has no bounds.
 * Decorative sockets never change the anchor used by clipboard, selection and camera framing.
 */
export function groupBounds(scene: Scene) {
  let left = Infinity,
    top = Infinity,
    right = -Infinity,
    bottom = -Infinity
  const include = (point: Point, size = 1) => {
    left = Math.min(left, point.x)
    top = Math.min(top, point.y)
    right = Math.max(right, point.x + size)
    bottom = Math.max(bottom, point.y + size)
  }
  scene.stations.forEach((station) => include(station, stationSize(station)))
  scene.buildings.forEach((building) => include(building, BUILDINGS[building.type].size))
  scene.belts.forEach((belt) => belt.points.forEach((point) => include(point)))
  scene.splitters?.forEach((splitter) => include(splitter))
  scene.tunnels?.forEach((tunnel) => {
    include(tunnel.entry)
    include(tunnel.exit)
  })
  return Number.isFinite(left) ? { x: left, y: top, width: right - left, height: bottom - top } : null
}

/** Translate by grid-cell offsets, copying geometry/cargo but retaining IDs and station ownership.
 * Callers validate the final layout and rebind ownership; immutable permissions stay shared until store confirmation.
 */
export function translateGroup(scene: Scene, offset: Point): Required<Scene> {
  const shift = (point: Point) => ({ x: point.x + offset.x, y: point.y + offset.y })
  return {
    stations: scene.stations.map((station) => ({
      ...station,
      ...shift(station),
      ...(station.type === 'drone' ? { cargo: [...station.cargo] as const } : {}),
    })),
    buildings: scene.buildings.map((building) => ({ ...building, ...shift(building) })),
    belts: scene.belts.map((belt) => ({
      ...belt,
      points: belt.points.map(shift),
      ...(belt.heading ? { heading: { ...belt.heading } } : {}),
    })),
    splitters: (scene.splitters ?? []).map((splitter) => ({ ...splitter, ...shift(splitter) })),
    tunnels: (scene.tunnels ?? []).map((tunnel) => ({ ...tunnel, entry: shift(tunnel.entry), exit: shift(tunnel.exit) })),
  }
}

/** Keep the bounds center when grid-compatible; otherwise offset Y by half a cell so quarter-turns preserve whole cells.
 * Callers retain this pivot for successive turns instead of recomputing it from each intermediate shape.
 */
export function selectionPivot(scene: Scene): Point {
  const bounds = groupBounds(scene)
  if (!bounds) return { x: 0, y: 0 }
  const x = bounds.x + bounds.width / 2,
    y = bounds.y + bounds.height / 2
  return { x, y: y + (Number.isInteger(x - y) ? 0 : 0.5) }
}

/** Rotate logical square footprints and complete ordered routes clockwise, preserving IDs and station ownership.
 * Four turns about the same pivot are exact; callers validate placement and rebind ownership after transforming.
 */
export function rotateGroup(scene: Scene, pivot = selectionPivot(scene)): Required<Scene> {
  const turn = (point: Point, size = 1) => ({ x: pivot.x + pivot.y - point.y - size, y: pivot.y - pivot.x + point.x })
  return {
    stations: scene.stations.map((station) => ({
      ...station,
      ...turn(station, stationSize(station)),
      ...(station.type === 'drone' ? { rotation: nextRotation(station.rotation) } : {}),
    })),
    buildings: scene.buildings.map((building) => ({
      ...building,
      ...turn(building, BUILDINGS[building.type].size),
      rotation: nextRotation(building.rotation),
    })),
    belts: scene.belts.map((belt) => ({
      ...belt,
      points: belt.points.map((point) => turn(point)),
      ...(belt.heading ? { heading: { x: -belt.heading.y, y: belt.heading.x } } : {}),
    })),
    splitters: (scene.splitters ?? []).map((splitter) => ({ ...splitter, ...turn(splitter), rotation: nextRotation(splitter.rotation) })),
    tunnels: (scene.tunnels ?? []).map((tunnel) => ({ ...tunnel, entry: turn(tunnel.entry), exit: turn(tunnel.exit) })),
  }
}
