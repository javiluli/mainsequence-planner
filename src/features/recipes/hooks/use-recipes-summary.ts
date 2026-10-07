import { buildings } from '@/shared/data'
import { getRecipesSummary } from '../lib/recipes-summary'

const recipesSummary = getRecipesSummary(buildings)

export const useRecipesSummary = () => recipesSummary
