import { buildings, itemById } from '@/shared/data'
import { hasRecipes } from '../lib/has-recipes'

const buildingsWithRecipes = buildings.filter(hasRecipes)

export const useRecipesAccordionData = () => ({
  buildingsWithRecipes,
  itemMap: itemById,
})
