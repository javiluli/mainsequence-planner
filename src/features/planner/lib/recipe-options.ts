import type { Building, RecipeInput } from '@/shared/@types/building.type'

export interface RecipeChoice {
  id: string
  buildingId: string
  buildingName: string
  outputPerMinute: number
  inputs: readonly RecipeInput[]
}

/** List all proven production paths, placing normal-ore routes before optional enriched routes. */
export const getRecipeChoicesForItem = (buildings: readonly Building[], itemId: string): RecipeChoice[] => {
  const choices: RecipeChoice[] = []

  for (const building of buildings) {
    for (const recipe of building.recipes) {
      if (recipe.output.id !== itemId || !recipe.id) continue
      choices.push({
        id: recipe.id,
        buildingId: building.id,
        buildingName: building.name,
        outputPerMinute: recipe.output.amount_per_minute,
        inputs: recipe.inputs,
      })
    }
  }

  // Higher plate yield does not imply lower electricity or machine count: never auto-select enrichment as an optimization.
  return choices.sort((left, right) => Number(left.id.startsWith('enriched_')) - Number(right.id.startsWith('enriched_')))
}
