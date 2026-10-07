import { planToFlow, type ProductionFlowLayout } from '@/features/planner/flow/plan-to-flow'
import { scheduleFlowFitView } from '@/features/planner/flow/layout/flow-fit'
import type { PlannerFlowNode } from '@/features/planner/flow/types'
import type { Item } from '@/shared/@types/item.type'
import { applyNodeChanges, useReactFlow, type OnNodesChange } from '@xyflow/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ProductionPlan } from '@/features/planner/lib/production-plan/types'
import { useReducedMotion } from 'framer-motion'

interface UseFlowDiagramParams {
  items: readonly Item[]
  plan: ProductionPlan | null
  layoutMode: ProductionFlowLayout
}

export const useFlowDiagram = ({ items, plan, layoutMode }: UseFlowDiagramParams) => {
  const targetId = plan?.targetId ?? ''

  const graph = useMemo(() => (plan ? planToFlow({ plan, items, layoutMode }) : { nodes: [], edges: [] }), [plan, items, layoutMode])
  const [nodeState, setNodeState] = useState<{ graph: typeof graph; nodes: PlannerFlowNode[] } | null>(null)
  // Positions and measurements belong to this graph only; a new plan never inherits stale node changes.
  const nodes = nodeState?.graph === graph ? nodeState.nodes : graph.nodes
  const onNodesChange: OnNodesChange<PlannerFlowNode> = useCallback(
    (changes) => {
      setNodeState((current) => ({
        graph,
        nodes: applyNodeChanges(changes, current?.graph === graph ? current.nodes : graph.nodes),
      }))
    },
    [graph],
  )
  const { fitView } = useReactFlow<PlannerFlowNode>()
  const reduceMotion = useReducedMotion() ?? false

  const lastTargetIdRef = useRef(targetId)
  const lastLayoutModeRef = useRef(layoutMode)

  useEffect(() => {
    if (!plan) return

    if (lastTargetIdRef.current !== targetId || lastLayoutModeRef.current !== layoutMode) {
      lastTargetIdRef.current = targetId
      lastLayoutModeRef.current = layoutMode
      return scheduleFlowFitView(fitView, reduceMotion)
    }
  }, [plan, items, targetId, layoutMode, fitView, reduceMotion])

  return { nodes, edges: graph.edges, onNodesChange }
}
