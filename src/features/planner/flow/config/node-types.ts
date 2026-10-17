import type { PlannerFlowNodeByType } from '@/features/planner/flow/types'
import type { NodeProps } from '@xyflow/react'
import type { ComponentType } from 'react'
import { ProductionNode } from '../nodes/production-node'
import { RawResourceNode } from '../nodes/raw-resource-node'
import { SupplyNode } from '../nodes/supply-node'

type PlannerFlowNodeComponents = {
  [Type in keyof PlannerFlowNodeByType]: ComponentType<NodeProps<PlannerFlowNodeByType[Type]>>
}

export const FLOW_NODE_TYPES = {
  productionNode: ProductionNode,
  supplyNode: SupplyNode,
  rawResourceNode: RawResourceNode,
} satisfies PlannerFlowNodeComponents
