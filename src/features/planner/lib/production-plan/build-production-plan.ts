import { buildSteps } from './build-steps'
import { buildSupplyCountInventory } from './calculate-totals'
import { calculateWithByproducts } from './byproduct-ledger'
import { buildPlanResolver } from './plan-resolver'
import type { BuildProductionPlanParams, ProductionPlan, ProductionStep } from './types'
import { getSteadyStateSupplyRates } from '../supply-count'

/** Calculates production buildings and total power without treating unknown power as zero. */
const computeStats = (steps: readonly ProductionStep[]) => {
  let power = 0
  let powerKnown = true
  let totalBuildings = 0

  steps.forEach((step) => {
    if (step.buildingPower === undefined) {
      powerKnown = false
    } else if (powerKnown) {
      power += step.buildingCount * step.buildingPower
    }

    totalBuildings += step.buildingCount
  })

  return { buildings: totalBuildings, power: powerKnown ? power : null }
}

/** Drops orphaned steps without removing prerequisites of the selected route. */
const pruneSteps = (steps: ProductionStep[], targetId: string) => {
  if (!steps.length) return steps
  const stepMap = new Map(steps.map((step) => [step.itemId, step]))
  const reachable = new Set<string>()

  const visit = (itemId: string) => {
    if (reachable.has(itemId)) return
    const step = stepMap.get(itemId)
    if (!step) return
    reachable.add(itemId)
    step.inputs.forEach((input) => visit(input.id))
  }

  visit(targetId)

  return steps.filter((step) => reachable.has(step.itemId))
}

/** Known recipes stay calculable with external leaves; only invalid rates or cycles invalidate totals. */
export const buildProductionPlan = ({
  buildings,
  producerBuildingsByItemId,
  targetId,
  targetIpm,
  isRawTarget,
  rawItemIds = new Set<string>(),
  externalItemIds = new Set<string>(),
  supplyCountByItem,
  recipeIdByItemId = {},
}: BuildProductionPlanParams): ProductionPlan => {
  // The legacy input property represents a continuous rate in items/min, never warehouse stock.
  const normalizedSupplyCountByItem = getSteadyStateSupplyRates({ kind: 'continuous-rate', rates: supplyCountByItem })
  const resolver = buildPlanResolver(buildings, producerBuildingsByItemId, recipeIdByItemId)
  const terminalItemIds = new Set([...rawItemIds, ...externalItemIds])
  const producedRawItemIds = new Set(Object.keys(recipeIdByItemId).filter((itemId) => rawItemIds.has(itemId)))
  const { totals, issues, byproductAllocations } = calculateWithByproducts(
    resolver,
    targetId,
    targetIpm,
    normalizedSupplyCountByItem,
    isRawTarget ? new Set([...terminalItemIds, targetId]) : terminalItemIds,
    producedRawItemIds,
  )
  const rawInputs = issues.length
    ? []
    : [...totals]
        .filter(
          ([itemId, amountPerMinute]) =>
            (terminalItemIds.has(itemId) || !resolver.getRecipeForItem(itemId)) && !producedRawItemIds.has(itemId) && amountPerMinute > 0,
        )
        .map(([itemId, amountPerMinute]) => ({ itemId, amountPerMinute }))
  const externalRawItemIds = new Set(rawInputs.map((input) => input.itemId))
  const steps = issues.length ? [] : pruneSteps(buildSteps(resolver, totals, normalizedSupplyCountByItem, externalRawItemIds), targetId)
  // An allocation budget measured in items/min, not a persistent inventory measured in items.
  const supplyCountInventory = buildSupplyCountInventory(normalizedSupplyCountByItem)

  return {
    targetId,
    targetIpm,
    isRawTarget,
    supplyCountByItem: normalizedSupplyCountByItem,
    supplyCountInventory,
    steps,
    rawInputs,
    stats: issues.length ? { buildings: 0, power: null } : computeStats(steps),
    issues,
    byproductAllocations: issues.length ? [] : byproductAllocations,
  }
}
