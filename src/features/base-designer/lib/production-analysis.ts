import { buildings as catalogBuildings } from '@/shared/data'
import type { Recipe } from '@/shared/@types/building.type'
import { BUILDINGS } from '../model/buildings'
import type { Scene } from '../model/scene'
import { recipeForBuilding } from './building-recipes'
import { portProductKey, type BeltNetwork } from './belt-network'
import {
  allocateComponent,
  allocationGeometry,
  cellKey,
  FLOW_TOLERANCE,
  itemSources,
  topologicalOrder,
  transportComponents,
  type Demand,
} from './production-allocation'

export { distributeSplitterFlow } from './production-allocation'

const catalogById = new Map(catalogBuildings.map((building) => [building.id, building]))

/** Four active LED states plus an unlit state when a nominal input estimate is unavailable. */
export type MachineState = 'ready' | 'wrong-item' | 'missing-input' | 'shortfall' | 'unknown'

/** Ingredient demand and reserved capacity in items/min; null means unknown supply, never measured delivery. */
export interface MachineInput {
  itemId: string
  demand: number
  available: number | null
  state: 'missing' | 'supplied' | 'shortfall' | 'unknown' | 'blocked'
  reason?: string
}

/** A received catalog item has a nominal transport rate, with no recipe demand or stored quantity. */
interface ReceivedItem {
  itemId: string
  demand: null
  available: number | null
  reason?: string
}

/** Per-building recipe inputs or storage reception are independent from canvas selection. */
export interface MachineAnalysis {
  state: MachineState
  inputs: readonly MachineInput[]
  unexpectedItems: readonly string[]
  /** Containers accept incoming flow; unidentified providers coexist with the known item IDs. */
  reception?: { items: readonly ReceivedItem[]; unknown: boolean }
  reason?: string
}

/** Whole-base rates in items/min retain nominal capacity separately; null preserves indeterminate supply.
 * Energy sums nominal catalog MJ and counts machines without a known value; it is not scaled by utilization.
 */
export interface ProductionAnalysis {
  machines: ReadonlyMap<string, MachineAnalysis>
  products: readonly {
    itemId: string
    output: number
    demand: number
    estimatedOutput: number | null
    suppliedInput: number | null
    requiredInput: number
    missingInput: number | null
  }[]
  energy: { known: number; unknown: number }
  recipes: readonly Recipe[]
}

/** Recipe diagnosis prioritizes incompatible/missing ingredients; storage reports reception without an ingredient demand. */
function machineState(machine: MachineAnalysis): MachineState {
  if (machine.reception) {
    if (machine.reception.unknown || machine.reception.items.some((item) => item.available === null)) return 'unknown'
    return machine.reception.items.some((item) => item.available !== null && item.available > FLOW_TOLERANCE) ? 'ready' : 'missing-input'
  }
  if (machine.unexpectedItems.length) return 'wrong-item'
  if (machine.inputs.some((input) => input.state === 'missing')) return 'missing-input'
  if (!machine.inputs.length || machine.inputs.some((input) => input.state === 'unknown')) return 'unknown'
  return machine.inputs.some((input) => input.state === 'shortfall') ? 'shortfall' : 'ready'
}

/** Estimate an output in items/min from the least-covered ingredient; blocked recipes yield zero, uncertain supply stays unknown. */
export function estimatedMachineOutput(machine: MachineAnalysis, nominalRate: number): number | null {
  if (machine.state === 'wrong-item' || machine.state === 'missing-input') return 0
  if (machine.state === 'unknown') return null
  return nominalRate * machine.inputs.reduce((ratio, input) => Math.min(ratio, input.available! / input.demand), 1)
}

/** Analyze confirmed layouts in order: prepare demands, allocate transport, propagate uncertainty, then aggregate.
 * Blocked machines release quota; upstream failures stay indeterminate. This never steps time or changes the scene/network.
 */
