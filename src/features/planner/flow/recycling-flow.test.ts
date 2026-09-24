import { buildings, indexProducerBuildingsByItemId, items } from '@/shared/data'
import { describe, expect, it } from 'vitest'
import { buildProductionPlan } from '../lib/production-plan'
import { planToFlow } from './plan-to-flow'

/** Real recycling retains a single net producer and a separate biomass source, without a fictitious self-edge. */
describe('recycling flow', () => {
  it('does not produce a same-item cycle in React Flow for a net-positive recycling recipe', () => {
    const plan = buildProductionPlan({
      buildings,
      producerBuildingsByItemId: indexProducerBuildingsByItemId(buildings),
      targetId: 'T_Xenoeukarya',
      targetIpm: 15,
      isRawTarget: false,
      rawItemIds: new Set(items.filter((item) => item.type === 'raw').map((item) => item.id)),
      supplyCountByItem: { T_LeavesIcon: 15 },
      recipeIdByItemId: { T_Xenoeukarya: 'xeno_eukarya_recycling' },
    })

    expect(plan.issues).toEqual([])
    const { nodes, edges } = planToFlow({ plan, items })
    expect(nodes.filter((node) => node.id === 'T_Xenoeukarya')).toHaveLength(1)
    expect(nodes.find((node) => node.id === 'T_Xenoeukarya')?.data).toEqual(expect.objectContaining({ recycledIpm: 15 }))
    expect(edges.every((edge) => edge.source !== edge.target)).toBe(true)
    expect(edges).toEqual(expect.arrayContaining([expect.objectContaining({ source: 'supply-T_LeavesIcon', target: 'T_Xenoeukarya' })]))
  })
})
