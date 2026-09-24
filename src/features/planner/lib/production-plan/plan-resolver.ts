import type { Building, Recipe } from '@/shared/@types/building.type'
import type { PlanResolver } from './types'

/** A recipe selection is valid only when its exact ID produces the requested product. */
export const buildPlanResolver = (
  buildings: readonly Building[],
  producersByItemId: ReadonlyMap<string, readonly Building[]>,
  recipeIdByItemId: Record<string, string> = {},
): PlanResolver => {
  const selectedRecipeForItem = (itemId: string): { building: Building; recipe: Recipe } | null => {
    const selectedId = recipeIdByItemId[itemId]
    if (!selectedId) return null

    for (const building of producersByItemId.get(itemId) ?? []) {
      const recipe = building.recipes.find((entry) => entry.id === selectedId && entry.output.id === itemId)
      if (recipe) return { building, recipe }
    }
    // A removed recipe is not reused for an unrelated output; fall back to the normal-ore route.
    return null
  }

  const getBuildingForItem = (itemId: string): Building | null => {
    const chosen = selectedRecipeForItem(itemId)
    if (chosen) return chosen.building

    return producersByItemId.get(itemId)?.[0] ?? null
  }

  const getRecipeForItem = (itemId: string): Recipe | null => {
    const chosen = selectedRecipeForItem(itemId)
    if (chosen) return chosen.recipe

    const building = getBuildingForItem(itemId)
    const possible = building?.recipes.filter((recipe) => recipe.output.id === itemId) ?? []
    // Both normal and enriched plate recipes are real. The normal recipe is the neutral default,
    // not an unsupported claim that either total production chain is universally more efficient.
    return possible.find((recipe) => !recipe.id?.startsWith('enriched_')) ?? possible[0] ?? null
  }

  return {
    buildings,
    getBuildingForItem,
    getRecipeForItem,
  }
}
