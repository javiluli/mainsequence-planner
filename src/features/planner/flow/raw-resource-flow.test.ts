import { buildProductionPlan } from '@/features/planner/lib/production-plan'
import { buildings, indexProducerBuildingsByItemId, items } from '@/shared/data'
import { describe, expect, it } from 'vitest'
import { planToFlow } from './plan-to-flow'

/** Source-only warehouses/drone inputs remain connected without synthetic machine cards. */
describe('raw ore flow', () => {
  const buildCobaltFlow = (enriched: boolean) => {
    const plan = buildProductionPlan({
      buildings,
      producerBuildingsByItemId: indexProducerBuildingsByItemId(buildings),
      targetId: 'T_CobaltPlates',
      targetIpm: 15,
      isRawTarget: false,
      rawItemIds: new Set(items.filter((item) => item.type === 'raw').map((item) => item.id)),
      supplyCountByItem: {},
      recipeIdByItemId: enriched ? { T_CobaltPlates: 'enriched_cobalt_plates' } : {},
    })
    return { plan, flow: planToFlow({ plan, items }) }
  }

  it('represents 15 plates/min via 15 normal ore/min with one real refinery', () => {
    const { plan, flow } = buildCobaltFlow(false)
    const ore = flow.nodes.find((node) => node.id === 'T_CobaltOre')
    expect(ore?.type).toBe('rawResourceNode')
    expect(ore?.data).toEqual(expect.objectContaining({ demandIpm: 15 }))
    expect(flow.nodes.some((node) => node.type === 'productionNode' && node.id === 'T_CobaltOre')).toBe(false)
    expect(flow.edges).toEqual(expect.arrayContaining([expect.objectContaining({ source: 'T_CobaltOre', target: 'T_CobaltPlates' })]))
    expect(plan.stats.buildings).toBe(1)
  })

  it('uses 7.5 normal ore/min and includes an actual enrichment machine for 15 enriched-route plates/min', () => {
    const { plan, flow } = buildCobaltFlow(true)
    const ore = flow.nodes.find((node) => node.id === 'T_CobaltOre')
    const enriched = flow.nodes.find((node) => node.id === 'T_EnrichedCobalt')
    expect(ore?.type).toBe('rawResourceNode')
    expect(ore?.data).toEqual(expect.objectContaining({ demandIpm: 7.5 }))
    expect(enriched?.type).toBe('productionNode')
    expect(plan.stats.buildings).toBe(2)
  })

  it('shows a configured raw warehouse supply without inventing a cargo receiver', () => {
    const { plan } = buildCobaltFlow(false)
    const supplied = { ...plan, supplyCountByItem: { T_CobaltOre: 5 }, supplyCountInventory: { T_CobaltOre: 5 } }
    const flow = planToFlow({ plan: supplied, items })
    expect(flow.nodes.find((node) => node.id === 'supply-T_CobaltOre')).toEqual(
      expect.objectContaining({ type: 'rawResourceNode', data: expect.objectContaining({ supplyAmount: 5 }) }),
    )
  })
})
