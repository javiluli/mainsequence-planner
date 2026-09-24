import type { Item } from '@/shared/@types/item.type'
import type { PlannerFlowEdge } from '../types'
import type { Graph } from '@dagrejs/dagre'
import { getItemName, getItemType } from './lookup'
import { connectSupplyAndProduction } from './connect-edges'
import type { ByproductAllocation, ProductionStep } from '@/features/planner/lib/production-plan'
import { FLOW_COLORS } from '../config/flow-theme'

/** Build edges from the actual credited amounts; never show the credited input as a second primary input. */
export const buildEdges = (
  steps: readonly ProductionStep[],
  supplyCountInventory: Record<string, number>,
  items: readonly Item[],
  dagreGraph: Graph,
  byproductAllocations: readonly ByproductAllocation[] = [],
): PlannerFlowEdge[] => {
  const edges: PlannerFlowEdge[] = []
  const remainingCredits = byproductAllocations.map((allocation) => ({ ...allocation }))

  steps.forEach((step) => {
    step.inputs?.forEach((input) => {
      const inputNeeded = (input.amount_per_minute / step.recipeOutputIpm) * step.targetIpm
      let remaining = inputNeeded

      for (const credit of remainingCredits) {
        if (credit.consumerItemId !== step.itemId || credit.itemId !== input.id || credit.amountPerMinute <= 0) continue

        const used = Math.min(remaining, credit.amountPerMinute)
        if (used <= 1e-9) continue

        credit.amountPerMinute -= used
        remaining -= used

        edges.push({
          id: `coproduct-${credit.sourceItemId}-${credit.itemId}-${step.itemId}-${edges.length}`,
          type: 'productionEdge',
          source: credit.sourceItemId,
          target: step.itemId,
          label: `${getItemName(items, input.id)} · coproduct ${used.toFixed(1)}/m`,
          data: { itemName: getItemName(items, input.id), amountPerMinute: used, isByproduct: true },
          ariaLabel: `${getItemName(items, input.id)}: ${used.toFixed(1)} co-product items per minute`,
          style: { stroke: FLOW_COLORS.supplyEdge, strokeWidth: 4, strokeDasharray: '7 3' },
          className: 'react-flow__edge-byproduct',
        })

        dagreGraph.setEdge(credit.sourceItemId, step.itemId)
        if (remaining <= 1e-9) break
      }

      if (remaining <= 1e-9) return

      connectSupplyAndProduction({
        edges,
        dagreGraph,
        itemName: getItemName(items, input.id),
        itemId: input.id,
        itemType: getItemType(items, input.id),
        consumerId: step.itemId,
        totalNeeded: remaining,
        supplyCountInventory,
      })
    })
  })

  return edges
}
