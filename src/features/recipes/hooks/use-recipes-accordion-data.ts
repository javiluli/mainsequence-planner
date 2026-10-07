import { buildings, itemById } from '@/shared/data'

const buildingsWithRecipes = buildings.filter((building) => building.recipes.length > 0)

export const useRecipesAccordionData = () => ({
  buildingsWithRecipes,
  itemMap: itemById,
})
