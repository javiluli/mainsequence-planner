import type { PlannerFlowEdge, PlannerFlowNode } from '../types'
import { FLOW_NODE_SIZE, getProductionNodeHeight } from '../core/flow-nodes'

const COLUMN_GAP = 224
const ROW_GAP = 24

const nodeHeight = (node: PlannerFlowNode): number =>
  node.type === 'productionNode' ? getProductionNodeHeight(node.data) : FLOW_NODE_SIZE.externalHeight

/** Aligns sources at stage zero, then places each product after its deepest prerequisite. */
export const layoutByProductionStage = (nodes: readonly PlannerFlowNode[], edges: readonly PlannerFlowEdge[]): PlannerFlowNode[] => {
  if (!nodes.length) return []

  const stageById = new Map(nodes.map((node) => [node.id, 0]))
  const incomingCount = new Map(nodes.map((node) => [node.id, 0]))
  const outgoing = new Map<string, string[]>()

  for (const edge of edges) {
    if (!stageById.has(edge.source) || !stageById.has(edge.target)) continue
    const targets = outgoing.get(edge.source) ?? []
    targets.push(edge.target)
    outgoing.set(edge.source, targets)
    incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1)
  }

  const queue = nodes.filter((node) => incomingCount.get(node.id) === 0).map((node) => node.id)
  for (let index = 0; index < queue.length; index++) {
    const sourceId = queue[index]
    for (const targetId of outgoing.get(sourceId) ?? []) {
      stageById.set(targetId, Math.max(stageById.get(targetId) ?? 0, (stageById.get(sourceId) ?? 0) + 1))
      const remaining = (incomingCount.get(targetId) ?? 0) - 1
      incomingCount.set(targetId, remaining)
      if (remaining === 0) queue.push(targetId)
    }
  }

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
