import { logisticsPorts } from '../model/logistics'
import type { Point, Scene, Selection } from '../model/scene'
import { dronePorts } from './stations'
import { recipeForBuilding } from './building-recipes'
import { portProductKey, type BeltNetwork } from './belt-network'

/** Shared items/min tolerance for residual allocation and the final supplied/shortfall classification. */
export const FLOW_TOLERANCE = 1e-7

/** Serialize transport cells exactly as the confirmed BeltNetwork does; demand faces and allocation must share keys. */
export const cellKey = (point: Point) => point.x + ',' + point.y

/** One provider budget exposed at an outlet cell; repeated IDs pool all faces instead of multiplying supply.
 * Amounts are items/min. External cargo has no intrinsic rate, while unknown providers cannot be quantified.
 */
interface Source {
  id: string
  owner: Selection
  cell: string
  amount: number
  unknown: boolean
}
/** One receiver/item budget in items/min across matching cells: recipe demand or a Container's incoming transport bound. */
export interface Demand {
  buildingId: string
  itemId: string
  amount: number
  cells: string[]
}

/** Each machine pools its real output across all outlets; a drone cargo is limited by connected transport, not an invented drone rate. */
export function itemSources(scene: Scene, network: BeltNetwork, itemId: string): Source[] {
  const sources: Source[] = []
  const droneItems = new Map(
    scene.stations.flatMap((station) => dronePorts(station).map((port) => [portProductKey(station.id, port.key), port.itemId] as const)),
  )
  const byId = new Map(scene.buildings.map((building) => [building.id, building]))
  for (const port of network.portBridges) {
    if (port.role !== 'output' || port.enabled === false) continue
    const cargo = droneItems.get(portProductKey(port.ownerId, port.portKey))
    if (cargo !== undefined) {
      if (cargo === itemId)
        sources.push({
          id: JSON.stringify(['cargo', port.ownerId, port.portKey]),
          owner: { kind: 'station', id: port.ownerId },
          cell: cellKey(port.cell),
          amount: Infinity,
          unknown: false,
        })
    } else {
      const building = byId.get(port.ownerId),
        recipe = building && recipeForBuilding(building.type, building.recipeId)
      const output =
        recipe &&
        [recipe.output, ...(recipe.extra_outputs ?? [])]
          .filter((output) => output.id === itemId)
          .reduce((sum, output) => sum + output.amount_per_minute, 0)
      if (!recipe || output)
        sources.push({
          id: JSON.stringify(['machine', port.ownerId]),
          owner: { kind: 'building', id: port.ownerId },
          cell: cellKey(port.cell),
          amount: output ?? Infinity,
          unknown: !recipe,
        })
    }
  }
  return sources
}

/** Equal shares saturate accepting limits and redistribute the remainder, independent of output count or belt level.
 * Provider faces, splitter exits, shared demands and reverse settlement all use this same allocation policy.
 */
export function distributeSplitterFlow(amount: number, limits: readonly number[]): number[] {
  const result = limits.map(() => 0)
  let remaining = Math.max(0, amount),
    active = limits.map((_, i) => i).filter((i) => limits[i] > FLOW_TOLERANCE)
  while (active.length && remaining > FLOW_TOLERANCE) {
    const share = remaining / active.length
    let used = 0
    for (const i of active) {
      const accepted = Math.min(share, limits[i] - result[i])
      result[i] += accepted
      used += accepted
    }
    remaining -= used
    active = active.filter((i) => limits[i] - result[i] > FLOW_TOLERANCE)
  }
  return result
}

/** Pool separate outlets from one machine and multiple faces of one demand before allocating a component.
 * These budget links may join physically separate branches; allocating physical islands independently would duplicate supply.
 */
