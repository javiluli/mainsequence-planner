import { describe, expect, it } from 'vitest'
import { buildings, byproductBuildingsByItemId, items, producerBuildingsByItemId } from '@/shared/data'
import { buildPartialRecipeFlow } from './build-partial-recipe-flow'

const buildFlow = (targetId: string, recipeIdByItemId: Record<string, string> = {}) =>
  buildPartialRecipeFlow({
    targetId,
    buildings,
    items,
    producerBuildingsByItemId,
    byproductBuildingsByItemId,
    recipeIdByItemId,
  })

describe('partial recipe flow', () => {
  it('keeps Advanced Plate and its verified dependencies visible without inventing missing sources', () => {
    const flow = buildFlow('T_AdvancedPlate')
    const nodes = new Map(flow.nodes.map((node) => [node.id, node]))
    const connections = new Set(flow.edges.map((edge) => `${edge.source}->${edge.target}`))

    expect(nodes.get('T_AdvancedPlate')).toMatchObject({
      type: 'partialRecipe',
      data: { buildingId: 'advanced_assembler', recipeId: 'advanced_plates', nominalOutputIpm: 5 },
    })
    expect(nodes.get('T_LeavesIcon')).toMatchObject({
      type: 'partialSource',
      data: { sourceKind: 'coproduct', itemName: 'Biomass' },
    })
    expect(nodes.get('T_StellarSurveyData')).toMatchObject({
      type: 'partialSource',
      data: { sourceKind: 'unconfirmed', itemName: 'Stellar Survey Data' },
    })
    expect(nodes.get('T_CobaltOre')).toMatchObject({ type: 'partialSource', data: { sourceKind: 'raw' } })
    expect(connections).toContain('T_ChitinComposite->T_AdvancedPlate')
    expect(flow.edges.find((edge) => edge.id === 'T_ChromaticAlloy->T_AdvancedPlate')).toMatchObject({
      data: { itemName: 'Chromatic Alloy', amountPerMinute: 30 },
    })
    expect(connections).toContain('T_LeavesIcon->T_Xenoeukarya')
    expect(connections).toContain('T_StellarSurveyData->T_EncodedSimulationMatrix')
    expect(flow.unconfirmedItemIds).toEqual(['T_LeavesIcon', 'T_StellarSurveyData'])
    expect(flow.nodes.some((node) => 'buildingCount' in node.data || 'targetIpm' in node.data)).toBe(false)
    expect(nodes.get('T_AdvancedPlate')?.position).not.toEqual(nodes.get('T_ChromaticAlloy')?.position)
    expect(nodes.get('T_IridiumOre')?.position).not.toEqual(nodes.get('T_TitaniumOre')?.position)
  })

  it('uses a selected real ore-synthesis recipe only when explicitly chosen', () => {
    const defaultFlow = buildFlow('T_NickelPlates1')
    const selectedFlow = buildFlow('T_NickelPlates1', { T_NickelOre: 'nickel_synthesis' })

    expect(defaultFlow.nodes.find((node) => node.id === 'T_NickelOre')?.type).toBe('partialSource')
    expect(selectedFlow.nodes.find((node) => node.id === 'T_NickelOre')).toMatchObject({
      type: 'partialRecipe',
      data: { recipeId: 'nickel_synthesis' },
    })
  })

  it('preserves gross and net rates for a recipe with internal recycling', () => {
    const flow = buildFlow('T_Xenoeukarya')

    expect(flow.nodes.find((node) => node.id === 'T_Xenoeukarya')).toMatchObject({
      type: 'partialRecipe',
      data: { nominalOutputIpm: 60, recycledIpm: 30, netOutputIpm: 30 },
    })
    expect(flow.edges.find((edge) => edge.id === 'T_LeavesIcon->T_Xenoeukarya')).toMatchObject({
      data: { itemName: 'Biomass', amountPerMinute: 30 },
    })
    expect(flow.edges.some((edge) => edge.id === 'T_Xenoeukarya->T_Xenoeukarya')).toBe(false)
  })
})
