import type { Edge } from '@xyflow/react'

export interface FlowNeighborhood {
  nodeIds: ReadonlySet<string>
  edgeIds: ReadonlySet<string>
}

/** Only edges touching the chosen node belong to its one-step neighborhood. */
export const getFlowNeighborhood = (
  nodeId: string | null,
  edges: readonly Pick<Edge, 'id' | 'source' | 'target'>[],
): FlowNeighborhood | null => {
  if (!nodeId) return null

  const nodeIds = new Set([nodeId])
  const edgeIds = new Set<string>()

  for (const edge of edges) {
    if (edge.source !== nodeId && edge.target !== nodeId) continue
    nodeIds.add(edge.source)
    nodeIds.add(edge.target)
    edgeIds.add(edge.id)
  }

  return { nodeIds, edgeIds }
}
