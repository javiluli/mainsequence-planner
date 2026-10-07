import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ViewportPortal,
  useStore as useFlowStore,
  type OnNodesChange,
  type ReactFlowInstance,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Box } from 'lucide-react'
import { useLayoutEffect, type RefObject } from 'react'
import { CELL_SIZE, type EditorTool } from '../../model/catalog'
import type { StationFlowNode } from '../../model/station-node'
import type { OccupiedCells } from '../../lib/connections/connections'
import type { StationCorridor } from '../../lib/layout/stations'
import type { LayoutPasteGeometry } from '../../lib/clipboard/clipboard-preview'
import { StationNode } from '../nodes/station-node'
import { NoteNode, type NoteFlowNode } from '../nodes/note-node'
import { StationPreview } from '../artwork/station-artwork'
import { LayoutPastePreview, PlacementPastePreview } from '../placement/layout-paste-preview'
import type { useCanvasPan } from './use-canvas-pan'
import type { useNodeMovement } from '../placement/use-node-movement'
import type { useStationPlacement } from '../placement/use-station-placement'
import type { usePlacementPreview } from '../placement/use-placement-preview'

const nodeTypes = { station: StationNode, note: NoteNode }
const stationSnapGrid: [number, number] = [CELL_SIZE, CELL_SIZE]
const minimumAnimatedCellPixels = 12

export type BaseCanvasInstance = ReactFlowInstance<StationFlowNode | NoteFlowNode>

interface BaseCanvasProps {
  canvasRef: RefObject<HTMLDivElement | null>
  lastCanvasPointerRef: RefObject<{ x: number; y: number } | null>
  nodes: (StationFlowNode | NoteFlowNode)[]
  onNodesChange: OnNodesChange<StationFlowNode | NoteFlowNode>
  onInit: (flow: BaseCanvasInstance) => void
  tool: EditorTool
  hasStations: boolean
  canvasPan: ReturnType<typeof useCanvasPan>
  nodeMovement: Pick<ReturnType<typeof useNodeMovement>, 'active' | 'start' | 'move' | 'end'>
  stationPlacement: Pick<ReturnType<typeof useStationPlacement>, 'active' | 'draft' | 'valid' | 'handlePointerMove' | 'handlePointerDown'>
  placementPreview: Pick<ReturnType<typeof usePlacementPreview>, 'active' | 'preview' | 'handlePointerMove' | 'handlePointerDown'>
  stationCorridorPreview: readonly StationCorridor[]
  layoutPasteGeometry: LayoutPasteGeometry | null
  pasteOccupied: OccupiedCells
  routeDrawingActive: boolean
  backtrackRoute: () => void
  onCancel: () => void
  onActiveStationChange: (id: string | null) => void
  onClearSelection: () => void
}

function dragPoint(event: MouseEvent | TouchEvent) {
  const point = 'clientX' in event ? event : (event.touches[0] ?? event.changedTouches[0])
  return { x: point.clientX, y: point.clientY }
}

/** At overview scale slats are subpixel detail but still repaint SVG on the main thread.
 * Subscribe only to the detail boundary, not pointer-by-pointer viewport transforms or domain state.
 */
function CanvasBeltMotion({ canvasRef }: { canvasRef: RefObject<HTMLDivElement | null> }) {
  const motionVisible = useFlowStore((state) => state.transform[2] * CELL_SIZE >= minimumAnimatedCellPixels)
  useLayoutEffect(() => {
    const canvas = canvasRef.current
    canvas?.style.setProperty('--base-belt-motion', motionVisible ? 'running' : 'paused')
    return () => {
      canvas?.style.removeProperty('--base-belt-motion')
    }
  }, [canvasRef, motionVisible])
  return null
}

/**
 * Compose React Flow, proposal overlays and the single capture surface.
 * Pan consumes right-drag first; route backtracking and proposal cancellation run only afterwards.
 * Controllers/state live in the editor's hooks; this component owns no domain or interaction session.
 */
