import type { Building } from '@/shared/@types/building.type'

/** Counts real catalog recipes and their machines; machines without recipes do not contribute. */
export const getRecipesSummary = (buildings: readonly Building[]) => {
  const buildingsWithRecipes = buildings.filter((building) => building.recipes.length > 0)
  const recipesCount = buildingsWithRecipes.reduce((acc, building) => acc + building.recipes.length, 0)

  return {
    buildingsCount: buildingsWithRecipes.length,
    recipesCount,
  }
}
