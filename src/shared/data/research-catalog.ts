import type { ResearchItem, ResearchScienceType, ResearchTechnology, ResearchUnlock, ScienceTypeId } from '@/shared/@types/research.type'
import researchCatalog from './main-sequence/research.json'

interface SourceResearchComponent {
  id: string
  points: number
}

interface SourceResearchReward {
  id: string
  name: string
  type: ResearchUnlock['type']
}

interface SourceTechnology {
  id: string
  name: string
  icon?: string
  xp: number
  start_unlocked?: boolean
  primary_prerequisite?: string
  prerequisites?: readonly string[]
  rewards: readonly SourceResearchReward[]
}

interface SourceResearchBranch {
  id: string
  components: readonly SourceResearchComponent[]
  technologies: readonly SourceTechnology[]
}

const sourceBranches = Object.entries(researchCatalog) as [string, SourceResearchBranch][]
const scienceBranches = sourceBranches.filter(([, branch]) => branch.id !== 'general')

/** Research branches and point-bearing items are derived from the compact FModel catalog. */
export const researchScienceTypes: readonly ResearchScienceType[] = scienceBranches.map(([name, branch]) => ({
  id: branch.id as ScienceTypeId,
  name,
}))

export const researchItems: readonly ResearchItem[] = scienceBranches.flatMap(([, branch]) =>
  branch.components.map((component) => ({
    item_id: component.id,
    type: branch.id as ScienceTypeId,
    points_per_item: component.points,
  })),
)

/**
 * A technology can require several science branches. The compact source lists one
 * branch cost per occurrence, so the runtime model merges those occurrences by ID.
 */
export const researchTechnologies: readonly ResearchTechnology[] = (() => {
  const technologies = new Map<string, ResearchTechnology>()

  for (const [, branch] of sourceBranches) {
    for (const technology of branch.technologies) {
      const existing = technologies.get(technology.id)
      const cost = branch.id === 'general' ? [] : [{ type: branch.id as ScienceTypeId, points: technology.xp }]

      if (existing) {
        technologies.set(technology.id, { ...existing, costs: [...existing.costs, ...cost] })
        continue
      }

      technologies.set(technology.id, {
        id: technology.id,
        name: technology.name,
        ...(technology.icon ? { icon: technology.icon } : {}),
        costs: cost,
        ...(technology.start_unlocked ? { start_unlocked: true } : {}),
        ...(technology.primary_prerequisite ? { primary_prerequisite: technology.primary_prerequisite } : {}),
        ...(technology.prerequisites?.length ? { prerequisites: technology.prerequisites } : {}),
        unlocks: technology.rewards.map(({ id, name, type }) => ({ id, name, type })),
      })
    }
  }

  return [...technologies.values()]
})()

export const researchTechnologyById: ReadonlyMap<string, ResearchTechnology> = new Map(
  researchTechnologies.map((technology) => [technology.id, technology]),
)

export const researchScienceTypeById: ReadonlyMap<string, ResearchScienceType> = new Map(
  researchScienceTypes.map((scienceType) => [scienceType.id, scienceType]),
)

export const researchItemById: ReadonlyMap<string, ResearchItem> = new Map(researchItems.map((item) => [item.item_id, item]))

/** Multiple technologies can unlock one recipe, so every source relationship is retained. */
export const researchTechnologiesByRecipeId: ReadonlyMap<string, readonly ResearchTechnology[]> = (() => {
  const index = new Map<string, ResearchTechnology[]>()

  for (const technology of researchTechnologies) {
    for (const unlock of technology.unlocks) {
      if (unlock.type !== 'recipe') continue
      const technologies = index.get(unlock.id) ?? []
      technologies.push(technology)
      index.set(unlock.id, technologies)
    }
  }

  return index
})()
