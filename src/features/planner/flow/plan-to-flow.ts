import { Graph, layout } from '@dagrejs/dagre'
import { Position } from '@xyflow/react'
import type { Item } from '@/shared/@types/item.type'
import { DAGRE_GRAPH_CONFIG } from '@/features/planner/flow/config/dagre-config'
import { buildProductionNodes, buildRawResourceNodes, buildSupplyNodes } from '@/features/planner/flow/core/flow-nodes'
import { buildEdges } from '@/features/planner/flow/core/flow-edges'
import type { ProductionPlan } from '@/features/planner/lib/production-plan'
import type { PlannerFlowEdge, PlannerFlowNode } from '@/features/planner/flow/types'
import { layoutByProductionStage } from '@/features/planner/flow/layout/production-stage-layout'

export type ProductionFlowLayout = 'network' | 'stages'

interface PlanToFlowParams {
  plan: ProductionPlan
  items: readonly Item[]
  layoutMode?: ProductionFlowLayout
}

interface PlanToFlowResult {
  nodes: PlannerFlowNode[]
  edges: PlannerFlowEdge[]
}

/** Renders verified production buildings and warehouse/drone raw inputs as distinct node kinds. */
export const planToFlow = ({ plan, items, layoutMode = 'network' }: PlanToFlowParams): PlanToFlowResult => {
  if (!plan.targetId || !Number.isFinite(plan.targetIpm) || plan.targetIpm <= 0 || plan.issues.length) {
    return { nodes: [], edges: [] }
  }

  const dagreGraph = new Graph()
  dagreGraph.setDefaultEdgeLabel(() => ({}))
  dagreGraph.setGraph(DAGRE_GRAPH_CONFIG)

  const supplyNodes = buildSupplyNodes(plan.supplyCountByItem, items, dagreGraph)
  const rawNodes = buildRawResourceNodes(plan.rawInputs, items, dagreGraph)
  const productionNodes = buildProductionNodes(plan.steps, items, dagreGraph)

  const nodes = [...supplyNodes, ...rawNodes, ...productionNodes]
  const edges = buildEdges(plan.steps, { ...plan.supplyCountInventory }, items, dagreGraph, plan.byproductAllocations ?? [])

  layout(dagreGraph)

  const layoutedNodes = nodes.map((node) => {
    const position = dagreGraph.node(node.id)
    return {
      ...node,
      ariaLabel: `${node.data.itemName}. Double-click or press Enter to highlight direct connections.`,
      position: {
        x: position.x - position.width / 2,
        y: position.y - position.height / 2,
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    }
  })

  if (layoutMode === 'stages') {
    return { nodes: layoutByProductionStage(layoutedNodes, edges), edges }
  }

  return { nodes: layoutedNodes, edges }
}
