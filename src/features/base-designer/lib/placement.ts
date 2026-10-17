import { BUILDINGS, type Building } from '../model/buildings'
import { stationSize, canPlaceStation, DRONE_OUTPUT_KEYS, type Belt, type Point, type Scene, type Station } from '../model/scene'
import { BELTS, SPLITTERS, TUNNELS, logisticsPorts, splitterHeading, tunnelCells, type Splitter, type Tunnel } from '../model/logistics'
import { beltCells, canJoinBelts, connectsLogisticsPort, joinsAtLogisticsInput, isBeltHeading, samePoint } from './belts'
import { containsCell, floorAt, floorCellLimit, stationCorridors } from './stations'
import { isBuildingRecipeValid } from './building-recipes'
import { outputKeys, validDisabledOutputs } from './output-ports'

/** Reuse geometry within one synchronous validation, never across calls: hydration and proposals can reuse input arrays. */
function placementContext(scene: Scene) {
  const routes = new Map<
    readonly Point[],
    { cells: Point[] | null; bounds: { left: number; right: number; top: number; bottom: number } | null }
  >()
  let limit: number | undefined
  let corridors: ReturnType<typeof stationCorridors> | undefined
  let tunnelPorts: ReturnType<typeof logisticsPorts> | undefined
  let inputPorts: ReturnType<typeof logisticsPorts> | undefined
  let stationComponents: Map<string, string> | undefined
  /** Null routes are retained too; malformed peers must still fail in the original validation order. */
  const route = (points: readonly Point[]) => {
    const previous = routes.get(points)
    if (previous) return previous
    const cells = beltCells(points, (limit ??= floorCellLimit(scene.stations)))
    const bounds = cells ? { left: Infinity, right: -Infinity, top: Infinity, bottom: -Infinity } : null
    if (bounds && cells)
      for (const cell of cells) {
        bounds.left = Math.min(bounds.left, cell.x)
        bounds.right = Math.max(bounds.right, cell.x)
        bounds.top = Math.min(bounds.top, cell.y)
        bounds.bottom = Math.max(bounds.bottom, cell.y)
      }
    const geometry = { cells, bounds }
    routes.set(points, geometry)
    return geometry
  }
  return {
    get corridors() {
      return (corridors ??= stationCorridors(scene.stations))
    },
    get tunnelPorts() {
      return (tunnelPorts ??= logisticsPorts({ tunnels: scene.tunnels }))
    },
    get inputPorts() {
      return (inputPorts ??= logisticsPorts(scene).filter((port) => port.role === 'input'))
    },
    /** Tunnel support follows corridor links, never mere contact between station footprints. */
    get stationComponents() {
      if (stationComponents) return stationComponents
      const neighbors = new Map<string, string[]>()
      for (const {
        stationIds: [a, b],
      } of (corridors ??= stationCorridors(scene.stations))) {
        neighbors.set(a, [...(neighbors.get(a) ?? []), b])
        neighbors.set(b, [...(neighbors.get(b) ?? []), a])
      }
      stationComponents = new Map()
      for (const station of scene.stations) {
        if (stationComponents.has(station.id)) continue
        const queue = [station.id]
        stationComponents.set(station.id, station.id)
        for (let i = 0; i < queue.length; i++)
          for (const next of neighbors.get(queue[i]) ?? [])
            if (!stationComponents.has(next)) {
              stationComponents.set(next, station.id)
              queue.push(next)
            }
      }
      return stationComponents
    },
    cells: (points: readonly Point[]) => route(points).cells,
    bounds: (points: readonly Point[]) => route(points).bounds,
  }
}

/** Only a final-layout scan shares this context; standalone checks derive their own geometry. */
type PlacementContext = ReturnType<typeof placementContext>

/** Locate the floor owning a cell; touching station frames never own extra cells. */
export function stationAt(scene: Scene, point: Point) {
  return scene.stations.find((s) => point.x >= s.x && point.y >= s.y && point.x < s.x + stationSize(s) && point.y < s.y + stationSize(s))
}

/** Occupancy is independent of artwork, orientation and the presence of port glyphs. */
function insideBuilding(point: Point, building: Omit<Building, 'id'>): boolean {
  const size = BUILDINGS[building.type].size
  return point.x >= building.x && point.x < building.x + size && point.y >= building.y && point.y < building.y + size
}

