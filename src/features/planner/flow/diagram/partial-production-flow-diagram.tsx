import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type NodeMouseHandler,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useMemo, useState, type KeyboardEvent } from 'react'
import { byproductBuildingsByItemId, buildings, itemById, items, producerBuildingsByItemId } from '@/shared/data'
import { AssetImage } from '@/shared/ui'
import { plannerSelectors, usePlannerStore } from '@/store/planner.store'
import { getFlowNeighborhood } from '@/features/planner/flow/interaction/flow-neighborhood'
import {
  buildPartialRecipeFlow,
  type PartialFlowEdge,
  type PartialFlowNode,
  type PartialRecipeNode,
  type PartialSourceNode,
} from '@/features/planner/flow/partial/build-partial-recipe-flow'
import { useProductionPlan } from '@/features/planner/hooks/use-production-plan'
import { FLOW_COLORS } from '@/features/planner/flow/config/flow-theme'
import { FLOW_EDGE_TYPES } from '@/features/planner/flow/config/edge-types'
import { FlowNodeShell } from '@/features/planner/flow/nodes/flow-node-shell'
import './production-flow.css'

function PartialRecipeCard({ data, selected }: NodeProps<PartialRecipeNode>) {
  return (
    <FlowNodeShell selected={selected} className="h-32 w-[236px]">
      <Handle type="target" position={Position.Left} className="bg-primary!" />
      <Handle type="source" position={Position.Right} className="bg-primary!" />
      <div className="border-b border-divider/70 px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-foreground/65">
        {data.buildingName}
      </div>
      <div className="flex items-center gap-2.5 px-3 py-2">
        <AssetImage kind="buildings" id={data.buildingId} width={52} alt="" loading="eager" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <AssetImage kind="items" id={data.itemId} width={24} alt="" loading="eager" />
            <span className="line-clamp-2 text-xs font-semibold leading-tight" title={data.itemName}>
              {data.itemName}
            </span>
          </div>
          <p className="mt-1 font-mono text-sm tabular-nums">
            {data.recycledIpm ? data.nominalOutputIpm : data.netOutputIpm}/min{' '}
            <span className="font-sans text-[11px] text-foreground/65">{data.recycledIpm ? 'gross' : 'per machine'}</span>
          </p>
        </div>
      </div>
      <div
        className="truncate border-t border-divider/70 px-3 py-1.5 text-[11px] text-foreground/65"
        title={data.recycledIpm ? `${data.recycledIpm}/min recycled · ${data.netOutputIpm}/min net` : data.extraOutputNames.join(', ')}
      >
        {data.recycledIpm
          ? `${data.recycledIpm}/min recycled · ${data.netOutputIpm}/min net`
          : data.extraOutputNames.length
            ? `Also produces ${data.extraOutputNames.join(', ')}`
            : 'Source recipe · nominal rate'}
      </div>
    </FlowNodeShell>
  )
}

function PartialSourceCard({ data, selected }: NodeProps<PartialSourceNode>) {
  const label = data.sourceKind === 'raw' ? 'Raw resource' : data.sourceKind === 'coproduct' ? 'Coproduct' : 'No machine recipe'
  const detail =
    data.sourceKind === 'raw'
      ? 'External resource'
      : data.sourceKind === 'coproduct'
        ? `From ${data.byproductBuildingNames.join(', ')}`
        : 'External acquisition to confirm'

  return (
    <FlowNodeShell selected={selected} className={`h-[100px] w-[212px] ${data.sourceKind === 'raw' ? '' : 'border-warning/65'}`}>
      <Handle type="source" position={Position.Right} className={data.sourceKind === 'raw' ? 'bg-primary!' : 'bg-warning!'} />
      <div className="border-b border-divider/70 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-foreground/65">
        {label}
      </div>
      <div className="flex items-center gap-2.5 px-3 py-2">
        <AssetImage kind="items" id={data.itemId} width={40} alt="" loading="eager" />
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold" title={data.itemName}>
            {data.itemName}
          </p>
          <p className="mt-1 truncate text-[11px] text-foreground/65" title={detail}>
            {detail}
          </p>
        </div>
      </div>
    </FlowNodeShell>
  )
}

const PARTIAL_NODE_TYPES = { partialRecipe: PartialRecipeCard, partialSource: PartialSourceCard }

