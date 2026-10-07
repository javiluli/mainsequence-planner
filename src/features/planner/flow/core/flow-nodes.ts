import type { Item } from '@/shared/@types/item.type'
import type { Graph } from '@dagrejs/dagre'
import { getItemName } from './lookup'
import type { ProductionStep } from '@/features/planner/lib/production-plan'
import { isPositiveSupplyCount } from '@/features/planner/lib/supply-count'
import type { RawInputDemand } from '@/features/planner/lib/production-plan'
import type { ProductionMachineNode, RawResourceFlowNode, SupplyFlowNode } from '@/features/planner/flow/types'
import { buildProductionNodeData } from './production-node-data'

/** Identifies genuine raw resources rather than assuming every unknown item is ore. */
const isRawItem = (items: readonly Item[], itemId: string) => items.some((item) => item.id === itemId && item.type === 'raw')

export const FLOW_NODE_SIZE = {
  width: 256,
  productionHeight: 183,
  externalHeight: 140,
} as const

export const getProductionNodeHeight = (step: Pick<ProductionStep, 'recycledIpm' | 'extraOutputs'>): number => {
  const detailLines = (step.recycledIpm !== undefined ? 1 : 0) + (step.extraOutputs?.length ?? 0)
  return FLOW_NODE_SIZE.productionHeight + (detailLines ? detailLines * 16 + 16 : 0)
}

/** External supply is a delivery source, not a fictional production building. */
export const buildSupplyNodes = (
  supplyCountByItem: Record<string, number>,
  items: readonly Item[],
  dagreGraph: Graph,
): (SupplyFlowNode | RawResourceFlowNode)[] =>
  Object.entries(supplyCountByItem).flatMap(([id, supplyCount]): (SupplyFlowNode | RawResourceFlowNode)[] => {
    if (!isPositiveSupplyCount(supplyCount)) return []

    dagreGraph.setNode(`supply-${id}`, { width: FLOW_NODE_SIZE.width, height: FLOW_NODE_SIZE.externalHeight })
    if (isRawItem(items, id)) {
      return [
        {
          id: `supply-${id}`,
          type: 'rawResourceNode',
          draggable: true,
          data: { itemId: id, itemName: getItemName(items, id), supplyAmount: supplyCount },
          position: { x: 0, y: 0 },
        },
      ]
    }

    return [
      {
        id: `supply-${id}`,
        type: 'supplyNode',
        draggable: true,
        data: {
          itemId: id,
          itemName: getItemName(items, id),
          supplyCount,
        },
        position: { x: 0, y: 0 },
      },
    ]
  })

/** Render external item demand without inventing a production building. */
export const buildRawResourceNodes = (
  rawInputs: readonly RawInputDemand[],
  items: readonly Item[],
  dagreGraph: Graph,
): RawResourceFlowNode[] =>
  rawInputs.map((input): RawResourceFlowNode => {
    dagreGraph.setNode(input.itemId, { width: FLOW_NODE_SIZE.width, height: FLOW_NODE_SIZE.externalHeight })
    return {
      id: input.itemId,
      type: 'rawResourceNode',
      draggable: true,
      data: {
        itemId: input.itemId,
        itemName: getItemName(items, input.itemId),
        isRawMaterial: isRawItem(items, input.itemId),
        demandIpm: input.amountPerMinute,
      },
      position: { x: 0, y: 0 },
    }
  })

/** Only actual production machinery should use the building-and-product card. */
export const buildProductionNodes = (
  steps: readonly ProductionStep[],
  items: readonly Item[],
  dagreGraph: Graph,
): ProductionMachineNode[] =>
  steps.map((step): ProductionMachineNode => {
    // Reserve one compact line per secondary output so Dagre cannot overlap taller cards.
    dagreGraph.setNode(step.itemId, {
      width: FLOW_NODE_SIZE.width,
      height: getProductionNodeHeight(step),
    })

    return {
      id: step.itemId,
      type: 'productionNode',
      draggable: true,
      data: buildProductionNodeData(step, items),
      position: { x: 0, y: 0 },
    }
  })