export function analyzeProduction(scene: Scene, network: BeltNetwork): ProductionAnalysis {
  const machines = new Map<string, MachineAnalysis>(),
    recipes: Recipe[] = []
  const totals = new Map<string, ProductionAnalysis['products'][number]>()
  const demands = new Map<string, Demand[]>()
  const dependencyRows = new Map<string, { ownerId: string; input: MachineInput | ReceivedItem }[]>()
  const dependencies = new Map<string, string[]>()
  const receiving = new Map<string, typeof network.portBridges>()
  const geometry = allocationGeometry(scene, network)
  for (const port of network.portBridges)
    if (port.role === 'input' && port.enabled !== false) receiving.set(port.ownerId, [...(receiving.get(port.ownerId) ?? []), port])
  let known = 0,
    unknown = 0
  const total = (itemId: string) => {
    const row = totals.get(itemId) ?? {
      itemId,
      output: 0,
      demand: 0,
      estimatedOutput: 0,
      suppliedInput: 0,
      requiredInput: 0,
      missingInput: 0,
    }
    totals.set(itemId, row)
    return row
  }
  // Prepare every receiver first: a blocked recipe releases every candidate demand before any allocation.
  for (const building of scene.buildings) {
    const crafterId = BUILDINGS[building.type].crafterId,
      power = crafterId ? catalogById.get(crafterId)?.power : undefined
    if (power === undefined) unknown++
    else known += power
    const recipe = recipeForBuilding(building.type, building.recipeId)
    const machine: MachineAnalysis = { state: 'unknown', inputs: [], unexpectedItems: [] }
    machines.set(building.id, machine)
    if (building.type === 'container') {
      const ports = receiving.get(building.id) ?? [],
        products = ports.map((port) => network.portProducts.get(portProductKey(building.id, port.portKey))),
        itemIds = [...new Set(products.flatMap((product) => product?.items ?? []))].sort()
      machine.reception = {
        items: itemIds.map((itemId) => ({ itemId, demand: null, available: null })),
        unknown: products.some((product) => product?.unknown),
      }
      if (machine.reception.unknown) machine.reason = 'Some incoming items cannot be identified.'
      for (const itemId of itemIds) {
        const cells = [
            ...new Set(
              ports.filter((_, i) => products[i]?.items.includes(itemId) || products[i]?.unknown).map((port) => cellKey(port.cell)),
            ),
          ],
          // This finite acceptance bound comes only from incoming transport, never from a storage limit.
          amount = cells.reduce((sum, cell) => sum + (network.capacities.get(cell) ?? 0), 0)
        demands.set(itemId, [...(demands.get(itemId) ?? []), { buildingId: building.id, itemId, amount, cells }])
      }
      continue
    }
    if (!recipe) {
      machine.reason = crafterId ? 'Choose a recipe.' : 'No production recipe data.'
      continue
    }
    recipes.push(recipe)
    for (const output of [recipe.output, ...(recipe.extra_outputs ?? [])]) total(output.id).output += output.amount_per_minute
    const required = new Map<string, number>()
    for (const input of recipe.inputs) required.set(input.id, (required.get(input.id) ?? 0) + input.amount_per_minute)
    const ports = receiving.get(building.id) ?? []
    const arriving = ports.flatMap((port) => network.portProducts.get(portProductKey(building.id, port.portKey))?.items ?? [])
    machine.unexpectedItems = [...new Set(arriving.filter((item) => !required.has(item)))]
    const inputs: MachineInput[] = []
    const candidates: Demand[] = []
    for (const [itemId, amount] of required) {
      total(itemId).demand += amount
      const matching = ports.filter((port) => {
        const product = network.portProducts.get(portProductKey(building.id, port.portKey))
        return product?.items.includes(itemId) || product?.unknown
      })
      inputs.push({ itemId, demand: amount, available: matching.length ? null : 0, state: matching.length ? 'unknown' : 'missing' })
      if (matching.length)
        candidates.push({ buildingId: building.id, itemId, amount, cells: [...new Set(matching.map((port) => cellKey(port.cell)))] })
    }
    machine.inputs = inputs
    const blocked = machine.unexpectedItems.length > 0 || inputs.some((input) => input.state === 'missing')
    for (const input of inputs)
      if (blocked && input.state !== 'missing') {
        input.state = 'blocked'
        input.available = 0
        input.reason = 'Waiting for another ingredient or a compatible item.'
      }
    if (!blocked) for (const demand of candidates) demands.set(demand.itemId, [...(demands.get(demand.itemId) ?? []), demand])
    machine.state = recipe.inputs.length ? machineState(machine) : 'ready'
  }
  // Pool faces by provider/ingredient before allocating; keep placement and insertion order as priority inputs.
  for (const [itemId, rows] of demands) {
    const sources = itemSources(scene, network, itemId),
      component = transportComponents(network, sources, rows)
    const grouped = new Map<number, Demand[]>()
    for (const row of rows) {
      const id = component.get(row.cells[0])!,
        group = grouped.get(id) ?? []
      group.push(row)
      grouped.set(id, group)
    }
    for (const [id, group] of grouped) {
      const result = allocateComponent(
        geometry,
        network,
        sources.filter((source) => component.get(source.cell) === id),
        group,
      )
      for (const demand of group) {
        const machine = machines.get(demand.buildingId)!
        const input: MachineInput | ReceivedItem = machine.reception
          ? machine.reception.items.find((item) => item.itemId === itemId)!
          : machine.inputs.find((input) => input.itemId === itemId)!
        if (result.type === 'unknown') {
          input.reason = result.reason
          continue
        }
        input.available = result.allocated.get(demand.buildingId) ?? 0
        if (input.demand !== null) input.state = input.available + FLOW_TOLERANCE < input.demand ? 'shortfall' : 'supplied'
        for (const supplierId of result.suppliers.get(demand.buildingId) ?? [])
          if (machines.has(supplierId)) {
            const pending = dependencyRows.get(supplierId) ?? []
            pending.push({ ownerId: demand.buildingId, input })
            dependencyRows.set(supplierId, pending)
            const next = dependencies.get(supplierId) ?? []
            if (!next.includes(demand.buildingId)) next.push(demand.buildingId)
            dependencies.set(supplierId, next)
          }
      }
    }
  }
  // Apply upstream uncertainty after all allocations; provenance follows reachability, not only charged flow.
  for (const machine of machines.values()) if (machine.inputs.length || machine.reception) machine.state = machineState(machine)
  const { degree } = topologicalOrder([...machines.keys()], dependencies)
  const unresolved = [...degree].filter(([, count]) => count > 0).map(([id]) => id)
  for (const id of unresolved) {
    const machine = machines.get(id)!
    const inputs: readonly (MachineInput | ReceivedItem)[] = machine.reception?.items ?? machine.inputs
    for (const input of inputs)
      if (!('state' in input) || input.state === 'supplied' || input.state === 'shortfall') {
        if ('state' in input) input.state = 'unknown'
        input.available = null
        input.reason = 'Circular production dependency.'
      }
    machine.state = machineState(machine)
  }
  const queue = [...machines].filter(([, machine]) => machine.state !== 'ready').map(([id]) => id),
    visited = new Set<string>()
  for (let i = 0; i < queue.length; i++) {
    const id = queue[i]
    if (visited.has(id)) continue
    visited.add(id)
    for (const { ownerId, input } of dependencyRows.get(id) ?? []) {
      if ('state' in input) input.state = 'unknown'
      input.available = null
      input.reason = 'Supply is limited upstream.'
      const machine = machines.get(ownerId)!
      machine.state = machineState(machine)
      queue.push(ownerId)
    }
  }
  // Aggregate final states, preserving the distinct meanings of unknown supply and quota released by blocking.
  for (const building of scene.buildings) {
    const recipe = recipeForBuilding(building.type, building.recipeId),
      machine = machines.get(building.id)!
    if (!recipe) continue
    for (const output of [recipe.output, ...(recipe.extra_outputs ?? [])]) {
      const row = totals.get(output.id)!,
        estimate = estimatedMachineOutput(machine, output.amount_per_minute)
      row.estimatedOutput = row.estimatedOutput === null || estimate === null ? null : row.estimatedOutput + estimate
    }
    for (const input of machine.inputs) {
      // Released quota does not prove that the otherwise connected ingredient is missing.
      if (input.state === 'blocked') continue
      const row = totals.get(input.itemId)!
      row.requiredInput += input.demand
      row.suppliedInput = row.suppliedInput === null || input.available === null ? null : row.suppliedInput + input.available
      row.missingInput =
        row.missingInput === null || input.available === null ? null : row.missingInput + Math.max(0, input.demand - input.available)
    }
  }
  return { machines, products: [...totals.values()], recipes, energy: { known, unknown } }
}
