import { BaseToolbar } from './controls/base-toolbar'
import { BaseBuildingsPanel } from './controls/base-buildings-panel'
import { useEditorDialogs } from './dialogs/use-editor-dialogs'
import { EditorDialogs } from './dialogs/editor-dialogs'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBaseDesignerStore } from '@/store/base-designer.store'
import type { ProductionPlan } from '@/features/planner'
import { CELL_SIZE, isRouteTool, type EditorTool, type Direction, type StationType } from '../model/catalog'
import { indexPlacements } from '../lib/layout/placement'
import { useSelectionCommands } from './commands/use-selection-commands'
import { placementProposal, transformedPlacementOwners, type QuarterTurn } from '../lib/layout/layout-transform'
import { useEditorSelection } from './selection/use-editor-selection'
import { machinePorts, rotateDirection } from '../lib/connections/ports'
import { stationPreviewCorridors } from '../lib/layout/stations'
import { createLayoutView } from '../lib/layout/layout-view'
import { createLayoutPasteGeometry } from '../lib/clipboard/clipboard-preview'
import { type RouteAnchor } from '../lib/routes/route'
import { useRouteDrawing } from './routes/use-route-drawing'
import { type PlacementGestureControls, type SelectionPreview } from '../model/station-node'
import { BaseCanvas, type BaseCanvasInstance } from './canvas/base-canvas'
import { useCanvasNodes, type CanvasStationData } from './canvas/use-canvas-nodes'
import { useCanvasPan } from './canvas/use-canvas-pan'
import { useNodeMovement } from './placement/use-node-movement'
import { useStationPlacement } from './placement/use-station-placement'
import { isProductMachine } from '../lib/products/machine-recipes'
import '../styles/base-designer.css'
import { useEditorCommands } from './commands/use-editor-commands'
import { usePlacementPreview } from './placement/use-placement-preview'
import { removalBlockerMessage } from './commands/removal-feedback'

/**
 * Composes the capability owners and arbitrates cross-canvas cancellation/rotation.
 * Confirmed data stays in the store; gesture sessions and their algorithms stay in their own modules.
 */
