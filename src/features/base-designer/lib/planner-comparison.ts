import { getPlanProductionStages, summarizeRequiredBuildings, type ProductionPlan } from '@/features/planner'
import { BUILDINGS } from '../model/buildings'
import type { Scene } from '../model/scene'
import { recipeForBuilding } from './building-recipes'

/** Counts and net nominal recipe capacities are comparable to a plan; they remain independent of delivery feasibility. */
export function compareWithPlanner(scene: Scene, plan: ProductionPlan | null | undefined) {
  if (!plan || plan.issues.length) return null
  const placed = new Map<string, number>(),
    netOutputs = new Map<string, number>()
  for (const building of scene.buildings) {
    const crafter = BUILDINGS[building.type].crafterId
    if (crafter) placed.set(crafter, (placed.get(crafter) ?? 0) + 1)
    const recipe = recipeForBuilding(building.type, building.recipeId)
    if (!recipe) continue
    for (const output of [recipe.output, ...(recipe.extra_outputs ?? [])]) {
      const recycled = recipe.inputs.filter((input) => input.id === output.id).reduce((sum, input) => sum + input.amount_per_minute, 0)
      netOutputs.set(output.id, (netOutputs.get(output.id) ?? 0) + output.amount_per_minute - recycled)
    }
  }
  const required = new Map<string, number>()
  const coproductCredit = new Map<string, number>()
  for (const step of plan.steps) required.set(step.itemId, (required.get(step.itemId) ?? 0) + step.targetIpm)
  // Step demand already excludes credited coproducts; compare the base's combined output with that credit included once.
  for (const allocation of plan.byproductAllocations ?? []) {
    required.set(allocation.itemId, (required.get(allocation.itemId) ?? 0) + allocation.amountPerMinute)
    coproductCredit.set(allocation.itemId, (coproductCredit.get(allocation.itemId) ?? 0) + allocation.amountPerMinute)
  }
  const stages = getPlanProductionStages(plan)
  return {
    buildings: summarizeRequiredBuildings(plan.steps).map((building) => ({
      id: building.buildingId,
      name: building.buildingName,
      needed: building.buildingCount,
      placed: placed.get(building.buildingId) ?? 0,
      supported: Object.values(BUILDINGS).some((type) => type.crafterId === building.buildingId),
    })),
    products: [...required]
      .sort(([a], [b]) => (stages.get(a) ?? 0) - (stages.get(b) ?? 0) || a.localeCompare(b))
      .map(([itemId, needed]) => ({
        itemId,
        needed,
        capacity: netOutputs.get(itemId) ?? 0,
        coproductCredit: coproductCredit.get(itemId) ?? 0,
      })),
    externalInputs: plan.rawInputs,
    supplied: Object.entries(plan.supplyCountByItem).filter(([, amount]) => amount > 0),
    coproducts: plan.byproductAllocations ?? [],
  }
}