/** Share ownership and extent constraints while allowing individual and final-scene feedback to keep their own wording. */
function isBuildingOffFloor(building: Omit<Building, 'id'>, station: Station | undefined): boolean {
  const size = BUILDINGS[building.type].size
  return (
    !station ||
    station.type === 'drone' ||
    building.x < station.x ||
    building.y < station.y ||
    building.x + size > station.x + stationSize(station) ||
    building.y + size > station.y + stationSize(station)
  )
}

/** Buildings fit entirely in their explicit station and cannot occupy buildings or existing belts. */
export function canPlaceBuilding(scene: Scene, building: Omit<Building, 'id'>, excludedId?: string): boolean {
  return buildingPlacementIssue(scene, building, excludedId) === null
}

/** Explain the actual failed constraint once, shared by previews, transformations and store validation. */
export function buildingPlacementIssue(
  scene: Scene,
  building: Omit<Building, 'id'>,
  excludedId?: string,
  context = placementContext(scene),
): string | null {
  if (
    !Object.hasOwn(BUILDINGS, building.type) ||
    !validDisabledOutputs(building.disabledOutputs, outputKeys(building)) ||
    !isBuildingRecipeValid(building) ||
    !Number.isSafeInteger(building.x) ||
    !Number.isSafeInteger(building.y) ||
    ![0, 90, 180, 270].includes(building.rotation)
  )
    return 'This building has an invalid configuration or position.'
  const station = scene.stations.find((s) => s.id === building.stationId)
  const size = BUILDINGS[building.type].size
  if (isBuildingOffFloor(building, station))
    return !station || station.type === 'drone'
      ? 'Place this building on an ordinary station floor.'
      : 'This building does not fit entirely on its station. Include pieces that would lose floor support.'
  if (
    scene.buildings.some(
      (other) =>
        other.id !== excludedId &&
        building.x < other.x + BUILDINGS[other.type].size &&
        building.x + size > other.x &&
        building.y < other.y + BUILDINGS[other.type].size &&
        building.y + size > other.y,
    )
  )
    return 'Another building occupies this space. Move it or choose a free area.'
  if ((scene.splitters ?? []).some((piece) => insideBuilding(piece, building))) return 'A splitter occupies this space.'
  if ((scene.tunnels ?? []).some((piece) => insideBuilding(piece.entry, building) || insideBuilding(piece.exit, building)))
    return 'An underground belt mouth occupies this space. The buried section can be built over.'
  return scene.belts.some((belt) => (context.cells(belt.points) ?? []).some((cell) => insideBuilding(cell, building)))
    ? 'A surface belt occupies this space. Move the belt or choose a free area.'
    : null
}

/** Surface pieces need continuous floor support through aligned corridor boundaries. */
function supportedCells(scene: Scene, cells: readonly Point[], context: PlacementContext = placementContext(scene)): boolean {
  const corridors = context.corridors
  let previous: readonly string[] | undefined
  for (const cell of cells) {
    const floor = floorAt(scene.stations, corridors, cell)
    if (!floor) return false
    const support = 'stationIds' in floor ? floor.stationIds : [floor.id]
    const from = previous
    if (from && !support.some((id) => from.includes(id))) return false
    previous = support
  }
  return true
}

/** Only mouths need floor; their supporting stations must share a corridor-connected network. */
function supportedTunnel(scene: Scene, tunnel: Omit<Tunnel, 'id'>, context: PlacementContext = placementContext(scene)): boolean {
  const entry = floorAt(scene.stations, context.corridors, tunnel.entry),
    exit = floorAt(scene.stations, context.corridors, tunnel.exit)
  if (!entry || !exit) return false
  // A corridor's two owners always belong to the same connected component.
  const from = 'stationIds' in entry ? entry.stationIds[0] : entry.id,
    to = 'stationIds' in exit ? exit.stationIds[0] : exit.id
  if (from === to) return true
  const component = context.stationComponents.get(from)
  return component !== undefined && component === context.stationComponents.get(to)
}

/** Propose the input direction of a straight lane; only the store cuts its footprint after accepting the placement. */
export function alignSplitter(scene: Scene, splitter: Omit<Splitter, 'id'>): Omit<Splitter, 'id'> {
  for (const belt of scene.belts) {
    const cells = beltCells(belt.points, floorCellLimit(scene.stations)) ?? []
    const index = cells.findIndex((point) => samePoint(point, splitter))
    const before = cells[index - 1],
      after = cells[index + 1]
    if (index < 1 || !before || !after || before.x + after.x !== splitter.x * 2 || before.y + after.y !== splitter.y * 2) continue
    const direction = { x: after.x - splitter.x, y: after.y - splitter.y }
    const rotation = ([0, 90, 180, 270] as const).find((angle) => samePoint(splitterHeading(angle), direction))!
    return { ...splitter, rotation }
  }
  return splitter
}

