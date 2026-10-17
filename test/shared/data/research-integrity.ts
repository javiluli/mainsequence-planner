import type { ResearchItem, ResearchScienceType, ResearchTechnology } from '@/shared/@types/research.type'

export type ResearchIssueCode =
  | 'duplicate-science-type'
  | 'duplicate-research-item'
  | 'duplicate-technology'
  | 'unknown-science-type'
  | 'unknown-item'
  | 'invalid-points'
  | 'unknown-prerequisite'
  | 'unknown-recipe'
  | 'invalid-unlock-type'

export interface ResearchIssue {
  code: ResearchIssueCode
  id: string
}

/** Referential check for game-backed science. Buildable/block IDs remain internal until their source assets are available. */
export const inspectResearchCatalog = (
  scienceTypes: readonly ResearchScienceType[],
  researchItems: readonly ResearchItem[],
  technologies: readonly ResearchTechnology[],
  itemIds: ReadonlySet<string>,
  recipeIds: ReadonlySet<string>,
): ResearchIssue[] => {
  const issues: ResearchIssue[] = []
  const scienceIds = new Set<string>()
  const researchItemIds = new Set<string>()
  const technologyIds = new Set<string>()

  for (const scienceType of scienceTypes) {
    if (scienceIds.has(scienceType.id)) issues.push({ code: 'duplicate-science-type', id: scienceType.id })
    scienceIds.add(scienceType.id)
  }

  for (const item of researchItems) {
    if (researchItemIds.has(item.item_id)) issues.push({ code: 'duplicate-research-item', id: item.item_id })
    researchItemIds.add(item.item_id)
    if (!itemIds.has(item.item_id)) issues.push({ code: 'unknown-item', id: item.item_id })
    if (!scienceIds.has(item.type)) issues.push({ code: 'unknown-science-type', id: item.type })
    if (!Number.isFinite(item.points_per_item) || item.points_per_item <= 0) issues.push({ code: 'invalid-points', id: item.item_id })
  }

  for (const technology of technologies) {
    if (technologyIds.has(technology.id)) issues.push({ code: 'duplicate-technology', id: technology.id })
    technologyIds.add(technology.id)
  }

  for (const technology of technologies) {
    for (const cost of technology.costs) {
      if (!scienceIds.has(cost.type)) issues.push({ code: 'unknown-science-type', id: cost.type })
      if (!Number.isFinite(cost.points) || cost.points <= 0) issues.push({ code: 'invalid-points', id: technology.id })
    }

    for (const prerequisite of [technology.primary_prerequisite, ...(technology.prerequisites ?? [])]) {
      if (prerequisite && !technologyIds.has(prerequisite)) issues.push({ code: 'unknown-prerequisite', id: prerequisite })
    }

    for (const unlock of technology.unlocks) {
      if (unlock.type === 'recipe' && !recipeIds.has(unlock.id)) issues.push({ code: 'unknown-recipe', id: unlock.id })
      if (!['recipe', 'buildable', 'block'].includes(unlock.type)) issues.push({ code: 'invalid-unlock-type', id: unlock.type })
    }
  }

  return issues
}
