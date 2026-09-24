import { planToFlow, type ProductionFlowLayout } from '@/features/planner/flow/plan-to-flow'
import { scheduleFlowFitView, shouldFitFlowView } from '@/features/planner/flow/layout/flow-fit'
import type { PlannerFlowNode } from '@/features/planner/flow/types'
import { useProduction } from '@/features/planner/hooks/use-production'
import type { Item } from '@/shared/@types/item.type'
import { useReactFlow } from '@xyflow/react'
import { useEffect, useRef } from 'react'
import type { ProductionPlan } from '@/features/planner/lib/production-plan/types'
import { useReducedMotion } from 'framer-motion'

interface UseFlowDiagramParams {
  items: readonly Item[]
  plan: ProductionPlan | null
  layoutMode: ProductionFlowLayout
}

export const useFlowDiagram = ({ items, plan, layoutMode }: UseFlowDiagramParams) => {
  const targetId = plan?.targetId ?? ''

  const { nodes, setNodes, edges, setEdges, onNodesChange } = useProduction()
  const { fitView } = useReactFlow<PlannerFlowNode>()
  const reduceMotion = useReducedMotion() ?? false

  const lastTargetIdRef = useRef(targetId)
  const lastLayoutModeRef = useRef(layoutMode)

  useEffect(() => {
    if (!plan) return

    const { nodes: newNodes, edges: newEdges } = planToFlow({
      plan,
      items,
      layoutMode,
    })

    setNodes(newNodes)
    setEdges(newEdges)

    if (shouldFitFlowView(lastTargetIdRef.current, targetId) || lastLayoutModeRef.current !== layoutMode) {
      lastTargetIdRef.current = targetId
      lastLayoutModeRef.current = layoutMode
      return scheduleFlowFitView(fitView, reduceMotion)
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plan, items, targetId, layoutMode, fitView, reduceMotion])

  return { nodes, edges, onNodesChange }
}
