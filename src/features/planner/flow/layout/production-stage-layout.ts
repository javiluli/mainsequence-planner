import { getProductionStageRanks } from '../../lib/production-plan/production-stages'
import type { PlannerFlowEdge, PlannerFlowNode } from '../types'
import { FLOW_NODE_SIZE, getProductionNodeHeight } from '../core/flow-nodes'

const COLUMN_GAP = 224
const ROW_GAP = 24

const nodeHeight = (node: PlannerFlowNode): number =>
  node.type === 'productionNode' ? getProductionNodeHeight(node.data) : FLOW_NODE_SIZE.externalHeight

/** Aligns sources at stage zero, then places each product after its deepest prerequisite. */
export const layoutByProductionStage = (nodes: readonly PlannerFlowNode[], edges: readonly PlannerFlowEdge[]): PlannerFlowNode[] => {
  if (!nodes.length) return []

  const stageById = getProductionStageRanks(
    nodes.map((node) => node.id),
    edges,
  )

  const ranks = new Map<number, PlannerFlowNode[]>()
  for (const node of nodes) {
    const rank = stageById.get(node.id) ?? 0
    const group = ranks.get(rank) ?? []
    group.push(node)
    ranks.set(rank, group)
  }

  const positions = new Map<string, { x: number; y: number }>()
  const orderedRanks = [...ranks].sort(([first], [second]) => first - second)
  const tallestColumn = Math.max(
    ...orderedRanks.map(([, group]) => group.reduce((height, node) => height + nodeHeight(node), 0) + ROW_GAP * (group.length - 1)),
  )

  orderedRanks.forEach(([, group], index) => {
    const x = index * (FLOW_NODE_SIZE.width + COLUMN_GAP)
    const orderedNodes = [...group].sort((first, second) => first.position.y - second.position.y || first.id.localeCompare(second.id))
    const groupHeight = orderedNodes.reduce((height, node) => height + nodeHeight(node), 0) + ROW_GAP * (orderedNodes.length - 1)
    let y = (tallestColumn - groupHeight) / 2

    for (const node of orderedNodes) {
      positions.set(node.id, { x, y })
      y += nodeHeight(node) + ROW_GAP
    }
  })

  return nodes.map((node) => ({ ...node, position: positions.get(node.id) ?? node.position }))
}