export function transportComponents(network: BeltNetwork, sources: readonly Source[], demands: readonly Demand[]) {
  const neighbors = new Map<string, Set<string>>()
  const include = (cell: string) => {
    if (!neighbors.has(cell)) neighbors.set(cell, new Set())
  }
  const join = (a: string, b: string) => {
    include(a)
    include(b)
    neighbors.get(a)!.add(b)
    neighbors.get(b)!.add(a)
  }
  for (const cell of network.capacities.keys()) include(cell)
  for (const [from, next] of network.links) for (const to of next) join(from, to)
  const firstBySource = new Map<string, string>()
  for (const source of sources) {
    include(source.cell)
    const first = firstBySource.get(source.id)
    if (first) join(first, source.cell)
    else firstBySource.set(source.id, source.cell)
  }
  for (const demand of demands) for (const cell of demand.cells) join(demand.cells[0], cell)
  const component = new Map<string, number>()
  let nextId = 0
  for (const cell of neighbors.keys()) {
    if (component.has(cell)) continue
    const cells = [cell],
      id = nextId++
    component.set(cell, id)
    for (let i = 0; i < cells.length; i++)
      for (const next of neighbors.get(cells[i])!)
        if (!component.has(next)) {
          component.set(next, id)
          cells.push(next)
        }
  }
  return component
}

/** Finite topological traversal shared by transport cells and upstream machine dependencies.
 * Positive residual degrees include cycles and their downstream nodes, not only members of a cycle.
 */
export function topologicalOrder(nodes: readonly string[], links: ReadonlyMap<string, readonly string[]>) {
  const degree = new Map(nodes.map((node) => [node, 0]))
  for (const node of nodes) for (const next of links.get(node) ?? []) if (degree.has(next)) degree.set(next, degree.get(next)! + 1)
  const order = nodes.filter((node) => degree.get(node) === 0)
  for (let i = 0; i < order.length; i++)
    for (const next of links.get(order[i]) ?? [])
      if (degree.has(next)) {
        degree.set(next, degree.get(next)! - 1)
        if (degree.get(next) === 0) order.push(next)
      }
  return { order, degree }
}

/** Index the confirmed physical faces once, avoiding whole-scene scans for every independent supply branch. */
export function allocationGeometry(scene: Scene, network: BeltNetwork) {
  const outputs = logisticsPorts(scene).filter((port) => port.role === 'output')
  const exits = new Map<string, typeof outputs>()
  const byPosition = new Map(outputs.map((port) => [JSON.stringify([port.owner.id, port.position.x, port.position.y]), port.key]))
  const directFaces = new Map<string, string>()
  for (const port of outputs) {
    const key = cellKey(port.at),
      ports = exits.get(key) ?? []
    ports.push(port)
    exits.set(key, ports)
  }
  for (const bridge of network.portBridges) {
    if (bridge.role !== 'input' || bridge.owner.kind !== 'splitter') continue
    const key = byPosition.get(JSON.stringify([bridge.owner.id, bridge.position.x, bridge.position.y]))
    if (key) directFaces.set(JSON.stringify([bridge.ownerId, cellKey(bridge.cell)]), key)
  }
  return {
    exits,
    directFaces,
    splitters: new Set((scene.splitters ?? []).map(cellKey)),
    placement: new Map(scene.buildings.map((building, index) => [building.id, index])),
  }
}

/** Direct joins add incoming flow within each cell's transport limit. Recipe supply and demand are pooled across faces.
 * A forward proposal preserves lane priority and equal splitter shares; a reverse pass charges only accepted flow.
 * Residual rounds release saturated/shared-input quotas without duplicating supply at a split followed by a join.
 * This is a nominal allocation, not a simulation of the game's delivery order. Cycles and product mixes stay unknown.
 * shortcut: accepted shares are not globally rerouted; revisit only if maximum feasible output becomes the contract.
 */
