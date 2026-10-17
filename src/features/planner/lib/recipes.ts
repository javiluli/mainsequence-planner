import type { PlanResolver } from './production-plan/types'
import { getRecipeYield } from './production-plan/recipe-yields'

/**
 * Presets one machine's net output using the same recipe resolver as the plan.
 * Raw items without a valid explicit recipe remain external, with a fallback of 1/min.
 */
export const getTargetPresetIpm = (resolver: PlanResolver, itemId: string, isRawTarget: boolean) => {
  if (isRawTarget && !resolver.hasSelectedRecipeForItem(itemId)) return 1

  const recipe = resolver.getRecipeForItem(itemId)
  return recipe ? getRecipeYield(recipe, itemId).netOutputRate : 1
}