/** An inline housing accepts the same directed straight lane whether the proposal places the splitter or the belt. */
function isAlignedSplitterLane(
  splitter: Pick<Splitter, 'x' | 'y' | 'rotation'>,
  before: Point | undefined,
  after: Point | undefined,
): boolean {
  if (!before || !after) return false
  const heading = splitterHeading(splitter.rotation)
  return (
    samePoint({ x: splitter.x - before.x, y: splitter.y - before.y }, heading) &&
    samePoint({ x: after.x - splitter.x, y: after.y - splitter.y }, heading)
  )
}

/** Surface pieces occupy one cell. An inline splitter only accepts one straight lane in its input direction. */
export function canPlaceSplitter(
  scene: Scene,
  splitter: Omit<Splitter, 'id'>,
  excludedId?: string,
  context = placementContext(scene),
): boolean {
  if (
    !Object.hasOwn(SPLITTERS, splitter.type) ||
    !validDisabledOutputs(splitter.disabledOutputs, outputKeys(splitter)) ||
    !Number.isSafeInteger(splitter.x) ||
    !Number.isSafeInteger(splitter.y) ||
    ![0, 90, 180, 270].includes(splitter.rotation) ||
    !supportedCells(scene, [splitter], context)
  )
    return false
  if (
    scene.buildings.some((b) => insideBuilding(splitter, b)) ||
    (scene.splitters ?? []).some((s) => s.id !== excludedId && samePoint(s, splitter)) ||
    (scene.tunnels ?? []).some((t) => samePoint(t.entry, splitter) || samePoint(t.exit, splitter))
  )
    return false
  let occupied = false
  for (const belt of scene.belts) {
    const cells = context.cells(belt.points) ?? []
    const index = cells.findIndex((p) => samePoint(p, splitter))
    if (index < 0) continue
    if (occupied || !isAlignedSplitterLane(splitter, cells[index - 1], cells[index + 1])) return false
    occupied = true
  }
  return true
}

/** An entry click needs free surface support or an existing belt's final cell; its axis is validated with the exit. */
export function canStartTunnel(scene: Scene, point: Point): boolean {
  if (!Number.isSafeInteger(point.x) || !Number.isSafeInteger(point.y) || !supportedCells(scene, [point])) return false
  if (
    scene.buildings.some((b) => insideBuilding(point, b)) ||
    (scene.splitters ?? []).some((s) => samePoint(s, point)) ||
    (scene.tunnels ?? []).some((t) => (tunnelCells(t) ?? []).some((cell) => samePoint(cell, point)))
  )
    return false
  return scene.belts.every((belt) => {
    const cells = beltCells(belt.points, floorCellLimit(scene.stations)) ?? []
    return !cells.some((cell) => samePoint(cell, point)) || (!!cells.at(-1) && samePoint(cells[cells.length - 1], point))
  })
}

/** Mouths block surface occupancy; only the buried portion allows construction above it. Entire tunnels cannot cross. */
export function canPlaceTunnel(scene: Scene, tunnel: Omit<Tunnel, 'id'>, excludedId?: string, context = placementContext(scene)): boolean {
  if (!Object.hasOwn(TUNNELS, tunnel.type) || !validDisabledOutputs(tunnel.disabledOutputs, outputKeys(tunnel))) return false
  const cells = tunnelCells(tunnel)
  if (!cells || !supportedTunnel(scene, tunnel, context)) return false
  if (
    [tunnel.entry, tunnel.exit].some(
      (mouth) => scene.buildings.some((b) => insideBuilding(mouth, b)) || (scene.splitters ?? []).some((s) => samePoint(s, mouth)),
    )
  )
    return false
  const occupied = new Set(cells.map((p) => `${p.x},${p.y}`))
  if (
    (scene.tunnels ?? []).some((other) => other.id !== excludedId && (tunnelCells(other) ?? []).some((p) => occupied.has(`${p.x},${p.y}`)))
  )
    return false
  const ports = logisticsPorts({ tunnels: [{ ...tunnel, id: excludedId ?? '' }] })
  for (const belt of scene.belts) {
    const route = context.cells(belt.points) ?? []
    for (const port of ports)
      if (route.some((p) => samePoint(p, port.at)) && !connectsLogisticsPort(port, route, belt.heading)) return false
  }
  return true
}

