import type { Point, Scene, Selection } from '../model/scene'
import { buildingPorts, type BuildingPort } from '../model/buildings'
import { logisticsCapacity, logisticsPorts } from '../model/logistics'
import { beltCells, beltPortRole, canJoinBelts, connectsLogisticsPort, joinsAtLogisticsInput, resolveBeltPorts, samePoint } from './belts'
import { dronePorts, floorCellLimit } from './stations'
import { recipeForBuilding } from './building-recipes'

/** Compact render geometry; supplied edges reaching another owner animate, including configured drone cargo. */
export interface BeltRun {
  points: readonly Point[]
  active: boolean
}

/** A physical machine or drone attachment uses the same flow clock as its belt or logistics piece. */
export interface BeltPortBridge {
  owner: Selection
  beltId?: string
  cell: Point
  position: Point
  role: 'input' | 'output'
  active: boolean
}

/** Known catalog types, never inferred quantities or proof of production. Unknown suppliers remain explicit. */
export interface ProductKnowledge {
  items: readonly string[]
  unknown: boolean
}

/** Actor and physical port identity, shared by inspection and recipe assistance. */
export const portProductKey = (ownerId: string, portKey: string) => `${ownerId}:${portKey}`

/** Connectivity is derived after confirmed edits, never persisted or recalculated on animation frames. */
export interface BeltNetwork {
  /** The confirmed directed graph and shared cell limits serve capacity analysis without rebuilding connectivity. */
  links: ReadonlyMap<string, readonly string[]>
  capacities: ReadonlyMap<string, number>
  runs: ReadonlyMap<string, readonly BeltRun[]>
  portRoles: ReadonlyMap<string, Readonly<Record<string, 'input' | 'output'>>>
  junctions: readonly { cell: Point; beltIds: readonly string[] }[]
  portBridges: readonly (BeltPortBridge & { ownerId: string; portKey: string; enabled?: boolean })[]
  attachments: readonly (BeltRun & { owner: Selection })[]
  /** Physical fixed I/O, independent from whether its route currently carries items. */
  connectedPorts: ReadonlySet<string>
  cellProducts: ReadonlyMap<string, ProductKnowledge>
  portProducts: ReadonlyMap<string, ProductKnowledge>
}

const cellKey = (p: Point) => `${p.x},${p.y}`
/** Reachability starts at a transport cell and retains its actor to exclude paths returning only to their source. */
type Seed = { key: string; ownerId: string }

/** Each (cell, product) is visited once, including loops; null tracks an unknown supplier without inventing an item. */
function products(
  seeds: readonly { key: string; item: string | null }[],
  links: ReadonlyMap<string, readonly string[]>,
): Map<string, ProductKnowledge> {
  const found = new Map<string, Set<string | null>>(),
    queue: { key: string; item: string | null }[] = []
  const add = (seed: (typeof queue)[number]) => {
    const items = found.get(seed.key) ?? new Set<string | null>()
    if (items.has(seed.item)) return
    items.add(seed.item)
    found.set(seed.key, items)
    queue.push(seed)
  }
  seeds.forEach(add)
  for (let i = 0; i < queue.length; i++) for (const key of links.get(queue[i].key) ?? []) add({ key, item: queue[i].item })
  return new Map(
    [...found].map(([key, items]) => [
      key,
      { items: [...items].filter((item): item is string => item !== null).sort(), unknown: items.has(null) },
    ]),
  )
}

/** Two distinct identities suffice to distinguish self-return from supply to another machine; each node propagates at most twice. */
function identities(seeds: readonly Seed[], links: ReadonlyMap<string, readonly string[]>): Map<string, string[]> {
  const found = new Map<string, string[]>(),
    queue: Seed[] = []
  const add = (seed: Seed) => {
    const ids = found.get(seed.key) ?? []
    if (ids.length === 2 || ids.includes(seed.ownerId)) return
    ids.push(seed.ownerId)
    found.set(seed.key, ids)
    queue.push(seed)
  }
  seeds.forEach(add)
  for (let i = 0; i < queue.length; i++) for (const key of links.get(queue[i].key) ?? []) add({ key, ownerId: queue[i].ownerId })
  return found
}

