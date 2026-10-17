import { planToFlow, type ProductionFlowLayout } from '@/features/planner/flow/plan-to-flow'
import type { PlannerFlowNode } from '@/features/planner/flow/types'
import type { Item } from '@/shared/@types/item.type'
import { applyNodeChanges, useReactFlow, useStore, type OnNodesChange } from '@xyflow/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ProductionPlan } from '@/features/planner/lib/production-plan/types'

interface UseFlowDiagramParams {
  items: readonly Item[]
  plan: ProductionPlan | null
  layoutMode: ProductionFlowLayout
}

/** Owns graph-local edits and fits a new target/layout only after its current nodes have been measured. */
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
  const measured = useStore(
    (state) =>
      Boolean(state.panZoom) &&
      graph.nodes.every((node) => {
        const current = state.nodeLookup.get(node.id)
        // React Flow resets dimensions/handles when the new model has no measurements.
        // Data identity additionally rejects a preceding graph with overlapping node IDs.
        return (
          current?.internals.userNode.data === node.data &&
          current.internals.handleBounds !== undefined &&
          (current.measured.width ?? 0) > 0 &&
          (current.measured.height ?? 0) > 0
        )
      }),
  )
  const { fitView } = useReactFlow<PlannerFlowNode>()
  const lastFit = useRef<{ targetId: string; layoutMode: ProductionFlowLayout }>(undefined)

  useEffect(() => {
    if (!plan || !graph.nodes.length) {
      lastFit.current = undefined
      return
    }
    if (!measured) return
    const previous = lastFit.current
    if (previous?.targetId === targetId && previous.layoutMode === layoutMode) return
    lastFit.current = { targetId, layoutMode }
    // Read the current media at each fit, including preferences changed while this canvas stays mounted.
    const reduceMotion = globalThis.matchMedia('(prefers-reduced-motion: reduce)').matches
    void fitView({ padding: 0.08, duration: previous && !reduceMotion ? 600 : 0 })
  }, [plan, graph, measured, targetId, layoutMode, fitView])

  // Empty graphs are ready too; presentation must not invent a measurement wait for absent nodes.
  return { nodes, edges: graph.edges, onNodesChange, isMeasured: graph.nodes.length === 0 || measured }
}
