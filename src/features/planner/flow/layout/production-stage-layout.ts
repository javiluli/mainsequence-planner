import type { PlannerFlowNode } from '../types'
import { FLOW_NODE_SIZE, getProductionNodeHeight } from '../core/flow-nodes'

const COLUMN_GAP = 224
const ROW_GAP = 24

const nodeHeight = (node: PlannerFlowNode): number =>
  node.type === 'productionNode' ? getProductionNodeHeight(node.data) : FLOW_NODE_SIZE.externalHeight

/** Reuses Dagre's dependency ranks but aligns every rank as a clear production stage. */
export const layoutByProductionStage = (nodes: readonly PlannerFlowNode[]): PlannerFlowNode[] => {
  if (!nodes.length) return []

  const ranks = new Map<number, PlannerFlowNode[]>()
  for (const node of nodes) {
    const rank = Math.round(node.position.x)
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