function PartialProductionFlowDiagramInner() {
  const plan = useProductionPlan()
  const recipeIdByItemId = usePlannerStore(plannerSelectors.recipeIdByItemId)
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null)
  const graph = useMemo(
    () =>
      buildPartialRecipeFlow({
        targetId: plan?.targetId ?? '',
        buildings,
        items,
        producerBuildingsByItemId,
        byproductBuildingsByItemId,
        recipeIdByItemId,
      }),
    [plan?.targetId, recipeIdByItemId],
  )
  const initialViewNodes = useMemo(() => {
    const target = graph.nodes.find((node) => node.id === plan?.targetId)
    if (!target) return []
    const directInputIds = new Set(graph.edges.filter((edge) => edge.target === target.id).map((edge) => edge.source))
    const nearestInput = graph.nodes
      .filter((node) => directInputIds.has(node.id))
      .sort(
        (left, right) =>
          2 * Math.abs(left.position.y - target.position.y) +
          Math.abs(left.position.x - target.position.x) -
          (2 * Math.abs(right.position.y - target.position.y) + Math.abs(right.position.x - target.position.x)),
      )[0]
    return nearestInput ? [nearestInput, target] : [target]
  }, [graph, plan?.targetId])
  const neighborhood = useMemo(() => getFlowNeighborhood(focusedNodeId, graph.edges), [focusedNodeId, graph.edges])
  const nodes = useMemo(
    () =>
      graph.nodes.map((node) => ({
        ...node,
        selected: node.id === focusedNodeId,
        className: neighborhood
          ? node.id === focusedNodeId
            ? 'planner-flow-node--focused'
            : neighborhood.nodeIds.has(node.id)
              ? 'planner-flow-node--neighbor'
              : 'planner-flow-node--dimmed'
          : undefined,
      })),
    [graph.nodes, focusedNodeId, neighborhood],
  )
  const edges = useMemo(
    () =>
      graph.edges.map((edge) => {
        const connected = !neighborhood || neighborhood.edgeIds.has(edge.id)
        const unconfirmed = graph.unconfirmedItemIds.includes(edge.source)
        const emphasis: 'connected' | 'dimmed' | undefined = neighborhood ? (connected ? 'connected' : 'dimmed') : undefined
        return {
          ...edge,
          data: edge.data ? { ...edge.data, emphasis } : undefined,
          style: {
            stroke: unconfirmed ? 'hsl(var(--heroui-warning))' : 'hsl(var(--heroui-foreground) / 0.55)',
            strokeWidth: connected && neighborhood ? 2.8 : 1.8,
            opacity: connected ? 1 : 0.12,
          },
        }
      }),
    [graph.edges, graph.unconfirmedItemIds, neighborhood],
  )
  const toggleFocus = (nodeId: string) => setFocusedNodeId((current) => (current === nodeId ? null : nodeId))
  const handleNodeDoubleClick: NodeMouseHandler<PartialFlowNode> = (_, node) => toggleFocus(node.id)
  const handleGraphKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    const target = event.target
    if (!(target instanceof HTMLElement) || !target.classList.contains('react-flow__node')) return
    const nodeId = target.dataset.id
    if (!nodeId) return
    event.preventDefault()
    toggleFocus(nodeId)
  }

  if (!plan) return null

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 border-b border-divider/70 bg-content1 px-4 py-2.5 text-xs sm:px-6">
        <strong className="text-foreground">Partial recipe graph</strong>
        <span className="ml-2 text-foreground/70">
          Nominal rates per machine; factory and power totals are unavailable. Pan to trace inputs.
        </span>
        {graph.unconfirmedItemIds.length > 0 && (
          <span className="mt-1 block text-warning">
            Source to confirm: {graph.unconfirmedItemIds.map((id) => itemById.get(id)?.name ?? id).join(', ')}
          </span>
        )}
      </div>
      <div
        data-testid="planner-partial-network-graph"
        className="planner-network-graph min-h-0 flex-1 overflow-hidden"
        onKeyDown={handleGraphKeyDown}
      >
        <ReactFlow<PartialFlowNode, PartialFlowEdge>
          nodes={nodes}
          edges={edges}
          nodeTypes={PARTIAL_NODE_TYPES}
          edgeTypes={FLOW_EDGE_TYPES}
          nodesConnectable={false}
          nodesDraggable
          elementsSelectable={false}
          onNodeDoubleClick={handleNodeDoubleClick}
          onPaneClick={() => setFocusedNodeId(null)}
          colorMode="dark"
          minZoom={0.15}
          fitView
          fitViewOptions={{ nodes: initialViewNodes, padding: 0.2, maxZoom: 0.85 }}
        >
          <Background bgColor={FLOW_COLORS.canvas} color={FLOW_COLORS.grid} variant={BackgroundVariant.Lines} gap={60} />
          <Controls position="bottom-right" />
        </ReactFlow>
      </div>
    </div>
  )
}

export function PartialProductionFlowDiagram() {
  return (
    <ReactFlowProvider>
      <PartialProductionFlowDiagramInner />
    </ReactFlowProvider>
  )
}
