import type { ByproductAllocation, PlanResolver, ProductionPlanIssue } from './types'
import { normalizeSupplyCountByItem } from '../supply-count'
import { getRecipeYield } from './recipe-yields'

const EPSILON = 1e-9

/** A fresh copy of configured external supply prevents sibling branches sharing mutable caller state. */
export const buildSupplyCountInventory = (supplyCountByItem: Record<string, number>) => normalizeSupplyCountByItem(supplyCountByItem)

export interface DemandRequest {
  itemId: string
  consumerItemId: string | null
  /** Requirement remaining after independent, user-configured external supply. */
  deficitIpm: number
}

export interface DemandResult {
  totals: Map<string, number>
  issues: ProductionPlanIssue[]
  requests: DemandRequest[]
  byproductAllocations: ByproductAllocation[]
}

/**
 * Expand a selected recipe graph with a per-consumer coproduct budget. The budget is never
 * treated as external supply and can be consumed only once. A first pass may defer missing
 * recipes so an independent sibling's verified byproduct can satisfy them on the final pass.
 */
export const calculateTotals = (
  resolver: PlanResolver,
  targetId: string,
  targetIpm: number,
  supplyCountByItem: Record<string, number>,
  rawItemIds: ReadonlySet<string> = new Set<string>(),
  byproductCredits: readonly ByproductAllocation[] = [],
  deferMissingRecipes = false,
  producedRawItemIds: ReadonlySet<string> = new Set<string>(),
): DemandResult => {
  const totals = new Map<string, number>()
  const issues: ProductionPlanIssue[] = []
  const requests: DemandRequest[] = []
  const byproductAllocations: ByproductAllocation[] = []
  const inventory = buildSupplyCountInventory(supplyCountByItem)
  const credits = byproductCredits.map((credit) => ({ ...credit }))
  const activePath: string[] = []

  const fail = (code: ProductionPlanIssue['code'], itemId: string, message: string, path?: string[]) => {
    issues.push({ code, itemId, message, ...(path ? { path } : {}) })
  }

  const requestItems = (itemId: string, amountNeeded: number, consumerItemId: string | null = null) => {
    if (issues.length) return
    if (!Number.isFinite(amountNeeded) || amountNeeded <= 0) {
      fail('invalid-rate', itemId, `Invalid demand for ${itemId}: production rates must be finite and positive.`)
      return
    }

    const available = inventory[itemId] ?? 0
    const supplied = Math.min(amountNeeded, available)
    if (inventory[itemId] !== undefined) inventory[itemId] -= supplied
    let debt = amountNeeded - supplied
    if (debt <= EPSILON) return
    requests.push({ itemId, consumerItemId, deficitIpm: debt })

    // A coproduct is attributed to its real producer and the exact consumer, not added to inventory.
    if (consumerItemId) {
      for (const credit of credits) {
        if (credit.itemId !== itemId || credit.consumerItemId !== consumerItemId || credit.amountPerMinute <= 0) continue
        const applied = Math.min(debt, credit.amountPerMinute)
        if (applied <= EPSILON) continue
        credit.amountPerMinute -= applied
        debt -= applied
        byproductAllocations.push({
          sourceItemId: credit.sourceItemId,
          consumerItemId,
          itemId,
          amountPerMinute: applied,
        })
        if (debt <= EPSILON) return
      }
    }

    if (rawItemIds.has(itemId) && !producedRawItemIds.has(itemId)) {
      totals.set(itemId, (totals.get(itemId) ?? 0) + debt)
      return
    }

    const cycleStart = activePath.indexOf(itemId)
    if (cycleStart !== -1) {
      const path = [...activePath.slice(cycleStart), itemId]
      fail('cycle', itemId, `Circular production dependency: ${path.join(' → ')}. Select another recipe or provide external supply.`, path)
      return
    }

    const recipe = resolver.getRecipeForItem(itemId)
    if (!recipe) {
      if (!deferMissingRecipes) {
        fail('missing-recipe', itemId, `No production recipe found for ${itemId}. Check the catalog or provide external supply.`)
      }
      return
    }

    const outputRate = recipe.output.amount_per_minute
    if (recipe.output.id !== itemId || !Number.isFinite(outputRate) || outputRate <= 0) {
      fail(
        'invalid-rate',
        itemId,
        `Invalid recipe output for ${itemId}: the selected recipe must produce this item at a positive finite rate.`,
      )
      return
    }

    for (const input of recipe.inputs) {
      if (!input.id || !Number.isFinite(input.amount_per_minute) || input.amount_per_minute <= 0) {
        fail('invalid-rate', itemId, `Invalid input in recipe ${recipe.id ?? itemId}: item IDs and input rates must be valid.`)
        return
      }
    }

    for (const output of recipe.extra_outputs ?? []) {
      if (!output.id || !Number.isFinite(output.amount_per_minute) || output.amount_per_minute <= 0 || output.id === itemId) {
        fail(
          'invalid-rate',
          itemId,
          `Invalid byproduct in recipe ${recipe.id ?? itemId}: its ID and rate must be valid and distinct from the primary output.`,
        )
        return
      }
    }

    const { netOutputRate, externalInputs } = getRecipeYield(recipe, itemId)
    if (!Number.isFinite(netOutputRate) || netOutputRate <= 0) {
      fail('invalid-rate', itemId, `Recipe ${recipe.id ?? itemId} has no positive net output after internal recycling.`)
      return
    }

    const cumulativeDemand = (totals.get(itemId) ?? 0) + debt
    if (!Number.isFinite(cumulativeDemand)) {
      fail('invalid-rate', itemId, `Production demand for ${itemId} exceeds finite calculation limits.`)
      return
    }
    totals.set(itemId, cumulativeDemand)

    activePath.push(itemId)
    for (const input of externalInputs) {
      const inputDemand = (input.amount_per_minute / netOutputRate) * debt
      requestItems(input.id, inputDemand, itemId)
      if (issues.length) break
    }
    activePath.pop()
  }

  if (targetId) requestItems(targetId, targetIpm)
  return { totals, issues, requests, byproductAllocations }
}
