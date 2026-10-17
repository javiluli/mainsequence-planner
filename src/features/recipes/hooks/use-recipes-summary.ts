import { buildings } from '@/shared/data'
import { getRecipesSummary } from '../lib/recipes-summary'

const recipesSummary = getRecipesSummary(buildings)

/** Returns the catalog totals calculated once, independently of accordion expansion. */
export const useRecipesSummary = () => recipesSummary
