import type { Item } from '@/shared/@types/item.type'
import type { PlannerFlowEdge } from '../types'
import type { Graph } from '@dagrejs/dagre'
import { getItemName, getItemType } from './lookup'
import { buildProductionConnections } from '../../lib/production-plan/production-connections'
import type { ByproductAllocation, ProductionStep } from '@/features/planner/lib/production-plan'
import { FLOW_COLORS } from '../config/flow-theme'

/** Adapts confirmed domain flows to artwork; stage ordering consumes those same connections. */
export const buildEdges = (
  steps: readonly ProductionStep[],
  supplyCountInventory: Readonly<Record<string, number>>,
  items: readonly Item[],
  dagreGraph: Graph,
  byproductAllocations: readonly ByproductAllocation[] = [],
): PlannerFlowEdge[] =>
  buildProductionConnections(steps, supplyCountInventory, byproductAllocations).map((connection, index) => {
    const { source, target, itemId, amountPerMinute, kind } = connection
    const itemName = getItemName(items, itemId)
    const itemType = getItemType(items, itemId)
    dagreGraph.setEdge(source, target)
    const supply = kind === 'supply'
    const coproduct = kind === 'coproduct'
    return {
      id: coproduct
        ? `coproduct-${source}-${itemId}-${target}-${index}`
        : supply
          ? `react-flow__edge-supply-${itemId}-${target}`
          : `e-${itemId}-${target}`,
      type: 'productionEdge',
      source,
      target,
      label: coproduct ? `${itemName} · coproduct ${amountPerMinute.toFixed(1)}/m` : `${itemName} x${amountPerMinute.toFixed(1)}/m`,
      data: { itemName, amountPerMinute, ...(coproduct ? { isByproduct: true } : {}) },
      ariaLabel: `${itemName}: ${amountPerMinute.toFixed(1)} ${coproduct ? 'co-product items' : 'items'} per minute${supply ? ' supplied' : ''}`,
      ...(supply ? { animated: true } : {}),
      style: coproduct
        ? { stroke: FLOW_COLORS.supplyEdge, strokeWidth: 4, strokeDasharray: '7 3' }
        : supply
          ? { stroke: FLOW_COLORS.supplyEdge, strokeWidth: 6, strokeDasharray: '5 5' }
          : { strokeWidth: 4, opacity: 0.8 },
      className: coproduct ? 'react-flow__edge-byproduct' : supply ? `e-supply-${itemType}` : `react-flow__edge-${itemType}`,
    }
  })
