import type { Recipe } from '@/shared/@types/building.type'

/** A same-item ingredient circulates within one recipe: only output minus recirculation is available to the rest of the factory. */
export const getRecipeYield = (recipe: Recipe, itemId: string) => {
  const recycledRate = recipe.inputs.reduce((total, input) => total + (input.id === itemId ? input.amount_per_minute : 0), 0)

  return {
    netOutputRate: recipe.output.amount_per_minute - recycledRate,
    recycledRate,
    externalInputs: recipe.inputs.filter((input) => input.id !== itemId),
  }
}
