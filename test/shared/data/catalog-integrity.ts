import type { RawBuilding, RecipeOutput } from '@/shared/@types/building.type'
import type { RawItem } from '@/shared/@types/item.type'

export type CatalogIssueCode =
  'duplicate-item' | 'duplicate-building' | 'duplicate-recipe' | 'missing-item' | 'invalid-rate' | 'invalid-amount'

export interface CatalogIssue {
  code: CatalogIssueCode
  path: string
  id: string
}

/** Reports source defects rather than inventing missing records or silently fixing protected snapshots. */
export const inspectCatalog = (items: readonly RawItem[], buildings: readonly RawBuilding[]): CatalogIssue[] => {
  const issues: CatalogIssue[] = []
  const seenItems = new Set<string>()
  const seenBuildings = new Set<string>()
  const seenRecipes = new Set<string>()

  items.forEach((item, index) => {
    if (seenItems.has(item.id)) issues.push({ code: 'duplicate-item', path: `items[${index}]`, id: item.id })
    seenItems.add(item.id)
  })

  const checkOutput = (output: RecipeOutput, path: string) => {
    if (!seenItems.has(output.id)) issues.push({ code: 'missing-item', path, id: output.id })
    if (!Number.isFinite(output.amount_per_minute) || output.amount_per_minute <= 0) {
      issues.push({ code: 'invalid-rate', path, id: output.id })
    }
  }

  buildings.forEach((building, buildingIndex) => {
    const buildingPath = `buildings[${buildingIndex}]`
    if (seenBuildings.has(building.id)) issues.push({ code: 'duplicate-building', path: buildingPath, id: building.id })
    seenBuildings.add(building.id)

    building.construction_cost?.forEach((material, index) => {
      const path = `${buildingPath}.construction_cost[${index}]`
      if (!seenItems.has(material.id)) issues.push({ code: 'missing-item', path, id: material.id })
      if (!Number.isFinite(material.amount) || material.amount <= 0) issues.push({ code: 'invalid-amount', path, id: material.id })
    })

    building.recipes?.forEach((recipe, recipeIndex) => {
      const path = `${buildingPath}.recipes[${recipeIndex}]`
      if (recipe.id) {
        if (seenRecipes.has(recipe.id)) issues.push({ code: 'duplicate-recipe', path, id: recipe.id })
        seenRecipes.add(recipe.id)
      }

      checkOutput(recipe.output, `${path}.output`)
      recipe.inputs.forEach((input, index) => checkOutput(input, `${path}.inputs[${index}]`))
      recipe.extra_outputs?.forEach((output, index) => checkOutput(output, `${path}.extra_outputs[${index}]`))
    })
  })

  return issues
}
