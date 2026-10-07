import type { ResearchTechnology } from '@/shared/@types/research.type'
import { researchTechnologiesByRecipeId, researchTechnologyById } from '@/shared/data'

export interface RecipeResearchRequirement {
  technology: ResearchTechnology
  prerequisites: readonly ResearchTechnology[]
}

/** Resolves source-backed technologies that unlock a recipe without inferring missing research mappings. */
export const getRecipeResearchRequirements = (
  recipeId: string | undefined,
  technologiesByRecipeId: ReadonlyMap<string, readonly ResearchTechnology[]> = researchTechnologiesByRecipeId,
  technologyById: ReadonlyMap<string, ResearchTechnology> = researchTechnologyById,
): RecipeResearchRequirement[] => {
  if (!recipeId) return []

  const technologies = technologiesByRecipeId.get(recipeId) ?? []

  return technologies.map((technology) => {
    const prerequisiteIds = new Set([technology.primary_prerequisite, ...(technology.prerequisites ?? [])])

    return {
      technology,
      prerequisites: [...prerequisiteIds].flatMap((id) => {
        if (!id) return []

        const prerequisite = technologyById.get(id)
        return prerequisite ? [prerequisite] : []
      }),
    }
  })
}
