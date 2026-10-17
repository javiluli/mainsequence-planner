import { buildings, items, producerBuildingsByItemId } from '@/shared/data'
import type { Recipe } from '@/shared/@types/building.type'
import { buildPlanResolver } from './plan-resolver'
import { buildProductionConnections } from './production-connections'
import type { ProductionPlan } from './types'

/** Sources occupy stage zero; each product follows its deepest prerequisite. Cycles retain a finite fallback rank. */
export function getProductionStageRanks(
  nodeIds: readonly string[],
  connections: readonly { source: string; target: string }[],
): ReadonlyMap<string, number> {
  const stageById = new Map(nodeIds.map((id) => [id, 0]))
  const incomingCount = new Map(nodeIds.map((id) => [id, 0]))
  const outgoing = new Map<string, string[]>()
  for (const { source, target } of connections) {
    if (!stageById.has(source) || !stageById.has(target)) continue
    const targets = outgoing.get(source) ?? []
    targets.push(target)
    outgoing.set(source, targets)
    incomingCount.set(target, (incomingCount.get(target) ?? 0) + 1)
  }
  const queue = nodeIds.filter((id) => incomingCount.get(id) === 0)
  for (let index = 0; index < queue.length; index++) {
    const sourceId = queue[index]
    for (const targetId of outgoing.get(sourceId) ?? []) {
      stageById.set(targetId, Math.max(stageById.get(targetId) ?? 0, (stageById.get(sourceId) ?? 0) + 1))
      const remaining = (incomingCount.get(targetId) ?? 0) - 1
      incomingCount.set(targetId, remaining)
      if (remaining === 0) queue.push(targetId)
    }
  }
  return stageById
}

/** Uses the same source IDs and credited flows as Planner's Stages view, without constructing React Flow nodes. */
export function getPlanProductionStages(plan: ProductionPlan): ReadonlyMap<string, number> {
  return getProductionStageRanks(
    [
      ...Object.entries(plan.supplyCountByItem)
        .filter(([, amount]) => Number.isFinite(amount) && amount > 0)
        .map(([id]) => `supply-${id}`),
      ...plan.rawInputs.map((input) => input.itemId),
      ...plan.steps.map((step) => step.itemId),
    ],
    buildProductionConnections(plan.steps, plan.supplyCountInventory, plan.byproductAllocations),
  )
}

const catalogResolver = buildPlanResolver(buildings, producerBuildingsByItemId)
const rawItemIds = new Set(items.filter((item) => item.type === 'raw').map((item) => item.id))

/**
 * Derive full recipe ancestry even when a layout omits intermediate machines. Assigned alternatives
 * override Planner's neutral defaults; unassigned raw/external inputs stay stage-zero leaves.
 * This orders a catalog view only, without calculating demand or implying ingredient coverage.
 */
export function getCatalogProductionStages(itemIds: readonly string[], assignedRecipes: readonly Recipe[]): ReadonlyMap<string, number> {
  const assignedByItem = new Map<string, Recipe[]>()
  for (const recipe of assignedRecipes) {
    const assigned = assignedByItem.get(recipe.output.id) ?? []
    assigned.push(recipe)
    assignedByItem.set(recipe.output.id, assigned)
  }
  const nodes = new Set(itemIds)
  const visited = new Set<string>()
  const dependencies: { source: string; target: string }[] = []
  const visit = (itemId: string) => {
    if (visited.has(itemId)) return
    visited.add(itemId)
    nodes.add(itemId)
    const fallback = rawItemIds.has(itemId) ? null : catalogResolver.getRecipeForItem(itemId)
    const recipes = assignedByItem.get(itemId) ?? (fallback ? [fallback] : [])
    for (const recipe of recipes) {
      for (const input of recipe.inputs) {
        if (input.id === itemId) continue // Self-recycling does not add another production stage.
        dependencies.push({ source: input.id, target: itemId })
        visit(input.id)
      }
    }
  }
  itemIds.forEach(visit)
  const stages = new Map(getProductionStageRanks([...nodes], dependencies))
  // Co-products appear with their producer; they never become synthetic recipes for external-input leaves.
  for (const recipe of assignedRecipes) {
    for (const output of recipe.extra_outputs ?? []) {
      stages.set(output.id, Math.max(stages.get(output.id) ?? 0, stages.get(recipe.output.id) ?? 0))
    }
  }
  return stages
}
