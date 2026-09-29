import type { ResearchItem, ResearchScienceType, ResearchTechnology, ResearchUnlock, ScienceTypeId } from '@/shared/@types/research.type'
import researchCatalog from './main-sequence/research.json'

/** Contrato del JSON generado; si FModel cambia estos campos, ajustar el generador y este adaptador juntos. */
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

/** La clave del objeto JSON es el nombre visible; `id` es la referencia estable. */
interface SourceResearchBranch {
  id: string
  components: readonly SourceResearchComponent[]
  technologies: readonly SourceTechnology[]
}

// TypeScript amplía rewards[].type a string al importar JSON; la aserción queda limitada a esta frontera.
// Las pruebas de integridad comprueban los tipos y referencias que el compilador no puede inferir aquí.
const sourceBranches = Object.entries(researchCatalog) as [string, SourceResearchBranch][]
const scienceBranches = sourceBranches.filter(([, branch]) => branch.id !== 'general')

/** Ramas que aceptan puntos: General contiene tecnologías sin coste, no un tipo de ciencia. */
export const researchScienceTypes: readonly ResearchScienceType[] = scienceBranches.map(([name, branch]) => ({
  id: branch.id as ScienceTypeId,
  name,
}))

/** Valor en puntos de cada objeto investigable, conservando la rama a la que contribuye. */
export const researchItems: readonly ResearchItem[] = scienceBranches.flatMap(([, branch]) =>
  branch.components.map((component) => ({
    item_id: component.id,
    type: branch.id as ScienceTypeId,
    points_per_item: component.points,
  })),
)

/**
 * El JSON repite una tecnología en cada rama que le cobra puntos. Se unifica por ID:
 * la primera aparición aporta nombre, icono, requisitos y desbloqueos; las siguientes añaden costes.
 * Si el JSON pasa a contener una sola entrada con todos los costes, adaptar esta unión.
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

/** Una receta puede desbloquearse por varias tecnologías; el índice conserva todas las relaciones. */
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
