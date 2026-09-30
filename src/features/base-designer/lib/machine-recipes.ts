import { buildings, itemNameById } from '@/shared/data'
import type { Recipe, RecipeOutput } from '@/shared/@types/building.type'
import type { PlaceableType } from '../model/catalog'

/** Only real Crafter records have assignable recipes; missing game data stays unassigned. */
const sourceBuildingId: Partial<Record<PlaceableType, string>> = {
  refinery: 'refinery',
  assembler: 'fabricator',
  enrichment: 'enrichment',
}

const recipesByBuildingId = new Map(buildings.map((building) => [building.id, building.recipes]))

export function recipesForPlaceable(type: PlaceableType): readonly Recipe[] {
  const buildingId = sourceBuildingId[type]
  return buildingId ? (recipesByBuildingId.get(buildingId) ?? []) : []
}

export function recipeForPlaceable(type: PlaceableType, recipeId: string | undefined): Recipe | undefined {
  return recipeId ? recipesForPlaceable(type).find((recipe) => recipe.id === recipeId) : undefined
}

/** The catalog orders the main product first, followed by any co-products from the same operation. */
export function recipeOutputs(recipe: Recipe): readonly RecipeOutput[] {
  return [recipe.output, ...(recipe.extra_outputs ?? [])]
}

export function recipeLabel(recipe: Recipe): string {
  return itemNameById.get(recipe.output.id) ?? recipe.output.id
}
