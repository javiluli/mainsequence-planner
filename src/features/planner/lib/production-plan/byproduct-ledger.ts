import type { ByproductAllocation, PlanResolver } from './types'
import { calculateTotals, type DemandResult } from './calculate-totals'
import { getRecipeYield } from './recipe-yields'

const EPSILON = 1e-8

/** One source's independently available output; never a fictional second machine or external delivery. */
interface SourceBudget {
  sourceItemId: string
  itemId: string
  remaining: number
}

/**
 * Conservatively allocate verified coproducts across all consumers. A production dependency
 * cannot be paid for by its own downstream result; if an allocation reduces its producer's
 * actual load, that producer's credits are removed and the plan is recalculated.
 */
export const calculateWithByproducts = (
  resolver: PlanResolver,
  targetId: string,
  targetIpm: number,
  supplyCountByItem: Record<string, number>,
  rawItemIds: ReadonlySet<string>,
  producedRawItemIds: ReadonlySet<string>,
): DemandResult => {
  const initial = calculateTotals(resolver, targetId, targetIpm, supplyCountByItem, rawItemIds, [], true, producedRawItemIds)
  if (initial.issues.length) return initial

  const budgets: SourceBudget[] = []
  const dependencies = new Map<string, Set<string>>()
  initial.totals.forEach((required, sourceItemId) => {
    const recipe = resolver.getRecipeForItem(sourceItemId)
    if (!recipe) return
    const { netOutputRate, externalInputs } = getRecipeYield(recipe, sourceItemId)
    dependencies.set(sourceItemId, new Set(externalInputs.map((input) => input.id)))
    for (const output of recipe.extra_outputs ?? []) {
      const produced = (output.amount_per_minute / netOutputRate) * required
      const existing = budgets.find((budget) => budget.sourceItemId === sourceItemId && budget.itemId === output.id)
      if (existing) existing.remaining += produced
      else budgets.push({ sourceItemId, itemId: output.id, remaining: produced })
    }
  })
  budgets.sort((left, right) => left.sourceItemId.localeCompare(right.sourceItemId) || left.itemId.localeCompare(right.itemId))

  // A credit adds a dependency from consumer to producer. Reject any edge that closes a cycle.
  const dependsOn = (from: string, target: string, seen = new Set<string>()): boolean => {
    if (from === target) return true
    if (seen.has(from)) return false
    seen.add(from)
    for (const dependency of dependencies.get(from) ?? []) {
      if (dependsOn(dependency, target, seen)) return true
    }
    return false
  }

  const deficits = new Map<string, { itemId: string; consumerItemId: string; amount: number }>()
  for (const request of initial.requests) {
    if (!request.consumerItemId) continue
    const key = `${request.itemId}\u0000${request.consumerItemId}`
    const existing = deficits.get(key)
    if (existing) existing.amount += request.deficitIpm
    else deficits.set(key, { itemId: request.itemId, consumerItemId: request.consumerItemId, amount: request.deficitIpm })
  }

  const proposed: ByproductAllocation[] = []
  const sortedDeficits = [...deficits.values()].sort(
    (left, right) => left.itemId.localeCompare(right.itemId) || left.consumerItemId.localeCompare(right.consumerItemId),
  )
  for (const deficit of sortedDeficits) {
    let remaining = deficit.amount
    for (const source of budgets) {
      if (source.itemId !== deficit.itemId || source.remaining <= EPSILON || dependsOn(source.sourceItemId, deficit.consumerItemId)) {
        continue
      }
      const applied = Math.min(remaining, source.remaining)
      if (applied <= EPSILON) continue
      proposed.push({
        sourceItemId: source.sourceItemId,
        consumerItemId: deficit.consumerItemId,
        itemId: deficit.itemId,
        amountPerMinute: applied,
      })
      source.remaining -= applied
      remaining -= applied
      const consumerDependencies = dependencies.get(deficit.consumerItemId) ?? new Set<string>()
      consumerDependencies.add(source.sourceItemId)
      dependencies.set(deficit.consumerItemId, consumerDependencies)
      if (remaining <= EPSILON) break
    }
  }

  // Missing recipes are reported normally if no independent producer can cover their demand.
  if (!proposed.length) return calculateTotals(resolver, targetId, targetIpm, supplyCountByItem, rawItemIds, [], false, producedRawItemIds)

  let enabled = proposed
  for (let attempt = 0; attempt <= proposed.length; attempt += 1) {
    const result = calculateTotals(resolver, targetId, targetIpm, supplyCountByItem, rawItemIds, enabled, false, producedRawItemIds)
    if (result.issues.length) return result
    const unstable = new Set<string>()
    for (const credit of result.byproductAllocations) {
      const sourceRecipe = resolver.getRecipeForItem(credit.sourceItemId)
      const sourceDemand = result.totals.get(credit.sourceItemId) ?? 0
      const yieldRate = sourceRecipe ? getRecipeYield(sourceRecipe, credit.sourceItemId).netOutputRate : 0
      let outputRate = 0
      for (const output of sourceRecipe?.extra_outputs ?? []) {
        if (output.id === credit.itemId) outputRate += output.amount_per_minute
      }
      const generated = yieldRate > 0 ? (sourceDemand / yieldRate) * outputRate : 0
      const allocated = result.byproductAllocations
        .filter((entry) => entry.sourceItemId === credit.sourceItemId && entry.itemId === credit.itemId)
        .reduce((sum, entry) => sum + entry.amountPerMinute, 0)
      if (!Number.isFinite(generated) || allocated > generated + EPSILON) unstable.add(credit.sourceItemId)
    }
    if (!unstable.size) return result
    enabled = enabled.filter((allocation) => !unstable.has(allocation.sourceItemId))
    if (!enabled.length) break
  }
  return calculateTotals(resolver, targetId, targetIpm, supplyCountByItem, rawItemIds, [], false, producedRawItemIds)
}
