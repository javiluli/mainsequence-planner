import type { PlannerFlowEdge, PlannerFlowNode } from '@/features/planner/flow/types'
import { applyNodeChanges, type OnNodesChange } from '@xyflow/react'
import { useCallback, useState } from 'react'

export const useProduction = () => {
  const [nodes, setNodes] = useState<PlannerFlowNode[]>([])
  const [edges, setEdges] = useState<PlannerFlowEdge[]>([])

  const onNodesChange: OnNodesChange<PlannerFlowNode> = useCallback((changes) => {
    setNodes((nodes) => applyNodeChanges(changes, nodes))
  }, [])

  return { nodes, setNodes, edges, setEdges, onNodesChange }
}