export function allocateComponent(
  geometry: ReturnType<typeof allocationGeometry>,
  network: BeltNetwork,
  sources: readonly Source[],
  demands: readonly Demand[],
) {
  if (!sources.length || sources.some((source) => source.unknown))
    return { type: 'unknown' as const, reason: 'Supply cannot be determined from these providers.' }
  // An empty upstream arm at a T is physically connected but contributes no flow or competing allocation.
  const supplied = [...new Set(sources.map((source) => source.cell))],
    allowed = new Set(supplied)
  for (let i = 0; i < supplied.length; i++)
    for (const next of network.links.get(supplied[i]) ?? [])
      if (!allowed.has(next)) {
        allowed.add(next)
        supplied.push(next)
      }
  if (supplied.some((cell) => network.cellProducts.get(cell)?.unknown || (network.cellProducts.get(cell)?.items.length ?? 0) > 1))
    return { type: 'unknown' as const, reason: 'The route contains mixed or unknown products.' }
  const { order } = topologicalOrder(supplied, network.links)
  if (order.length !== supplied.length) return { type: 'unknown' as const, reason: 'The route contains a loop.' }
  // Lane priority follows the actual directed route, including tunnel jumps, rather than straight-line proximity.
  const { splitters, placement, directFaces, exits } = geometry
  if (supplied.some((cell) => (network.links.get(cell)?.filter((next) => allowed.has(next)).length ?? 0) > 1 && !splitters.has(cell)))
    return { type: 'unknown' as const, reason: 'A belt junction has several exits.' }
  const local = new Map<string, Demand[]>(),
    direct = new Map<string, Demand[]>()
  for (const demand of [...demands].sort((a, b) => placement.get(a.buildingId)! - placement.get(b.buildingId)!)) {
    for (const cell of demand.cells) {
      const face = directFaces.get(JSON.stringify([demand.buildingId, cell]))
      const collection = face ? direct : local,
        key = face ?? cell,
        rows = collection.get(key) ?? []
      rows.push(demand)
      collection.set(key, rows)
    }
  }
  const providers = new Map<string, { remaining: number; cells: Set<string> }>()
  for (const source of sources) {
    const provider = providers.get(source.id) ?? { remaining: source.amount, cells: new Set<string>() }
    provider.cells.add(source.cell)
    providers.set(source.id, provider)
  }
  const allocated = new Map<string, number>()
  const remainingDemand = (row: Demand) => Math.max(0, row.amount - (allocated.get(row.buildingId) ?? 0))
  const sum = (rows: readonly Demand[] | undefined) => rows?.reduce((amount, row) => amount + remainingDemand(row), 0) ?? 0
  const capacity = new Map(order.map((cell) => [cell, network.capacities.get(cell) ?? Infinity]))
  const children = new Map(order.map((cell) => [cell, (network.links.get(cell) ?? []).filter((next) => allowed.has(next))]))
  const reverse = [...order].reverse()
  // Only recipe producers carry upstream readiness dependencies; external cargo needs no provenance graph.
  const machineSources = sources.filter((source) => source.owner.kind === 'building')
  const suppliersByDemand = new Map<string, Set<string>>()
  if (machineSources.length) {
    const suppliers = new Map(order.map((cell) => [cell, new Set<string>()]))
    for (const source of machineSources) suppliers.get(source.cell)!.add(source.owner.id)
    for (const cell of order) for (const next of children.get(cell)!) for (const id of suppliers.get(cell)!) suppliers.get(next)!.add(id)
    for (const row of demands) suppliersByDemand.set(row.buildingId, new Set(row.cells.flatMap((cell) => [...(suppliers.get(cell) ?? [])])))
  }

  // Each non-empty round exhausts a source, cell or demand budget. No time stepping or convergence guess is needed.
  for (let round = 0; round < order.length + providers.size + demands.length; round++) {
    if (demands.every((row) => remainingDemand(row) <= FLOW_TOLERANCE)) break
    if (
      [...providers.values()].every(
        (provider) => provider.remaining <= FLOW_TOLERANCE || [...provider.cells].every((cell) => capacity.get(cell)! <= FLOW_TOLERANCE),
      )
    )
      break
    const accepting = new Map<string, number>()
    /** One fixed exit may feed a machine directly and continue into a lane; both compete for the same share. */
    const exitLimits = (cell: string) =>
      (exits.get(cell) ?? []).map((port) =>
        port.outputEnabled === false
          ? 0
          : sum(direct.get(port.key)) + (children.get(cell)!.includes(cellKey(port.cell)) ? (accepting.get(cellKey(port.cell)) ?? 0) : 0),
      )
    for (const cell of reverse) {
      const downstream = splitters.has(cell)
        ? exitLimits(cell).reduce((a, b) => a + b, 0)
        : children.get(cell)!.reduce((amount, next) => amount + (accepting.get(next) ?? 0), 0)
      accepting.set(cell, Math.min(capacity.get(cell)!, sum(local.get(cell)) + downstream))
    }
    const incoming = new Map<string, { from?: string; source?: string; amount: number }[]>()
    const receive = (cell: string, flow: { from?: string; source?: string; amount: number }) => {
      if (flow.amount <= FLOW_TOLERANCE) return
      const rows = incoming.get(cell) ?? []
      rows.push(flow)
      incoming.set(cell, rows)
    }
    for (const [id, provider] of providers) {
      const cells = [...provider.cells]
      const shares = distributeSplitterFlow(
        provider.remaining,
        cells.map((cell) => accepting.get(cell) ?? 0),
      )
      cells.forEach((cell, i) => receive(cell, { source: id, amount: shares[i] }))
    }
    const deliveries = new Map<string, { cell: string; amount: number }[]>()
    /** Offer flow in placement order; the later settlement pass caps the ingredient shared by several faces. */
    const reserve = (cell: string, rows: readonly Demand[] | undefined, amount: number) => {
      for (const row of rows ?? []) {
        const used = Math.min(amount, remainingDemand(row))
        const offers = deliveries.get(row.buildingId) ?? []
        offers.push({ cell, amount: used })
        deliveries.set(row.buildingId, offers)
        amount -= used
      }
      return amount
    }
    for (const cell of order) {
      const offered = incoming.get(cell)?.reduce((sum, flow) => sum + flow.amount, 0) ?? 0
      if (offered <= FLOW_TOLERANCE) continue
      const amount = reserve(cell, local.get(cell), Math.min(offered, accepting.get(cell) ?? 0))
      if (splitters.has(cell)) {
        const shares = distributeSplitterFlow(amount, exitLimits(cell))
        ;(exits.get(cell) ?? []).forEach((port, i) => {
          const remainder = reserve(cell, direct.get(port.key), shares[i]),
            next = cellKey(port.cell)
          if (children.get(cell)!.includes(next)) receive(next, { from: cell, amount: remainder })
        })
      } else if (children.get(cell)![0]) receive(children.get(cell)![0], { from: cell, amount })
    }
    // Settle all faces together before charging transport: the same ingredient is one demand, not one per port.
    const used = new Map<string, number>()
    let progress = 0
    for (const row of demands) {
      const offers = deliveries.get(row.buildingId) ?? []
      const shares = distributeSplitterFlow(
        remainingDemand(row),
        offers.map((offer) => offer.amount),
      )
      offers.forEach((offer, i) => used.set(offer.cell, (used.get(offer.cell) ?? 0) + shares[i]))
      const accepted = shares.reduce((a, b) => a + b, 0)
      allocated.set(row.buildingId, (allocated.get(row.buildingId) ?? 0) + accepted)
      progress += accepted
    }
    if (progress <= FLOW_TOLERANCE) break
    // Return rejected proposals to their upstream budgets; only delivered flow occupies a cell or consumes a recipe.
    for (const cell of reverse) {
      const accepted = used.get(cell) ?? 0,
        flows = incoming.get(cell) ?? []
      if (accepted <= FLOW_TOLERANCE) continue
      capacity.set(cell, Math.max(0, capacity.get(cell)! - accepted))
      const shares = distributeSplitterFlow(
        accepted,
        flows.map((flow) => flow.amount),
      )
      flows.forEach((flow, i) => {
        if (flow.from !== undefined) used.set(flow.from, (used.get(flow.from) ?? 0) + shares[i])
        if (flow.source !== undefined) providers.get(flow.source)!.remaining -= shares[i]
      })
    }
  }
  return { type: 'known' as const, allocated, suppliers: suppliersByDemand }
}
