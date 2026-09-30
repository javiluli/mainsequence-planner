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

describe('source-backed research catalog', () => {
  it('merges branch costs while preserving point items and source unlocks', () => {
    expect(researchScienceTypes).toHaveLength(7)
    expect(researchItems).toHaveLength(8)
    expect(researchTechnologies).toHaveLength(97)
    expect(researchTechnologyById.size).toBe(97)
    expect(researchTechnologies.filter((technology) => technology.start_unlocked)).toHaveLength(7)
    expect(researchTechnologies.flatMap((technology) => technology.unlocks).filter((unlock) => unlock.type === 'recipe')).toHaveLength(61)
    expect(researchTechnologyById.get('RSC_Servomotors')?.costs).toEqual([{ type: 'material_science', points: 15 }])
    expect(researchTechnologyById.get('RSC_WarpDrive')?.icon).toBe('T_SlipstreamDrive')
    expect(researchItemById.get('T_Servomotor')?.points_per_item).toBe(3)
    expect(researchTechnologyById.get('RSC_Corridor2')?.start_unlocked).toBeUndefined()
    expect(researchTechnologiesByRecipeId.get('warp_fuel')).toHaveLength(2)
  })

  it('resolves every science item, point category, recipe and prerequisite against the app/source IDs', () => {
    const itemIds = new Set(items.map((item) => item.id))
    const recipeIds = new Set(buildings.flatMap((building) => building.recipes.flatMap((recipe) => (recipe.id ? [recipe.id] : []))))
    expect(inspectResearchCatalog(researchScienceTypes, researchItems, researchTechnologies, itemIds, recipeIds)).toEqual([])
    expect(recipeIds.has('magnetic_coils')).toBe(true)
    expect(recipeIds.has('magetic_coils')).toBe(false)
  })
})
