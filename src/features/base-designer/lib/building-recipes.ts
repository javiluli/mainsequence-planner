import { buildings, itemNameById } from '@/shared/data'
import type { Recipe } from '@/shared/@types/building.type'
import { BUILDINGS, type Building, type BuildingType } from '../model/buildings'

/** Only identified catalog recipes can become persistent machine assignments. */
type BuildingRecipe = Recipe & { id: string }

const recipesByCrafter = new Map(
  buildings.map((crafter) => [
    crafter.id,
    crafter.recipes
      .filter((recipe): recipe is BuildingRecipe => typeof recipe.id === 'string')
      .sort(
        (a, b) =>
          (itemNameById.get(a.output.id) ?? a.output.id).localeCompare(itemNameById.get(b.output.id) ?? b.output.id) ||
          a.id.localeCompare(b.id),
      ),
  ]),
)
const noRecipes: readonly BuildingRecipe[] = []

/** Offer the real Crafter's variants independently of adjacent belt products. */
export function recipesForBuilding(type: BuildingType): readonly BuildingRecipe[] {
  const crafter = BUILDINGS[type]?.crafterId
  return crafter ? (recipesByCrafter.get(crafter) ?? noRecipes) : noRecipes
}

/** Resolve an exact variant within this machine's compatible catalog recipes. */
export function recipeForBuilding(type: BuildingType, recipeId?: string): BuildingRecipe | undefined {
  return recipeId === undefined ? undefined : recipesForBuilding(type).find((recipe) => recipe.id === recipeId)
}

/** Shared trust-boundary rule for placement, clipboard and restored documents. */
export function isBuildingRecipeValid(building: Pick<Building, 'type' | 'recipeId'>): boolean {
  return building.recipeId === undefined || (typeof building.recipeId === 'string' && !!recipeForBuilding(building.type, building.recipeId))
}
