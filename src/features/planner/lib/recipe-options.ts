import type { Building, RecipeInput } from '@/shared/@types/building.type'
import type { Item } from '@/shared/@types/item.type'
import type { ProductionPlan } from './production-plan/types'

/** One catalog route, retaining gross output and ingredient rates rather than calculated plan demand. */
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

/** An external raw option is a policy choice, not a catalog recipe or a fabricated machine. */
export type PlannerRecipeChoice = (RecipeChoice & { kind: 'recipe' }) | { kind: 'external'; id: '' }

/** One relevant product's routes; external raw groups deliberately omit a machine-rate badge. */
export interface RecipeOptionGroup {
  itemId: string
  targetIpm?: number
  choices: PlannerRecipeChoice[]
}

/**
 * Derives selectable routes from the current plan, including raw targets and ingredients
 * that have a real synthesis recipe, even when supply or coproducts cover their demand.
 * External input comes first for raw items; ordinary products retain their neutral recipe.
 * No plan rates, allocations or saved selections are recalculated or changed here.
 */
export const getPlanRecipeGroups = (
  plan: ProductionPlan,
  buildings: readonly Building[],
  itemById: ReadonlyMap<string, Item>,
): RecipeOptionGroup[] => {
  const stepsByItemId = new Map(plan.steps.map((step) => [step.itemId, step]))
  const itemIds = new Set(stepsByItemId.keys())
  const addRawItem = (itemId: string) => {
    if (itemById.get(itemId)?.type === 'raw') itemIds.add(itemId)
  }
  addRawItem(plan.targetId)
  plan.rawInputs.forEach((input) => addRawItem(input.itemId))
  plan.steps.forEach((step) => step.inputs.forEach((input) => addRawItem(input.id)))

  const groups: RecipeOptionGroup[] = []
  for (const itemId of itemIds) {
    const recipes = getRecipeChoicesForItem(buildings, itemId)
    const isRaw = itemById.get(itemId)?.type === 'raw'
    if (!recipes.length || (!isRaw && recipes.length < 2)) continue

    const choices: PlannerRecipeChoice[] = recipes.map((recipe) => ({ ...recipe, kind: 'recipe' }))
    if (isRaw) choices.unshift({ kind: 'external', id: '' })
    groups.push({ itemId, ...(!isRaw ? { targetIpm: stepsByItemId.get(itemId)?.targetIpm } : {}), choices })
  }
  return groups
}