export function BaseDesigner({ referencePlan = null }: { referencePlan?: ProductionPlan | null }) {
  const stations = useBaseDesignerStore((state) => state.stations)
  const notes = useBaseDesignerStore((state) => state.notes)
  const storageIssue = useBaseDesignerStore((state) => state.storageIssue)
  const addNote = useBaseDesignerStore((state) => state.addNote)
  const updateNote = useBaseDesignerStore((state) => state.updateNote)
  const addStation = useBaseDesignerStore((state) => state.addStation)
  const rotateStation = useBaseDesignerStore((state) => state.rotateStation)
  const commitLayoutMove = useBaseDesignerStore((state) => state.commitLayoutMove)
  const toggleStationLock = useBaseDesignerStore((state) => state.toggleStationLock)
  const pasteLayout = useBaseDesignerStore((state) => state.pasteLayout)
  const pastePlacements = useBaseDesignerStore((state) => state.pastePlacements)
  const undo = useBaseDesignerStore((state) => state.undo)
  const redo = useBaseDesignerStore((state) => state.redo)
  const canUndo = useBaseDesignerStore((state) => state.past.length > 0)
  const canRedo = useBaseDesignerStore((state) => state.future.length > 0)
  const place = useBaseDesignerStore((state) => state.place)
  const placeRoute = useBaseDesignerStore((state) => state.placeRoute)
  const setMachineProduct = useBaseDesignerStore((state) => state.setMachineProduct)
  const setDroneOutput = useBaseDesignerStore((state) => state.setDroneOutput)
  const toggleMachineOutput = useBaseDesignerStore((state) => state.toggleMachineOutput)
  const rotateAt = useBaseDesignerStore((state) => state.rotateAt)
  const transformPlacements = useBaseDesignerStore((state) => state.transformPlacements)
  const [tool, setTool] = useState<EditorTool>('select')
  const [toolDirection, setToolDirection] = useState<Direction>('east')
  const [interactionRevision, setInteractionRevision] = useState(0)
  const canvasRef = useRef<HTMLDivElement>(null)
  const activePlacementGesture = useRef<PlacementGestureControls | null>(null)
  const [placementGestureActive, setPlacementGestureActive] = useState(false)
  const [buildPreviewStationId, setBuildPreviewStationId] = useState<string | null>(null)
  const registerPlacementGesture = useCallback((gesture: PlacementGestureControls) => {
    activePlacementGesture.current = gesture
    setPlacementGestureActive(gesture.canRotate)
    return () => {
      // A late cleanup from an old node must not clear the next node's active gesture.
      if (activePlacementGesture.current !== gesture) return
      activePlacementGesture.current = null
      setPlacementGestureActive(false)
    }
  }, [])
  const reportBuildPreview = useCallback((stationId: string, active: boolean) => {
    setBuildPreviewStationId((current) => (active ? stationId : current === stationId ? null : current))
  }, [])
  const initialFitDone = useRef(false)
  const [activeStationId, setActiveStationId] = useState<string | null>(null)
  const {
    selection,
    setSelection,
    selectedPart,
    selectedAreaIds,
    selectedNodeIds,
    selectedNodeSet,
    selectedAreaSet,
    selectNode,
    selectArea,
    applyNodeChanges,
  } = useEditorSelection()
  const selectStation = useCallback(
    (id: string, additive: boolean) => {
      setActiveStationId(id)
      selectNode(id, additive)
    },
    [selectNode],
  )
  const [selectionPreview, setSelectionPreview] = useState<SelectionPreview | null>(null)
  const lastCanvasPointer = useRef<{ x: number; y: number } | null>(null)
  const [flow, setFlow] = useState<BaseCanvasInstance | null>(null)
  const canvasPan = useCanvasPan({ getViewport: () => flow?.getViewport(), onPan: (viewport) => void flow?.setViewport(viewport) })
  const cancelCanvasPan = canvasPan.cancel
  const nodeMovement = useNodeMovement({
    stations,
    notes,
    selectedIds: selectedNodeIds,
    project: (point) => flow?.screenToFlowPosition(point) ?? point,
    onConfirm: commitLayoutMove,
  })
  const cancelNodeMovement = nodeMovement.cancel
  const renderStations = nodeMovement.stations
  const renderNotes = nodeMovement.notes
  const stationPlacement = useStationPlacement({
    stations,
    project: (point) => flow?.screenToFlowPosition(point) ?? point,
    getBounds: () => canvasRef.current?.getBoundingClientRect(),
    onConfirm: (station) => {
      const id = addStation(station.type, station.position, station.direction)
      if (!id) {
        return false
      }
      initialFitDone.current = true
      setActiveStationId(id)
      setSelection({ kind: 'nodes', ids: [id] })
      return true
    },
  })
  const placementPreview = usePlacementPreview({
    stations,
    project: (point) => flow?.screenToFlowPosition(point) ?? point,
    onConfirm: (proposal) => {
      if (proposal.kind === 'placements') return pastePlacements(proposal.stationId, proposal.source, proposal.cursor) !== null
      const ids = pasteLayout(proposal.draft)
      if (!ids) return false
      initialFitDone.current = true
      return true
    },
  })
  const cancelPlacementPreview = placementPreview.cancel
  const pastePreview = placementPreview.preview
  const layoutPasteGeometry = useMemo(
    () =>
      pastePreview?.kind === 'layout'
        ? createLayoutPasteGeometry({ stations, proposal: pastePreview.draft, valid: pastePreview.valid })
        : null,
    [pastePreview, stations],
  )
  const stationBuildActive = stationPlacement.active
  const stationCorridorPreview = useMemo(
    () => (stationPlacement.draft ? stationPreviewCorridors(stations, stationPlacement.draft) : []),
    [stations, stationPlacement.draft],
  )
  const cancelStationPlacement = stationPlacement.cancel
  const selectedNodeStation = selectedNodeIds.length === 1 ? stations.find((station) => station.id === selectedNodeIds[0]) : undefined
  const selectedStation = selectedPart && stations.find((station) => station.id === selectedPart.stationId)
  const selectedPlacement = selectedStation?.placements.find((piece) => piece.id === selectedPart?.placementId)
  const canConfigureOutputs = Boolean(selectedPlacement && machinePorts(selectedPlacement).length)
  const canChooseProduct = Boolean(selectedPlacement && isProductMachine(selectedPlacement.type))
  const hasStations = stations.length > 0
  const { worldPieces, worldOccupied, corridors, neighborsByStation, droneSourceCells, animatedBelts } = useMemo(
    () => createLayoutView(renderStations),
    [renderStations],
  )
  const {
    draft: routeDraft,
    worldPreviewRoute,
    previewValid: routePreviewValid,
    cancel: cancelRouteDrawing,
    backtrack: backtrackRouteAnchor,
    click: clickRoute,
    startBelt,
    hover: handleRouteHover,
  } = useRouteDrawing({ stations, worldPieces, tool, placeRoute })
  const pasteOccupied = useMemo(() => indexPlacements(pastePreview?.kind === 'placements' ? pastePreview.pieces : []), [pastePreview])
  const hoveredOutputCommand = useRef<(() => void) | null>(null)
  const registerOutputCommand = useCallback((execute: () => void) => {
    hoveredOutputCommand.current = execute
    return () => {
      if (hoveredOutputCommand.current === execute) hoveredOutputCommand.current = null
    }
  }, [])
  // Retire registered node gestures before invalidating all grid captures and canvas proposals.
  // Tool changes, dialogs and history use this same boundary so a release cannot commit an old context.
  const cancelInteraction = useCallback(() => {
    hoveredOutputCommand.current = null
    activePlacementGesture.current?.cancel()
    activePlacementGesture.current = null
    setPlacementGestureActive(false)
    setBuildPreviewStationId(null)
    cancelCanvasPan()
    cancelNodeMovement()
    setInteractionRevision((revision) => revision + 1)
    cancelRouteDrawing()
    setSelectionPreview(null)
    cancelStationPlacement()
    cancelPlacementPreview()
  }, [cancelStationPlacement, cancelPlacementPreview, cancelCanvasPan, cancelNodeMovement, cancelRouteDrawing])
  const selectTool = useCallback(
    (next: EditorTool) => {
      cancelInteraction()
      setTool(next)
      setToolDirection(next === 'material_lab' || next === 'computation_lab' ? 'south' : 'east')
      if (next !== 'select') setSelection(null)
    },
    [cancelInteraction, setSelection],
  )
  const cancelEditing = useCallback(() => selectTool('select'), [selectTool])

  const dialogs = useEditorDialogs({
    stations,
    selectedPart,
    canConfigureOutputs,
    onPrepare: cancelEditing,
    setSelection,
    onActivate: setActiveStationId,
  })
  const { paletteOpen, openMachineItem, openDroneOutput, clearMachineTarget, clearProductTargets } = dialogs
  useEffect(() => {
    if (paletteOpen || !stationBuildActive) return
    const frame = requestAnimationFrame(() => canvasRef.current?.focus({ preventScroll: true }))
    return () => cancelAnimationFrame(frame)
  }, [paletteOpen, stationBuildActive])

  const {
    canPaste,
    pasteDescription,
    pendingRemoval,
    deleteOpen,
    removalCheck,
    copySelection,
    pasteSelection,
    deleteSelection,
    cutSelection,
    confirmStationRemoval,
    closeStationRemoval,
  } = useSelectionCommands({
    selection,
    setSelection,
    stations,
    notes,
    renderStations,
    worldPieces,
    canvasRef,
    lastCanvasPointer,
    onPrepare: cancelEditing,
    onPaste: placementPreview.start,
    onStationRemoved: (id) => {
      if (activeStationId === id) setActiveStationId(null)
    },
    onPartsRemoved: clearMachineTarget,
  })

  const deleteDescription = removalCheck.allowed ? 'Delete · Del. Cut · Ctrl+X.' : removalBlockerMessage(removalCheck.reason)

  const clearSelectionPreview = useCallback(() => setSelectionPreview(null), [])

  const clearMachineItem = useCallback(
    (stationId: string, placementId: string) => {
      selectTool('select')
      setMachineProduct(stationId, placementId, null)
    },
    [selectTool, setMachineProduct],
  )

  const previewAreaMove = useCallback(
    (sourceStationId: string, dx: number, dy: number, turns = 0) => {
      if (dx === 0 && dy === 0 && !turns) {
        setSelectionPreview(null)
        return
      }
      const proposal = placementProposal(
        worldPieces.filter((piece) => selectedAreaSet.has(piece.id)),
        dx,
        dy,
        turns,
      )
      const valid = Boolean(transformedPlacementOwners(stations, proposal))
      setSelectionPreview((current) =>
        current?.sourceStationId === sourceStationId &&
        current.dx === dx &&
        current.dy === dy &&
        current.turns === turns &&
        current.valid === valid
          ? current
          : { sourceStationId, dx, dy, turns, valid },
      )
    },
    [stations, selectedAreaSet, worldPieces],
  )

  useEffect(() => {
    if (!flow || !hasStations || initialFitDone.current) return
    const frame = requestAnimationFrame(() => {
      initialFitDone.current = true
      void flow.fitView({ maxZoom: 1.15, padding: 0.2, duration: 0 })
    })
    return () => cancelAnimationFrame(frame)
  }, [flow, hasStations])

  const backtrackRoute = useCallback(() => {
    if (!backtrackRouteAnchor()) selectTool('select')
  }, [backtrackRouteAnchor, selectTool])

  const handleStartBelt = useCallback(
    (stationId: string, anchor: Extract<RouteAnchor, { kind: 'port' }>) => startBelt(stationId, anchor, selectTool),
    [startBelt, selectTool],
  )

  const handleCell = useCallback(
    (
      stationId: string,
      x: number,
      y: number,
      direction?: Direction,
      portFace?: Direction,
      portRole?: 'input' | 'output',
      portRouteId?: string,
      mergeTargetId?: string,
    ) => {
      const station = stations.find((candidate) => candidate.id === stationId)
      if (isRouteTool(tool)) {
        const anchor: RouteAnchor = portFace
          ? { kind: 'port', x, y, face: portFace, role: portRole, routeId: portRouteId, mergeTargetId }
          : { kind: 'floor', x, y }
        clickRoute(stationId, anchor, selectTool)
      } else if (tool === 'select') {
        if (station?.type === 'drone_station') {
          setSelection({ kind: 'nodes', ids: [stationId] })
          return
        }
        const cellX = (station?.position.x ?? 0) / CELL_SIZE + x
        const cellY = (station?.position.y ?? 0) / CELL_SIZE + y
        const placed =
          station &&
          (worldOccupied.get(`${cellX},${cellY}`) ?? worldPieces.find((piece) => piece.buried && piece.x === cellX && piece.y === cellY))
        setSelection(placed ? { kind: 'part', stationId: placed.stationId, placementId: placed.id } : { kind: 'nodes', ids: [stationId] })
      } else {
        place(stationId, tool, x, y, direction ?? toolDirection)
      }
    },
    [tool, toolDirection, stations, worldOccupied, worldPieces, place, clickRoute, selectTool, setSelection],
  )

  const stationData = useMemo<CanvasStationData>(
    () => ({
      layoutStations: renderStations,
      layoutCorridors: corridors,
      worldPieces,
      worldPreviewRoute,
      interactionRevision,
      animatedBelts,
      droneSourceCells,
      tool,
      toolDirection,
      selectedRouteId: selectedPlacement?.routeId ?? null,
      selectedAreaIds: selectedAreaSet,
      selectionPreview,
      pasteActive: placementPreview.active || stationBuildActive || nodeMovement.active,
      onActivate: setActiveStationId,
      onSelectStation: selectStation,
      onCell: handleCell,
      onPickTool: selectTool,
      onStartBelt: handleStartBelt,
      onOpenMachineItem: openMachineItem,
      onClearMachineItem: clearMachineItem,
      onOpenDroneOutput: openDroneOutput,
      onClearDroneOutput: (stationId, slot) => {
        setDroneOutput(stationId, slot, null)
      },
      onAreaSelect: (ids) => {
        setSelectionPreview(null)
        selectArea(ids)
      },
      onSelectionPreview: previewAreaMove,
      onClearSelectionPreview: clearSelectionPreview,
      onRouteHover: handleRouteHover,
      onTransformPlacements: (proposal) => {
        const moved = transformPlacements(proposal)
        if (moved && selectedPart) {
          const owner = useBaseDesignerStore
            .getState()
            .stations.find((candidate) => candidate.placements.some((piece) => piece.id === selectedPart.placementId))
          if (owner) setSelection({ kind: 'part', stationId: owner.id, placementId: selectedPart.placementId })
        }
        return moved
      },
      onToggleStationLock: toggleStationLock,
      onToggleMachineOutput: toggleMachineOutput,
      onOutputCommand: registerOutputCommand,
      onReleaseTool: cancelEditing,
      onPlacementGesture: registerPlacementGesture,
      onBuildPreviewChange: reportBuildPreview,
      routeDraft,
      routePreviewValid,
    }),
    [
      renderStations,
      nodeMovement.active,
      selectStation,
      placementPreview.active,
      selectedAreaSet,
      selectArea,
      selectionPreview,
      stationBuildActive,
      corridors,
      worldPieces,
      worldPreviewRoute,
      interactionRevision,
      clearSelectionPreview,
      cancelEditing,
      registerPlacementGesture,
      reportBuildPreview,
      animatedBelts,
      droneSourceCells,
      tool,
      toolDirection,
      transformPlacements,
      selectedPart,
      selectedPlacement,
      handleCell,
      handleStartBelt,
      handleRouteHover,
      previewAreaMove,
      toggleStationLock,
      toggleMachineOutput,
      registerOutputCommand,
      routeDraft,
      routePreviewValid,
      selectTool,
      openMachineItem,
      openDroneOutput,
      clearMachineItem,
      setDroneOutput,
      setSelection,
    ],
  )
  const { nodes, onNodesChange: handleNodesChange } = useCanvasNodes({
    stations: renderStations,
    notes: renderNotes,
    stationData,
    neighborsByStation,
    selectedNodeSet,
    selectedPart,
    movementIds: nodeMovement.ids,
    movementValid: nodeMovement.valid,
    draggable: tool === 'select' && !placementPreview.active && !stationBuildActive,
    updateNote,
    onNodeSelectionChange: applyNodeChanges,
  })

  const add = (type: StationType) => {
    selectTool('select')
    setSelection(null)
    stationPlacement.start(type)
  }

  const addLayoutNote = () => {
    const bounds = canvasRef.current?.getBoundingClientRect()
    const position =
      flow && bounds
        ? flow.screenToFlowPosition({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 })
        : { x: 120, y: 120 }
    const id = addNote(position)
    setSelection({ kind: 'nodes', ids: [id] })
    setActiveStationId(null)
    selectTool('select')
  }

  const rotateBuildTool = useCallback((turn: QuarterTurn) => {
    setToolDirection((direction) => {
      let next = direction
      for (let index = 0; index < (turn === 1 ? 1 : 3); index++) next = rotateDirection(next)
      return next
    })
  }, [])
  const rotateTarget = useCallback(() => {
    // The explicit command can orient the build tool from the toolbar, even after leaving its hovered grid.
    if (tool !== 'select' && !isRouteTool(tool)) {
      rotateBuildTool(1)
      return
    }
    selectTool('select')
    if (!selectedPlacement && selectedNodeStation?.type === 'drone_station') {
      rotateStation(selectedNodeStation.id)
      return
    }
    if (!selectedPlacement || !selectedPart) return
    if (selectedPlacement.routeId) return
    rotateAt(selectedPart.stationId, selectedPlacement.x, selectedPlacement.y)
  }, [tool, rotateBuildTool, selectedPlacement, selectedPart, selectedNodeStation, rotateStation, rotateAt, selectTool])

  const rotatePreview = useCallback(
    (turn: QuarterTurn) => {
      // The captured grid gesture has priority over canvas sessions. The first accepting owner consumes Rotate.
      if (
        activePlacementGesture.current?.rotate(turn) ||
        nodeMovement.rotate(turn) ||
        stationPlacement.rotate(turn) ||
        placementPreview.rotate(turn)
      )
        return true
      if (routeDraft && worldPreviewRoute.length) {
        placementPreview.startRoute(routeDraft.type, worldPreviewRoute, turn)
        cancelRouteDrawing()
        setTool('select')
        setSelection(null)
        return true
      }
      if (tool !== 'select' && !isRouteTool(tool) && buildPreviewStationId !== null) {
        rotateBuildTool(turn)
        return true
      }
      return false
    },
    [
      nodeMovement,
      stationPlacement,
      placementPreview,
      tool,
      routeDraft,
      worldPreviewRoute,
      buildPreviewStationId,
      rotateBuildTool,
      cancelRouteDrawing,
      setSelection,
    ],
  )

  const changeHistory = useCallback(
    (action: 'undo' | 'redo') => {
      selectTool('select')
      if (action === 'undo') undo()
      else redo()
      setSelection(null)
      clearProductTargets()
      setActiveStationId(null)
    },
    [selectTool, undo, redo, setSelection, clearProductTargets],
  )

  const commands = useEditorCommands({
    canvasRef,
    blocked: dialogs.blocked || deleteOpen,
    canCopy: Boolean(selectedAreaIds.length || selectedNodeIds.length || selectedPlacement),
    canPaste,
    canDelete: removalCheck.allowed,
    canRotateTarget: Boolean(
      (tool !== 'select' && !isRouteTool(tool)) ||
      (selectedPlacement && !selectedPlacement.routeId) ||
      selectedNodeStation?.type === 'drone_station',
    ),
    canRotatePreview: Boolean(
      placementGestureActive ||
      nodeMovement.active ||
      stationBuildActive ||
      placementPreview.active ||
      (routeDraft && worldPreviewRoute.length) ||
      buildPreviewStationId !== null,
    ),
    canUndo,
    canRedo,
    onCopy: copySelection,
    onPaste: pasteSelection,
    onDelete: deleteSelection,
    onCut: cutSelection,
    onRotateTarget: rotateTarget,
    onRotatePreview: rotatePreview,
    onHistory: changeHistory,
    onCancel: cancelEditing,
    onToggleHoveredOutput: () => {
      const execute = hoveredOutputCommand.current
      if (!execute) return false
      execute()
      return true
    },
  })

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <BaseToolbar
          stations={stations}
          storageIssue={storageIssue}
          tool={tool}
          pasteActive={placementPreview.active}
          stationBuildActive={stationBuildActive}
          hasLayout={Boolean(stations.length || notes.length)}
          canChooseProduct={canChooseProduct}
          canConfigureOutputs={canConfigureOutputs}
          productToggleRef={dialogs.productToggleRef}
          commands={commands}
          pasteDescription={pasteDescription}
          deleteDescription={deleteDescription}
          flow={flow}
          onBuild={dialogs.openPalette}
          onSelect={cancelEditing}
          onAddNote={addLayoutNote}
          onProduct={dialogs.openSelectedProduct}
          onOutputs={dialogs.openOutputs}
        />
        <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
          <BaseCanvas
            canvasRef={canvasRef}
            lastCanvasPointerRef={lastCanvasPointer}
            nodes={nodes}
            onNodesChange={handleNodesChange}
            onInit={setFlow}
            tool={tool}
            hasStations={hasStations}
            canvasPan={canvasPan}
            nodeMovement={nodeMovement}
            stationPlacement={stationPlacement}
            placementPreview={placementPreview}
            stationCorridorPreview={stationCorridorPreview}
            layoutPasteGeometry={layoutPasteGeometry}
            pasteOccupied={pasteOccupied}
            routeDrawingActive={routeDraft !== null}
            backtrackRoute={backtrackRoute}
            onCancel={commands.cancel}
            onActiveStationChange={setActiveStationId}
            onClearSelection={() => setSelection(null)}
          />
          <BaseBuildingsPanel stations={stations} plan={referencePlan} />
        </div>
      </div>

      <EditorDialogs
        dialogs={dialogs}
        stations={stations}
        tool={tool}
        selectTool={selectTool}
        add={add}
        setMachineProduct={setMachineProduct}
        setDroneOutput={setDroneOutput}
        toggleMachineOutput={toggleMachineOutput}
        removal={{ pendingRemoval, confirmStationRemoval, closeStationRemoval }}
      />
    </div>
  )
}
