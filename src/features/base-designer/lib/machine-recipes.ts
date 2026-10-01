import { buildings, itemById } from '@/shared/data'
import type { Item } from '@/shared/@types/item.type'
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

/** The visual picker lists each primary product once, regardless of alternative recipes. */
export function machineProductItems(type: PlaceableType): Item[] {
  const products = new Map<string, Item>()
  for (const recipe of recipesForPlaceable(type)) {
    const item = itemById.get(recipe.output.id)
    if (recipe.id && item) products.set(item.id, item)
  }
  return [...products.values()]
}

/** Keep an existing alternative when relabeling the same product; no rates are calculated. */
export function recipeForProduct(type: PlaceableType, itemId: string, currentRecipeId?: string): Recipe | undefined {
  const current = recipeForPlaceable(type, currentRecipeId)
  return current?.output.id === itemId ? current : recipesForPlaceable(type).find((recipe) => recipe.id && recipe.output.id === itemId)
}
