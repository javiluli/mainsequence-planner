import type { ByproductAllocation, ProductionStep } from './types'

export interface ProductionConnection {
  source: string
  target: string
  itemId: string
  amountPerMinute: number
  kind: 'coproduct' | 'supply' | 'production'
}

/**
 * Resolves credited coproducts, then external supply, then remaining production demand.
 * The graph and stage ordering share these directed connections; inventories are copied,
 * so deriving a view never consumes the confirmed plan's supply or coproduct allocations.
 */
export function buildProductionConnections(
  steps: readonly ProductionStep[],
  supplyCountInventory: Readonly<Record<string, number>>,
  byproductAllocations: readonly ByproductAllocation[] = [],
): ProductionConnection[] {
  const connections: ProductionConnection[] = []
  const supply = { ...supplyCountInventory }
  const credits = byproductAllocations.map((allocation) => ({ ...allocation }))

  for (const step of steps) {
    for (const input of step.inputs) {
      let remaining = (input.amount_per_minute / step.recipeOutputIpm) * step.targetIpm
      if (remaining <= 0) continue

      for (const credit of credits) {
        if (credit.consumerItemId !== step.itemId || credit.itemId !== input.id || credit.amountPerMinute <= 0) continue
        const used = Math.min(remaining, credit.amountPerMinute)
        if (used <= 1e-9) continue
        credit.amountPerMinute -= used
        remaining -= used
        connections.push({ source: credit.sourceItemId, target: step.itemId, itemId: input.id, amountPerMinute: used, kind: 'coproduct' })
        if (remaining <= 1e-9) break
      }
      if (remaining <= 1e-9) continue

      const available = supply[input.id] || 0
      if (available > 0) {
        const taken = Math.min(available, remaining)
        supply[input.id] -= taken
        remaining -= taken
        connections.push({ source: `supply-${input.id}`, target: step.itemId, itemId: input.id, amountPerMinute: taken, kind: 'supply' })
      }
      if (remaining > 0) {
        connections.push({ source: input.id, target: step.itemId, itemId: input.id, amountPerMinute: remaining, kind: 'production' })
      }
    }
  }
  return connections
}
