import { itemById } from '@/shared/data'
import type { Item } from '@/shared/@types/item.type'
import type { Recipe, RecipeOutput } from '@/shared/@types/building.type'
import { PLACEABLES, type PlaceableType } from '../../model/catalog'
import { catalogBuildingForPlaceable } from './catalog-machines'

export function isProductMachine(type: PlaceableType): boolean {
  return PLACEABLES[type].paletteGroup === 'production'
}

export function recipesForPlaceable(type: PlaceableType, inputItems?: ReadonlySet<string>): readonly Recipe[] {
  const recipes = catalogBuildingForPlaceable(type)?.recipes ?? []
  // This is a union of possible recipes, not proof that all ingredients are supplied.
  return inputItems?.size ? recipes.filter((recipe) => recipe.inputs.some((input) => inputItems.has(input.id))) : recipes
}

export function recipeForPlaceable(type: PlaceableType, recipeId: string | undefined): Recipe | undefined {
  return recipeId ? recipesForPlaceable(type).find((recipe) => recipe.id === recipeId) : undefined
}

/** The catalog orders the main product first, followed by any co-products from the same operation. */
export function recipeOutputs(recipe: Recipe): readonly RecipeOutput[] {
  return [recipe.output, ...(recipe.extra_outputs ?? [])]
}

/** The visual picker lists each primary product once, regardless of alternative recipes. */
export function machineProductItems(type: PlaceableType, inputItems?: ReadonlySet<string>): Item[] {
  const products = new Map<string, Item>()
  for (const recipe of recipesForPlaceable(type, inputItems)) {
    const item = itemById.get(recipe.output.id)
    if (recipe.id && item) products.set(item.id, item)
  }
  return [...products.values()]
}

/** Keep an existing alternative when relabeling the same product; no rates are calculated. */
export function recipeForProduct(
  type: PlaceableType,
  itemId: string,
  currentRecipeId?: string,
  inputItems?: ReadonlySet<string>,
): Recipe | undefined {
  const current = recipeForPlaceable(type, currentRecipeId)
  return current?.output.id === itemId
    ? current
    : recipesForPlaceable(type, inputItems).find((recipe) => recipe.id && recipe.output.id === itemId)
}
