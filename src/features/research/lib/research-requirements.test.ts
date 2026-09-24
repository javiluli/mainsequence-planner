import type { ResearchTechnology } from '@/shared/@types/research.type'
import { describe, expect, it } from 'vitest'
import { getRecipeResearchRequirements } from './research-requirements'

const servomotors: ResearchTechnology = {
  id: 'RSC_Servomotors',
  name: 'Servomotor',
  costs: [{ type: 'material_science', points: 15 }],
  unlocks: [{ type: 'recipe', id: 'servomotor' }],
}

const shipyard: ResearchTechnology = {
  id: 'RSC_Shipyard1',
  name: 'Shipyard',
  costs: [{ type: 'material_science', points: 15 }],
  unlocks: [{ type: 'block', id: 'BPO_ShipyardCore_C' }],
}

const warpDrive: ResearchTechnology = {
  id: 'RSC_WarpDrive',
  name: 'Slipstream Drive',
  costs: [{ type: 'material_science', points: 200 }],
  primary_prerequisite: 'RSC_Shipyard1',
  prerequisites: ['RSC_EnrichmentChamber'],
  unlocks: [{ type: 'recipe', id: 'warp_fuel' }],
}

const enrichment: ResearchTechnology = {
  id: 'RSC_EnrichmentChamber',
  name: 'Enrichment Chamber',
  costs: [{ type: 'material_science', points: 150 }],
  unlocks: [{ type: 'recipe', id: 'enriched_fuel' }],
}

const technologies = new Map<string, readonly ResearchTechnology[]>([
  ['servomotor', [servomotors]],
  ['warp_fuel', [warpDrive]],
])

const technologyById = new Map<string, ResearchTechnology>([
  [shipyard.id, shipyard],
  [warpDrive.id, warpDrive],
  [enrichment.id, enrichment],
])

describe('getRecipeResearchRequirements', () => {
  it('returns no requirements for an unknown or synthetic recipe without a research unlock', () => {
    expect(getRecipeResearchRequirements(undefined, technologies, technologyById)).toEqual([])
    expect(getRecipeResearchRequirements('unknown_recipe', technologies, technologyById)).toEqual([])
  })

  it('preserves the source technology and resolves primary and additional prerequisites', () => {
    expect(getRecipeResearchRequirements('servomotor', technologies, technologyById)).toEqual([
      { technology: servomotors, prerequisites: [] },
    ])

    expect(getRecipeResearchRequirements('warp_fuel', technologies, technologyById)).toEqual([
      {
        technology: warpDrive,
        prerequisites: [shipyard, enrichment],
      },
    ])
  })
})
