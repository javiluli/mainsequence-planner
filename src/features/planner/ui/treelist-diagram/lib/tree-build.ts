import type { ProductionPlan, ProductionStep } from '../../../lib'
import { buildProductionConnections, type ProductionConnection } from '../../../lib/production-plan/production-connections'
import type { TreeNodeData } from '../types'

/** Retains recipe identity while calculating machine requirements for this branch only. */
const buildNodeData = (step: ProductionStep, targetIpm: number): TreeNodeData => {
  const buildingLoad = targetIpm / step.recipeOutputIpm
  return { ...step, targetIpm, buildingLoad, buildingCount: Math.ceil(buildingLoad) }
}

const buildSupplyNode = (itemId: string, supplyIpm: number): TreeNodeData => ({
  itemId,
  targetIpm: supplyIpm,
  supplyCount: supplyIpm,
  isSupply: true,
  buildingName: 'Supply',
  children: [],
})

/**
 * Projects confirmed plan connections into a dependency tree without resolving recipes again.
 * Each consumer's connections are divided in proportion to its production in each branch;
 * summing those branches preserves the original external, supply and coproduct rates.
 * Coproduct leaves reference their source instead of expanding its production a second time.
 * Only branch machine counts are rounded; physical totals remain owned by ProductionPlan.
 * External-only and invalid plans have no production tree. The caller renders their existing states.
 */
export const buildTree = (plan: ProductionPlan): TreeNodeData | null => {
  if (plan.issues.length || !plan.steps.length) return null

  const stepsByItem = new Map(plan.steps.map((step) => [step.itemId, step]))
  const rootStep = stepsByItem.get(plan.targetId)
  if (!rootStep) return null

  const incoming = new Map<string, ProductionConnection[]>()
  for (const connection of buildProductionConnections(plan.steps, plan.supplyCountInventory, plan.byproductAllocations)) {
    const group = incoming.get(connection.target) ?? []
    // The ledger can confirm one link in several requests; display one origin per consumer.
    const existing = group.find(
      (entry) => entry.kind === connection.kind && entry.source === connection.source && entry.itemId === connection.itemId,
    )
    if (existing) existing.amountPerMinute += connection.amountPerMinute
    else group.push({ ...connection })
    incoming.set(connection.target, group)
  }

  /** Expands a production share using only connections already attributed to this consumer. */
  const buildBranch = (itemId: string, targetIpm: number): TreeNodeData => {
    const step = stepsByItem.get(itemId)
    if (!step) return { itemId, targetIpm, isRawMaterial: true, children: [] }

    const share = targetIpm / step.targetIpm
    const children = (incoming.get(itemId) ?? []).map((connection): TreeNodeData => {
      const amount = connection.amountPerMinute * share
      if (connection.kind === 'supply') return buildSupplyNode(connection.itemId, amount)
      if (connection.kind === 'coproduct') {
        return { itemId: connection.itemId, targetIpm: amount, coproductSourceItemId: connection.source, children: [] }
      }
      return buildBranch(connection.source, amount)
    })
    return { ...buildNodeData(step, targetIpm), children }
  }

  const children: TreeNodeData[] = []
  const suppliedTarget = Math.min(plan.targetIpm, plan.supplyCountInventory[plan.targetId] ?? 0)
  if (suppliedTarget > 0) children.push(buildSupplyNode(plan.targetId, suppliedTarget))
  children.push(buildBranch(plan.targetId, rootStep.targetIpm))

  return {
    itemId: plan.targetId,
    targetIpm: plan.targetIpm,
    buildingName: rootStep.buildingName,
    isFinalProduct: true,
    children,
  }
}