/** Validate floor and occupancy; shared cells must form a directed endpoint connection or a single lateral T. */
export function canDrawBelt(scene: Scene, belt: Omit<Belt, 'id'>, excludedId?: string, context = placementContext(scene)): boolean {
  if (belt.type !== undefined && !Object.hasOwn(BELTS, belt.type)) return false
  if (belt.heading && (belt.points.length !== 1 || !isBeltHeading(belt.heading))) return false
  const original = excludedId ? scene.belts.find((item) => item.id === excludedId) : undefined
  if (
    original?.heading &&
    belt.points.length > 1 &&
    (Math.sign(belt.points[1].x - belt.points[0].x) !== original.heading.x ||
      Math.sign(belt.points[1].y - belt.points[0].y) !== original.heading.y)
  )
    return false // Extending a one-cell route must retain its stored direction.
  const cells = context.cells(belt.points)
  if (!cells) return false
  if (!supportedCells(scene, cells, context)) return false
  if (cells.some((cell) => scene.buildings.some((building) => insideBuilding(cell, building)))) return false
  for (const splitter of scene.splitters ?? []) {
    const index = cells.findIndex((p) => samePoint(p, splitter))
    if (index < 0) continue
    if (!isAlignedSplitterLane(splitter, cells[index - 1], cells[index + 1])) return false
    if (scene.belts.some((other) => other.id !== excludedId && (context.cells(other.points) ?? []).some((p) => samePoint(p, splitter))))
      return false
  }
  for (const port of context.tunnelPorts)
    if (cells.some((p) => samePoint(p, port.at)) && !connectsLogisticsPort(port, cells, belt.heading)) return false
  const positions = new Set(cells.map((cell) => `${cell.x},${cell.y}`))
  const shared = new Set<string>()
  const bounds = context.bounds(belt.points)!
  for (const other of scene.belts) {
    if (other.id === excludedId) continue
    const otherCells = context.cells(other.points)
    if (!otherCells) return false
    const otherBounds = context.bounds(other.points)!
    // Disjoint logical bounds cannot share a cell; overlapping bounds still use the exact directed-junction checks.
    if (
      bounds.right < otherBounds.left ||
      bounds.left > otherBounds.right ||
      bounds.bottom < otherBounds.top ||
      bounds.top > otherBounds.bottom
    )
      continue
    for (const cell of otherCells) {
      const key = `${cell.x},${cell.y}`
      if (!positions.has(key)) continue
      if (shared.has(key)) return false // An occupied junction cannot receive another route.
      if (
        !canJoinBelts(cells, otherCells, cell, belt.heading, other.heading) &&
        !canJoinBelts(otherCells, cells, cell, other.heading, belt.heading) &&
        !(
          samePoint(cells.at(-1)!, cell) &&
          samePoint(otherCells.at(-1)!, cell) &&
          context.inputPorts.some((port) => joinsAtLogisticsInput(port, cells, otherCells, belt.heading, other.heading))
        )
      )
        return false
      shared.add(key)
    }
  }
  return true
}

/** Validate mutually dependent pieces against the final scene, after callers have validated records and unique identities. */
export function canPlaceScenePieces(scene: Scene): boolean {
  const context = placementContext(scene)
  return (
    scene.stations.every((station) =>
      station.type === 'drone'
        ? validDisabledOutputs(station.disabledOutputs, DRONE_OUTPUT_KEYS)
        : !('disabledOutputs' in station && station.disabledOutputs !== undefined),
    ) &&
    scene.buildings.every((building) => buildingPlacementIssue(scene, building, building.id, context) === null) &&
    (scene.splitters ?? []).every((splitter) => canPlaceSplitter(scene, splitter, splitter.id, context)) &&
    (scene.tunnels ?? []).every((tunnel) => canPlaceTunnel(scene, tunnel, tunnel.id, context)) &&
    scene.belts.every((belt) => canDrawBelt(scene, belt, belt.id, context))
  )
}

