import { Background, BackgroundVariant, Controls, ReactFlow, ReactFlowProvider, SelectionMode, type NodeMouseHandler } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'

import { items } from '@/shared/data'
import { FLOW_COLORS } from '@/features/planner/flow/config/flow-theme'
import { FLOW_EDGE_TYPES } from '@/features/planner/flow/config/edge-types'
import { FLOW_NODE_TYPES } from '@/features/planner/flow/config/node-types'
import { useFlowDiagram } from '@/features/planner/hooks/use-flow-diagram'
import { useProductionPlan } from '@/features/planner/hooks/use-production-plan'
import type { PlannerFlowEdge, PlannerFlowNode } from '@/features/planner/flow/types'
import { getFlowNeighborhood } from '@/features/planner/flow/interaction/flow-neighborhood'
import type { ProductionFlowLayout } from '@/features/planner/flow/plan-to-flow'
import { SupplyRateDialogProvider } from '@/features/planner/ui/supply/supply-rate-dialog'
import { FlowViewControls } from './flow-view-controls'
import type { PlannerDiagramContentProps } from './diagram-reveal'
import './production-flow.css'

/** Composes the measured graph, local node emphasis and existing viewport controls. */
function ProductionFlowDiagramInner({ onReady }: PlannerDiagramContentProps) {
  const plan = useProductionPlan()
  const [layoutMode, setLayoutMode] = useState<ProductionFlowLayout>('network')
  const [focus, setFocus] = useState<{ targetId: string; nodeId: string } | null>(null)
  const focusedNodeId = focus && focus.targetId === plan?.targetId ? focus.nodeId : null

  const { nodes, edges, onNodesChange, isMeasured } = useFlowDiagram({
    items,
    plan,
    layoutMode,
  })
  // Reuse the same current-model signal as fit; mounting alone does not mean graph nodes are ready to reveal.
  useEffect(() => {
    if (isMeasured) onReady?.()
  }, [isMeasured, onReady])
  const neighborhood = useMemo(() => getFlowNeighborhood(focusedNodeId, edges), [focusedNodeId, edges])
  const displayNodes = useMemo(
    () =>
      nodes.map((node) => {
        let emphasis = ''
        if (neighborhood) {
          if (node.id === focusedNodeId) emphasis = 'planner-flow-node--focused'
          else if (neighborhood.nodeIds.has(node.id)) emphasis = 'planner-flow-node--neighbor'
          else emphasis = 'planner-flow-node--dimmed'
        }

        return {
          ...node,
          selected: node.id === focusedNodeId,
          ariaRole: 'button' as const,
          domAttributes: { 'aria-pressed': node.id === focusedNodeId },
          className: [node.className, emphasis].filter(Boolean).join(' ') || undefined,
        }
      }),
    [nodes, focusedNodeId, neighborhood],
  )
  const displayEdges = useMemo(
    () =>
      edges.map((edge) => {
        if (!neighborhood) return edge
        const connected = neighborhood.edgeIds.has(edge.id)
        const emphasis: 'connected' | 'dimmed' = connected ? 'connected' : 'dimmed'
        return {
          ...edge,
          data: edge.data ? { ...edge.data, emphasis } : undefined,
          style: {
            ...edge.style,
            opacity: connected ? 1 : 0.14,
            ...(connected ? { stroke: 'hsl(var(--heroui-primary))', strokeWidth: 5 } : {}),
          },
        }
      }),
    [edges, neighborhood],
  )
  const toggleNodeFocus = (nodeId: string) => {
    const targetId = plan?.targetId
    if (!targetId) return
    setFocus((current) => (current?.targetId === targetId && current.nodeId === nodeId ? null : { targetId, nodeId }))
  }
  const handleNodeDoubleClick: NodeMouseHandler<PlannerFlowNode> = (_, node) => toggleNodeFocus(node.id)
  /** Handles node emphasis before native selection keys, leaving controls and supply dialogs untouched. */
  const handleGraphKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const target = event.target
    if (!(target instanceof HTMLElement) || !target.classList.contains('react-flow__node')) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      setFocus(null)
      return
    }
    if (event.key !== 'Enter' && event.key !== ' ') return
    const nodeId = target.dataset.id
    if (!nodeId) return
    event.preventDefault()
    event.stopPropagation()
    toggleNodeFocus(nodeId)
  }

  return (
    <div
      data-testid="planner-network-graph"
      data-flow-selection-surface
      className="planner-network-graph h-full min-h-0 w-full min-w-0 overflow-hidden"
      onKeyDownCapture={handleGraphKeyDown}
    >
      <ReactFlow<PlannerFlowNode, PlannerFlowEdge>
        minZoom={0.15}
        nodes={displayNodes}
        edges={displayEdges}
        onNodesChange={onNodesChange}
        onNodeDoubleClick={handleNodeDoubleClick}
        onPaneClick={() => setFocus(null)}
        nodeTypes={FLOW_NODE_TYPES}
        edgeTypes={FLOW_EDGE_TYPES}
        defaultEdgeOptions={{ ariaRole: 'img', focusable: true, selectable: false }}
        elementsSelectable={false}
        deleteKeyCode={null}
        nodesDraggable
        selectionKeyCode="Shift"
        multiSelectionKeyCode={['Control', 'Meta']}
        selectionMode={SelectionMode.Partial}
        colorMode="dark"
        ariaLabelConfig={{
          'node.a11yDescription.default':
            'Press Enter or Space to toggle direct connections. Press Escape to clear the highlight. Drag nodes to reposition them when interaction is unlocked.',
          'node.a11yDescription.keyboardDisabled':
            'Press Enter or Space to toggle direct connections. Press Escape to clear the highlight. Use arrow keys to move a highlighted node when interaction is unlocked.',
          'edge.a11yDescription.default': 'Production connection. Its name describes the item and rate; connections cannot be deleted.',
        }}
      >
        <Background bgColor={FLOW_COLORS.canvas} color={FLOW_COLORS.grid} variant={BackgroundVariant.Lines} gap={60} />

        <FlowViewControls layoutMode={layoutMode} onLayoutChange={setLayoutMode} />
        <Controls position="bottom-right" />
      </ReactFlow>
    </div>
  )
}

/** Isolates graph state and supply dialogs from the always available diagram navigation. */
export function ProductionFlowDiagram({ onReady }: PlannerDiagramContentProps) {
  return (
    <ReactFlowProvider>
      <SupplyRateDialogProvider>
        <ProductionFlowDiagramInner onReady={onReady} />
      </SupplyRateDialogProvider>
    </ReactFlowProvider>
  )
}
