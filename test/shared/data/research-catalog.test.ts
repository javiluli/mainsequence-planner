import { describe, expect, it } from 'vitest'
import {
  researchItemById,
  researchItems,
  researchScienceTypes,
  researchTechnologies,
  researchTechnologiesByRecipeId,
  researchTechnologyById,
} from '@/shared/data/research-catalog'
import { inspectResearchCatalog } from './research-integrity'
import { buildings, items } from '@/shared/data'
import researchSource from '@/shared/data/main-sequence/research.json'

describe('source-backed research catalog', () => {
  it('merges branch costs while preserving point items and source unlocks', () => {
    expect(Object.values(researchSource)).toHaveLength(8)
    expect(new Set(Object.values(researchSource).flatMap((branch) => branch.technologies.map((technology) => technology.id))).size).toBe(97)
    expect(researchSource['Material Science'].components).toEqual([
      { id: 'T_HullPlate', points: 1 },
      { id: 'T_Servomotor', points: 3 },
    ])
    expect(researchSource['Material Science'].technologies.find((technology) => technology.id === 'RSC_Servomotors')?.xp).toBe(15)
    expect(researchScienceTypes).toHaveLength(7)
    expect(researchItems).toHaveLength(8)
    expect(researchTechnologies).toHaveLength(97)
    expect(researchTechnologyById.size).toBe(97)
    expect(researchTechnologies.filter((technology) => technology.start_unlocked)).toHaveLength(7)
    expect(researchTechnologies.flatMap((technology) => technology.unlocks).filter((unlock) => unlock.type === 'recipe')).toHaveLength(61)
    expect(researchTechnologyById.get('RSC_Servomotors')?.costs).toEqual([{ type: 'material_science', points: 15 }])
    expect(researchTechnologyById.get('RSC_Servomotors')?.unlocks).toContainEqual(
      expect.objectContaining({ type: 'recipe', id: 'servomotor' }),
    )
    expect(researchTechnologyById.get('RSC_WarpDrive')?.icon).toBe('T_SlipstreamDrive')
    expect(researchItemById.get('T_Servomotor')?.points_per_item).toBe(3)
    expect(researchTechnologyById.get('RSC_Corridor2')?.start_unlocked).toBeUndefined()
    expect(researchTechnologiesByRecipeId.get('warp_fuel')).toHaveLength(2)
  })

  it('resolves every science item, point category, recipe and prerequisite against the app/source IDs', () => {
    const itemIds = new Set(items.map((item) => item.id))
    const recipeIds = new Set(buildings.flatMap((building) => building.recipes.flatMap((recipe) => (recipe.id ? [recipe.id] : []))))
    expect(inspectResearchCatalog(researchScienceTypes, researchItems, researchTechnologies, itemIds, recipeIds)).toEqual([])
    // A technology repeated in another branch must not hide a broken source prerequisite during merging.
    for (const branch of Object.values(researchSource)) {
      for (const technology of branch.technologies) {
        const primary = 'primary_prerequisite' in technology ? technology.primary_prerequisite : undefined
        const additional = 'prerequisites' in technology ? technology.prerequisites : undefined
        for (const prerequisite of [primary, ...(additional ?? [])]) {
          if (prerequisite) expect(researchTechnologyById.has(prerequisite), `${technology.id} -> ${prerequisite}`).toBe(true)
        }
      }
    }
    expect(recipeIds.has('magnetic_coils')).toBe(true)
    expect(recipeIds.has('magetic_coils')).toBe(false)
    expect(items.some((item) => item.id === 'material_science_points')).toBe(false)
    expect(buildings.some((building) => building.id === 'material_science_lab')).toBe(false)
  })
})