/** Explain the first invalid final-layout constraint using the same validators as committed placement. */
export function scenePlacementIssue(scene: Scene): string | null {
  const context = placementContext(scene)
  if (
    scene.stations.some((station) =>
      station.type === 'drone'
        ? !validDisabledOutputs(station.disabledOutputs, DRONE_OUTPUT_KEYS)
        : 'disabledOutputs' in station && station.disabledOutputs !== undefined,
    )
  )
    return 'The station output configuration is invalid.'
  if (!scene.stations.every((station) => canPlaceStation(scene.stations, station, station.id)))
    return 'Stations must stay on the grid without overlapping.'
  for (const building of scene.buildings) {
    if (!isBuildingRecipeValid(building)) return "The recipe must belong to this machine's catalog."
    const floor = scene.stations.find((station) => station.id === building.stationId)
    if (isBuildingOffFloor(building, floor))
      return 'Keep every building entirely on its station. Include any pieces that would lose floor support.'
    const issue = buildingPlacementIssue(scene, building, building.id, context)
    if (issue) return issue
  }
  for (const splitter of scene.splitters ?? []) {
    if (!supportedCells(scene, [splitter], context)) return 'A splitter would lose its station or corridor floor.'
    if (!canPlaceSplitter(scene, splitter, splitter.id, context))
      return 'A splitter needs a free cell or a straight belt aligned with its input.'
  }
  for (const tunnel of scene.tunnels ?? []) {
    const cells = tunnelCells(tunnel)
    if (!cells || !supportedTunnel(scene, tunnel, context)) return 'Place both tunnel mouths on floors connected by station corridors.'
    if (!canPlaceTunnel(scene, tunnel, tunnel.id, context))
      return 'A tunnel mouth is occupied, a buried route overlaps, or a belt enters from an invalid side.'
  }
  for (const belt of scene.belts) {
    const cells = context.cells(belt.points)
    if (!cells || !supportedCells(scene, cells, context)) return 'Keep each complete belt on connected station or corridor floors.'
    if (!canDrawBelt(scene, belt, belt.id, context))
      return 'Belts cannot cross, overlap, occupy machines or enter a logistics piece from an invalid side.'
  }
  return null
}

/** Invalid route feedback preserves the existing validator and explains floor, occupation and direction constraints. */
export function beltPlacementIssue(scene: Scene, belt: Omit<Belt, 'id'>, excludedId?: string): string | null {
  if (canDrawBelt(scene, belt, excludedId)) return null
  const cells = beltCells(belt.points, floorCellLimit(scene.stations))
  if (!cells) return 'Draw an orthogonal belt on whole floor cells. Avoid repeated cells and crossings.'
  if (!supportedCells(scene, cells)) return 'Part of this belt has no connected station or corridor floor.'
  if (cells.some((cell) => scene.buildings.some((building) => insideBuilding(cell, building))))
    return 'This belt enters a building footprint. Connect through an I/O instead.'
  return 'This connection crosses or overlaps another route, or approaches a logistics port from an invalid side. Use a three-arm merge; underground mouths connect only from the front.'
}

/** Complete tunnel feedback distinguishes alignment/reach from occupied mouths and buried crossings. */
export function tunnelPlacementIssue(scene: Scene, tunnel: Omit<Tunnel, 'id'>, excludedId?: string): string | null {
  if (!Object.hasOwn(TUNNELS, tunnel.type)) return 'This underground belt configuration is invalid.'
  if (canPlaceTunnel(scene, tunnel, excludedId)) return null
  if (tunnel.entry.x !== tunnel.exit.x && tunnel.entry.y !== tunnel.exit.y)
    return 'Align the underground exit horizontally or vertically with its entry.'
  const cells = tunnelCells(tunnel)
  if (!cells) return `Choose an exit with 1–${TUNNELS[tunnel.type].reach} buried cells between the mouths.`
  if (!supportedTunnel(scene, tunnel)) return 'Place both tunnel mouths on floors connected by station corridors.'
  return 'A mouth is occupied, another tunnel crosses underneath, or a surface belt approaches from an invalid side.'
}

/** Conservative eligibility for an independent station clipboard template; includes the complete buried tunnel span.
 * Occupied stations fall back to group capture. Movement/removal validate final support instead of using this predicate.
 */
export function isStationEmpty(scene: Scene, id: string): boolean {
  if (scene.buildings.some((b) => b.stationId === id)) return false
  const station = scene.stations.find((s) => s.id === id)
  if (!station) return true
  const regions = [station, ...stationCorridors(scene.stations).filter((corridor) => corridor.stationIds.includes(id))]
  if ((scene.splitters ?? []).some((s) => regions.some((region) => containsCell(region, s)))) return false
  if ((scene.tunnels ?? []).some((t) => (tunnelCells(t) ?? []).some((cell) => regions.some((region) => containsCell(region, cell)))))
    return false
  return !scene.belts.some((belt) =>
    (beltCells(belt.points, floorCellLimit(scene.stations)) ?? []).some((cell) => regions.some((region) => containsCell(region, cell))),
  )
}