export function BaseCanvas({
  canvasRef,
  lastCanvasPointerRef,
  nodes,
  onNodesChange,
  onInit,
  tool,
  hasStations,
  canvasPan,
  nodeMovement,
  stationPlacement,
  placementPreview,
  stationCorridorPreview,
  layoutPasteGeometry,
  pasteOccupied,
  routeDrawingActive,
  backtrackRoute,
  onCancel,
  onActiveStationChange,
  onClearSelection,
}: BaseCanvasProps) {
  const stationBuildActive = stationPlacement.active
  const pastePreview = placementPreview.preview
  return (
    <div
      ref={canvasRef}
      data-base-canvas
      tabIndex={-1}
      aria-label="Base canvas"
      aria-description="Left-drag elements to move, drag background to select, right-drag to pan. Escape cancels previews."
      className="relative min-h-0 min-w-0 flex-1 outline-none"
      onPointerMoveCapture={(event) => {
        lastCanvasPointerRef.current = { x: event.clientX, y: event.clientY }
        if (!canvasPan.handlePointerMove(event)) {
          stationPlacement.handlePointerMove(event)
          placementPreview.handlePointerMove(event)
        }
      }}
      onPointerDownCapture={(event) => {
        lastCanvasPointerRef.current = { x: event.clientX, y: event.clientY }
        if (event.button === 0 && event.target instanceof Element && !event.target.closest('button, input, textarea, select'))
          event.currentTarget.focus({ preventScroll: true })
        if (!canvasPan.handlePointerDown(event)) {
          stationPlacement.handlePointerDown(event)
          placementPreview.handlePointerDown(event)
        }
      }}
      onPointerUpCapture={canvasPan.handlePointerUp}
      onLostPointerCapture={canvasPan.handleLostPointerCapture}
      onContextMenuCapture={(event) => {
        if (canvasPan.handleContextMenu(event)) return
        if (routeDrawingActive && !placementPreview.active && !stationBuildActive && !nodeMovement.active) {
          event.preventDefault()
          event.stopPropagation()
          backtrackRoute()
          return
        }
        // React Flow suppresses pane context callbacks when right-button panning is enabled.
        if (
          stationBuildActive ||
          placementPreview.active ||
          nodeMovement.active ||
          (event.target instanceof Element && event.target.classList.contains('react-flow__pane'))
        ) {
          event.preventDefault()
          event.stopPropagation()
          onCancel()
        }
      }}
      onPointerCancelCapture={() => {
        onCancel()
      }}
    >
      <ReactFlow<StationFlowNode | NoteFlowNode>
        nodes={nodes}
        onNodesChange={onNodesChange}
        edges={[]}
        onInit={onInit}
        nodeTypes={nodeTypes}
        onNodeDragStart={(event, node) => {
          nodeMovement.start(node.id, dragPoint(event))
        }}
        onNodeDrag={(event) => {
          nodeMovement.move(dragPoint(event))
        }}
        onNodeDragStop={(event) => {
          if (!nodeMovement.active) return
          nodeMovement.move(dragPoint(event))
          nodeMovement.end()
        }}
        snapToGrid
        snapGrid={stationSnapGrid}
        panOnDrag={[2]}
        panActivationKeyCode={null}
        selectionOnDrag={tool === 'select' && !placementPreview.active && !stationBuildActive}
        selectionKeyCode={null}
        multiSelectionKeyCode="Shift"
        elevateNodesOnSelect={false}
        nodesFocusable={false}
        disableKeyboardA11y
        autoPanOnNodeFocus={false}
        onNodeClick={(event, node) => {
          if (placementPreview.active || stationBuildActive) return
          if (event.target instanceof Element && event.target.closest('.base-station-grid, button, input, textarea')) return
          if (node.type === 'note') {
            onActiveStationChange(null)
            // React Flow has already applied Shift selection through onNodesChange.
          } else {
            onActiveStationChange(node.id)
          }
        }}
        onPaneClick={() => {
          if (placementPreview.active) {
            return
          }
          onActiveStationChange(null)
          onClearSelection()
        }}
        defaultViewport={{ x: 120, y: 100, zoom: 1 }}
        minZoom={0.2}
        maxZoom={2}
        colorMode="dark"
        deleteKeyCode={null}
        className="bg-background"
      >
        <CanvasBeltMotion canvasRef={canvasRef} />
        {stationPlacement.draft ? (
          <ViewportPortal>
            <StationPreview station={stationPlacement.draft} valid={stationPlacement.valid} corridors={stationCorridorPreview} />
          </ViewportPortal>
        ) : null}
        {layoutPasteGeometry ? (
          <ViewportPortal>
            <LayoutPastePreview {...layoutPasteGeometry} />
          </ViewportPortal>
        ) : null}
        {pastePreview?.kind === 'placements' ? (
          <ViewportPortal>
            <PlacementPastePreview pieces={pastePreview.pieces} valid={pastePreview.valid} occupied={pasteOccupied} />
          </ViewportPortal>
        ) : null}
        <Background variant={BackgroundVariant.Lines} gap={CELL_SIZE} color="hsl(var(--heroui-default-300) / 0.25)" />
      </ReactFlow>
      {/* Capture proposal input once at canvas level; stable tile props avoid a full SVG style pass. */}
      {placementPreview.active || stationBuildActive || nodeMovement.active ? (
        <div data-base-proposal-shield aria-hidden className="absolute inset-0 z-20" />
      ) : null}
      {!hasStations && !stationBuildActive && pastePreview?.kind !== 'layout' ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
          <div className="max-w-sm border border-divider bg-content1/95 p-6 text-center shadow-lg shadow-black/20">
            <Box size={28} aria-hidden className="mx-auto mb-3 text-primary" />
            <h2 className="text-lg font-semibold">Start with a station</h2>
            <p className="mt-1 text-sm text-foreground/75">
              Open Build to add a station, then place machines and draw belts. Your layout saves automatically in this browser.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
