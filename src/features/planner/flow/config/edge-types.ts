import type { EdgeProps } from '@xyflow/react'
import type { ComponentType } from 'react'
import type { PlannerFlowEdge } from '../types'
import { ProductionEdge } from '../edges/production-edge'

export const FLOW_EDGE_TYPES = {
  productionEdge: ProductionEdge,
} satisfies Record<NonNullable<PlannerFlowEdge['type']>, ComponentType<EdgeProps<PlannerFlowEdge>>>
