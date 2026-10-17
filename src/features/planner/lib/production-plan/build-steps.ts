import type { PlanResolver, ProductionStep } from './types'
import { getRecipeYield } from './recipe-yields'

/** Use net output for self-recycling, while reporting physical byproducts without spending them twice. */
export const buildSteps = (
  resolver: PlanResolver,
  totals: Map<string, number>,
  supplyCountByItem: Record<string, number>,
  externalRawItemIds: ReadonlySet<string>,
): ProductionStep[] => {
  const steps: ProductionStep[] = []

  totals.forEach((itemIpm, itemId) => {
    if (itemIpm <= 0 || externalRawItemIds.has(itemId)) return

    const selectedBuilding = resolver.getBuildingForItem(itemId)
    const selectedRecipe = resolver.getRecipeForItem(itemId)

    if (!selectedBuilding || !selectedRecipe) return

    const { netOutputRate, recycledRate, externalInputs } = getRecipeYield(selectedRecipe, itemId)
    const buildingLoad = itemIpm / netOutputRate

    const extraOutputs = selectedRecipe.extra_outputs?.map((output) => ({
      id: output.id,
      amount_per_minute: output.amount_per_minute * buildingLoad,
    }))

    steps.push({
      itemId,
      buildingId: selectedBuilding.id,
      buildingName: selectedBuilding.name,
      ...(selectedRecipe.id ? { recipeId: selectedRecipe.id } : {}),
      recipeOutputIpm: netOutputRate,
      targetIpm: itemIpm,
      buildingLoad,
      buildingCount: Math.ceil(buildingLoad),
      buildingPower: selectedBuilding.power,
      ...(selectedBuilding.construction_cost !== undefined ? { buildingConstructionCost: selectedBuilding.construction_cost } : {}),
      supplyCount: supplyCountByItem[itemId] || 0,
      inputs: externalInputs,
      ...(recycledRate > 0 ? { recycledIpm: recycledRate * buildingLoad } : {}),
      ...(extraOutputs?.length ? { extraOutputs } : {}),
    })
  })

  return steps
}