/** Build a directed surface graph with tunnel jumps. Floorless clipboard previews supply their own finite route bound. Branches and loops use bounded iterative reachability. */
export function beltNetwork(scene: Scene, cellLimit = floorCellLimit(scene.stations)): BeltNetwork {
  const routes = scene.belts.map((belt) => ({ belt, cells: beltCells(belt.points, cellLimit) ?? [] }))
  const occupied = new Map<string, { route: (typeof routes)[number]; index: number }[]>()
  const capacities = new Map<string, number>()
  const limit = (point: Point, capacity: number) => {
    const key = cellKey(point)
    capacities.set(key, Math.min(capacities.get(key) ?? Infinity, capacity))
  }
  for (const splitter of scene.splitters ?? []) limit(splitter, logisticsCapacity(splitter.type))
  for (const tunnel of scene.tunnels ?? []) {
    limit(tunnel.entry, logisticsCapacity(tunnel.type))
    limit(tunnel.exit, logisticsCapacity(tunnel.type))
  }
  const forward = new Map<string, string[]>(),
    backward = new Map<string, string[]>()
  const sources: Seed[] = [],
    receivers: Seed[] = []
  const portRoles = new Map<string, Record<string, 'input' | 'output'>>()
  const bridges: (Omit<BeltPortBridge, 'active'> & { ownerId: string; portKey: string; enabled?: boolean })[] = []
  const connectedPorts = new Set<string>()
  const attachments: { owner: Selection; points: Point[]; enabled: boolean }[] = []
  const physicalEdges = new Set<string>()
  /** Deduplicate inline lanes and explicit attachments before rendering or traversing them. */
  const link = (from: Point, to: Point): boolean => {
    const a = cellKey(from),
      b = cellKey(to),
      next = forward.get(a) ?? []
    if (next.includes(b)) return false
    next.push(b)
    forward.set(a, next)
    const previous = backward.get(b) ?? []
    previous.push(a)
    backward.set(b, previous)
    return true
  }
  const unlink = (from: Point, to: Point) => {
    const a = cellKey(from),
      b = cellKey(to)
    forward.set(
      a,
      (forward.get(a) ?? []).filter((key) => key !== b),
    )
    backward.set(
      b,
      (backward.get(b) ?? []).filter((key) => key !== a),
    )
  }
  /** Physical attachments survive an output switch, while transport links do not. */
  const attach = (owner: Selection, points: Point[], enabled = true) => {
    const key = `${cellKey(points[0])}>${cellKey(points[1])}`
    if (enabled) link(points[0], points[1])
    if (physicalEdges.has(key)) return
    physicalEdges.add(key)
    attachments.push({ owner, points, enabled })
  }
  for (const route of routes) {
    route.cells.forEach((point, index) => {
      const key = cellKey(point),
        entries = occupied.get(key) ?? []
      entries.push({ route, index })
      occupied.set(key, entries)
    })
    for (let i = 1; i < route.cells.length; i++) {
      link(route.cells[i - 1], route.cells[i])
      physicalEdges.add(`${cellKey(route.cells[i - 1])}>${cellKey(route.cells[i])}`)
    }
  }
  // At a directed merge, the receiving lane owns the shared tile; incoming lanes retain their upstream limits.
  for (const entries of occupied.values()) {
    const continuing = entries.filter(({ route, index }) => index + 1 < route.cells.length)
    const carriers = continuing.length ? continuing : entries
    limit(entries[0].route.cells[entries[0].index], Math.min(...carriers.map(({ route }) => logisticsCapacity(route.belt.type))))
  }
  const fixed = logisticsPorts(scene)
  const fixedAt = new Map<string, typeof fixed>()
  for (const port of fixed) {
    const key = cellKey(port.at),
      ports = fixedAt.get(key) ?? []
    ports.push(port)
    fixedAt.set(key, ports)
    const inline = occupied.get(key)?.some(({ route, index }) => {
      const neighbor = route.cells[index + (port.role === 'input' ? -1 : 1)]
      return neighbor && samePoint(neighbor, port.cell)
    })
    if (inline) {
      connectedPorts.add(port.key)
      if (port.outputEnabled === false) unlink(port.at, port.cell)
    }
    const entries = occupied.get(cellKey(port.cell))
    const joinedInput =
      entries?.length === 2 &&
      joinsAtLogisticsInput(
        port,
        entries[0].route.cells,
        entries[1].route.cells,
        entries[0].route.belt.heading,
        entries[1].route.belt.heading,
      )
    if (joinedInput) {
      // The lane continuing into the socket owns its tile; a lower-tier lateral feeder keeps its upstream limit.
      const axial = entries.filter(({ route, index }) => {
        const previous = route.cells[index - 1]
        const heading = previous ? { x: port.cell.x - previous.x, y: port.cell.y - previous.y } : route.belt.heading
        return heading?.x === -port.normal.x && heading?.y === -port.normal.y
      })
      const carriers = axial.some(({ route }) => route.cells.length === 1)
        ? axial.filter(({ route }) => route.cells.length === 1)
        : axial.length
          ? axial
          : entries
      capacities.set(cellKey(port.cell), Math.min(...carriers.map(({ route }) => logisticsCapacity(route.belt.type))))
    }
    // A fixed output may feed an existing merge; its receiving lane keeps the only onward direction and cell capacity.
    const outputCarrier =
      port.role === 'output' && entries?.length === 2
        ? entries.find((entry) => {
            const other = entries.find((peer) => peer !== entry)!
            return (
              connectsLogisticsPort(port, entry.route.cells, entry.route.belt.heading) &&
              canJoinBelts(other.route.cells, entry.route.cells, port.cell, other.route.belt.heading, entry.route.belt.heading)
            )
          })
        : undefined
    for (const { route } of entries?.length === 1 ? entries : joinedInput ? entries.slice(0, 1) : outputCarrier ? [outputCarrier] : []) {
      if (!connectsLogisticsPort(port, route.cells, route.belt.heading)) continue
      connectedPorts.add(port.key)
      const points = port.role === 'input' ? [port.cell, port.at] : [port.at, port.cell]
      attach(port.owner, points, port.outputEnabled !== false)
    }
  }
  // Neighboring logistics pieces join only through opposed output/input faces.
  for (const port of fixed) {
    if (port.role !== 'output') continue
    const input = fixedAt.get(cellKey(port.cell))?.find((other) => other.role === 'input' && samePoint(other.cell, port.at))
    if (input) {
      connectedPorts.add(port.key)
      connectedPorts.add(input.key)
      attach(port.owner, [port.at, input.at], port.outputEnabled !== false)
    }
  }
  for (const tunnel of scene.tunnels ?? []) link(tunnel.entry, tunnel.exit)
  const portsByCell = new Map<string, { buildingId: string; port: BuildingPort }[]>()
  for (const building of scene.buildings)
    for (const port of buildingPorts(building)) {
      const key = cellKey(port.cell),
        ports = portsByCell.get(key) ?? []
      ports.push({ buildingId: building.id, port })
      portsByCell.set(key, ports)
    }
  for (const [key, ports] of portsByCell) {
    const entries = occupied.get(key),
      faces = fixedAt.get(key)
    if (faces) {
      for (const { buildingId: ownerId, port } of ports) {
        const face = faces.find((p) => p.normal.x === -port.normal.x && p.normal.y === -port.normal.y)
        if (!face) continue
        connectedPorts.add(face.key)
        const role = face.role === 'input' ? 'output' : 'input'
        bridges.push({
          owner: face.owner,
          ownerId,
          portKey: port.key,
          cell: port.cell,
          position: port.position,
          role,
          enabled: role === 'output' ? port.outputEnabled !== false : face.outputEnabled !== false,
        })
      }
    } else if (entries?.length === 1) {
      // An explicit belt junction retains priority over a building later placed beside it.
      const { route, index } = entries[0]
      const continuation = forward.get(key)?.[0]
      const coordinates = continuation?.split(',').map(Number)
      const next = route.cells[index + 1] ?? (coordinates ? { x: coordinates[0], y: coordinates[1] } : undefined)
      for (const { buildingId: ownerId, port, role } of resolveBeltPorts(ports, route.cells[index - 1], next, route.belt.heading))
        bridges.push({
          owner: { kind: 'belt', id: route.belt.id },
          beltId: route.belt.id,
          ownerId,
          portKey: port.key,
          cell: port.cell,
          position: port.position,
          role,
          enabled: role === 'input' || port.outputEnabled !== false,
        })
    }
  }
  // Drone cargo is an external source, never a receiving machine or an invented recipe/rate.
  for (const station of scene.stations)
    for (const port of dronePorts(station)) {
      const key = cellKey(port.cell),
        entries = occupied.get(key),
        faces = fixedAt.get(key)
      const face = faces?.find((p) => p.role === 'input' && p.normal.x === -port.normal.x && p.normal.y === -port.normal.y)
      const entry = !faces && entries?.length === 1 ? entries[0] : undefined
      if (entry) {
        const next = entry.route.cells[entry.index + 1]
        if (beltPortRole(port, entry.route.cells[entry.index - 1], next, entry.route.belt.heading) !== 'output') continue
      } else if (!face) continue
      connectedPorts.add(port.key)
      if (face) connectedPorts.add(face.key)
      bridges.push({
        owner: face?.owner ?? { kind: 'belt', id: entry!.route.belt.id },
        ...(entry && { beltId: entry.route.belt.id }),
        ownerId: station.id,
        portKey: port.key,
        cell: port.cell,
        position: port.position,
        role: 'output',
        enabled: port.itemId !== null && port.outputEnabled !== false,
      })
    }
  for (const bridge of bridges) {
    const key = cellKey(bridge.cell)
    const seeds = bridge.role === 'output' ? sources : receivers
    if (bridge.enabled !== false) seeds.push({ key, ownerId: bridge.ownerId })
    const roles = portRoles.get(bridge.ownerId) ?? {}
    roles[bridge.portKey] = bridge.role
    portRoles.set(bridge.ownerId, roles)
  }
  const supplied = identities(sources, forward),
    delivered = identities(receivers, backward)
  const outputProducts = new Map<string, ProductKnowledge>()
  for (const building of scene.buildings) {
    const recipe = recipeForBuilding(building.type, building.recipeId)
    outputProducts.set(building.id, {
      items: recipe ? [recipe.output.id, ...(recipe.extra_outputs ?? []).map((item) => item.id)] : [],
      unknown: !recipe,
    })
  }
  const cargoProducts = new Map(
    scene.stations.flatMap((station) => dronePorts(station).map((port) => [portProductKey(station.id, port.key), port.itemId] as const)),
  )
  /** An empty cargo is known to supply nothing; an unconfigured machine remains an unknown provider. */
  const sourceProducts = (bridge: (typeof bridges)[number]): ProductKnowledge => {
    const cargo = cargoProducts.get(portProductKey(bridge.ownerId, bridge.portKey))
    return cargo !== undefined
      ? { items: cargo ? [cargo] : [], unknown: false }
      : (outputProducts.get(bridge.ownerId) ?? { items: [], unknown: false })
  }
  const cellProducts = products(
    bridges.flatMap((bridge) => {
      if (bridge.role !== 'output' || bridge.enabled === false) return []
      const knowledge = sourceProducts(bridge)
      return [...knowledge.items, ...(knowledge.unknown ? [null] : [])].map((item) => ({ key: cellKey(bridge.cell), item }))
    }),
    forward,
  )
  const portProducts = new Map<string, ProductKnowledge>()
  for (const bridge of bridges) {
    const knowledge =
      bridge.enabled === false
        ? { items: [], unknown: false }
        : bridge.role === 'output'
          ? sourceProducts(bridge)
          : (cellProducts.get(cellKey(bridge.cell)) ?? { items: [], unknown: false })
    portProducts.set(portProductKey(bridge.ownerId, bridge.portKey), knowledge)
  }
  for (const port of fixed)
    portProducts.set(
      portProductKey(port.owner.id, port.key),
      port.outputEnabled === false ? { items: [], unknown: false } : (cellProducts.get(cellKey(port.at)) ?? { items: [], unknown: false }),
    )
  /** Animate only when supply can traverse the span and reach a different actor; this does not prove production. */
  const active = (from: Point, to = from) =>
    (supplied.get(cellKey(from)) ?? []).some((source) => (delivered.get(cellKey(to)) ?? []).some((receiver) => source !== receiver))
  const runs = new Map<string, BeltRun[]>()
  for (const { belt, cells } of routes) {
    const compact: { points: Point[]; active: boolean }[] = []
    if (cells.length === 1) compact.push({ points: cells, active: active(cells[0]) })
    for (let i = 1; i < cells.length; i++) {
      const point = cells[i],
        moving = (forward.get(cellKey(cells[i - 1]))?.includes(cellKey(point)) ?? false) && active(cells[i - 1], point)
      let run = compact.at(-1)
      if (!run || run.active !== moving) {
        run = { points: [cells[i - 1]], active: moving }
        compact.push(run)
      }
      const before = run.points.at(-2),
        last = run.points.at(-1)
      if (before && last && ((before.x === last.x && last.x === point.x) || (before.y === last.y && last.y === point.y)))
        run.points[run.points.length - 1] = point
      else run.points.push(point)
    }
    runs.set(belt.id, compact)
  }
  return {
    links: forward,
    capacities,
    runs,
    connectedPorts,
    portRoles,
    cellProducts,
    portProducts,
    junctions: [...occupied.values()]
      .filter((entries) => entries.length > 1)
      .map((entries) => ({ cell: entries[0].route.cells[entries[0].index], beltIds: entries.map(({ route }) => route.belt.id) })),
    attachments: attachments.map(({ owner, points, enabled }) => ({ owner, points, active: enabled && active(points[0], points[1]) })),
    portBridges: bridges.map(({ ownerId, portKey, owner, beltId, cell, position, role, enabled }) => ({
      ownerId,
      portKey,
      enabled,
      owner,
      beltId,
      cell,
      position,
      role,
      active: enabled !== false && ((role === 'output' ? delivered : supplied).get(cellKey(cell))?.some((id) => id !== ownerId) ?? false),
    })),
  }
}
