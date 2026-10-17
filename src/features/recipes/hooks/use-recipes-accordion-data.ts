import { buildings, itemById } from '@/shared/data'

const buildingsWithRecipes = buildings.filter((building) => building.recipes.length > 0)

/** Shares recipe-bearing catalog machines and item labels without recalculating them per accordion row. */
export const useRecipesAccordionData = () => ({
  buildingsWithRecipes,
  itemMap: itemById,
})
