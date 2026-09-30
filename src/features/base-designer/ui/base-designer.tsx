import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Tooltip } from '@heroui/react'
import { Background, BackgroundVariant, ReactFlow, type ReactFlowInstance } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  Box,
  ClipboardPaste,
  Copy,
  Eraser,
  Factory,
  Hand,
  List,
  Plus,
  Redo2,
  RotateCw,
  Scan,
  Settings2,
  StickyNote,
  Trash2,
  Undo2,
  Zap,
  ZoomIn,
  ZoomOut,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useBaseDesignerStore, type BaseNote } from '@/store/base-designer.store'
import { buildings } from '@/shared/data'
import { CELL_SIZE, PLACEABLES, STATION_TYPES, isRouteTool, type EditorTool, type Direction, type StationType } from '../model/catalog'
import { indexPlacements, type BasePlacement, type BaseStation } from '../lib/placement'
import { externalStationRouteIds } from '../lib/station-clone'
import { clipboardPlacementsAt } from '../lib/clipboard'
import { buildLayoutInventory, inventoryEntryKey, type LayoutInventoryEntry } from '../lib/inventory'
import { connectedProductionBelts, machinePortStates, type CanTraverseEdge } from '../lib/connections'
import { machinePortKey } from '../lib/ports'
import { canCrossStationBoundary, connectedCorridors, droneOutputPorts } from '../lib/stations'
import {
  canMovePlacementsInLayout,
  checkRouteInLayout,
  neighboringPlacements,
  pastePlacementOwners,
  withoutStationOwner,
  worldPlacements,
} from '../lib/world-layout'
import { draftRouteCells, routeCells, sameRouteAnchor, type RouteAnchor, type RouteDraft } from '../lib/route'
import { type PastePreview, type RoutePreviewCell, type SelectionPreview, type StationFlowNode } from '../model/station-node'
import { StationNode } from './station-node'
import { NoteNode, type NoteFlowNode } from './note-node'
import { BuildPaletteModal } from './build-palette-modal'
import { MachineRecipePanel } from './machine-recipe-panel'
import { DroneOutputModal } from './drone-output-modal'
import { BasePlanComparison } from './base-plan-comparison'
import { routeIssueMessage } from './route-issue-message'
import { LayoutInventoryPanel, type LayoutInventoryHandle } from './layout-inventory-panel'
import './base-designer.css'

const nodeTypes = { station: StationNode, note: NoteNode }
const stationSnapGrid: [number, number] = [CELL_SIZE, CELL_SIZE]
const directionSteps: Record<Direction, readonly [number, number]> = {
  north: [0, -1],
  east: [1, 0],
  south: [0, 1],
  west: [-1, 0],
}

type LayoutClipboard =
  | { kind: 'station'; source: BaseStation; externalRouteIds: string[] }
  | { kind: 'placements'; source: BasePlacement[] }
  | { kind: 'note'; source: BaseNote }
interface SelectedPart {
  stationId: string
  placementId: string
}
interface PasteCursor {
  stationId: string
  x: number
  y: number
}

const powerBuildingIds: Partial<Record<keyof typeof PLACEABLES, string>> = {
  refinery: 'refinery',
  assembler: 'fabricator',
  enrichment: 'enrichment',
}
const powerByBuildingId = new Map(buildings.map((building) => [building.id, building.power]))

function focusStationGrid(canvas: HTMLElement | null, stationId: string) {
  const station =
    canvas && [...canvas.querySelectorAll<HTMLElement>('[data-base-station-id]')].find((node) => node.dataset.baseStationId === stationId)
  const grid = station?.querySelector<HTMLElement>('.base-station-grid')
  grid?.focus({ preventScroll: true })
  return Boolean(grid)
}

export function BaseDesigner() {
  const stations = useBaseDesignerStore((state) => state.stations)
  const notes = useBaseDesignerStore((state) => state.notes)
  const addNote = useBaseDesignerStore((state) => state.addNote)
  const cloneNote = useBaseDesignerStore((state) => state.cloneNote)
  const updateNote = useBaseDesignerStore((state) => state.updateNote)
  const moveNote = useBaseDesignerStore((state) => state.moveNote)
  const removeNote = useBaseDesignerStore((state) => state.removeNote)
  const addStation = useBaseDesignerStore((state) => state.addStation)
  const moveStation = useBaseDesignerStore((state) => state.moveStation)
  const toggleStationLock = useBaseDesignerStore((state) => state.toggleStationLock)
  const removeStation = useBaseDesignerStore((state) => state.removeStation)
  const cloneStation = useBaseDesignerStore((state) => state.cloneStation)
  const pastePlacements = useBaseDesignerStore((state) => state.pastePlacements)
  const undo = useBaseDesignerStore((state) => state.undo)
  const redo = useBaseDesignerStore((state) => state.redo)
  const canUndo = useBaseDesignerStore((state) => state.past.length > 0)
  const canRedo = useBaseDesignerStore((state) => state.future.length > 0)
  const place = useBaseDesignerStore((state) => state.place)
  const placeRoute = useBaseDesignerStore((state) => state.placeRoute)
  const movePlacement = useBaseDesignerStore((state) => state.movePlacement)
  const assignRecipe = useBaseDesignerStore((state) => state.assignRecipe)
  const setMachineInputItem = useBaseDesignerStore((state) => state.setMachineInputItem)
  const setDroneOutput = useBaseDesignerStore((state) => state.setDroneOutput)
  const toggleMachineOutput = useBaseDesignerStore((state) => state.toggleMachineOutput)
  const moveRoute = useBaseDesignerStore((state) => state.moveRoute)
  const rotateAt = useBaseDesignerStore((state) => state.rotateAt)
  const removeAt = useBaseDesignerStore((state) => state.removeAt)
  const removePlacements = useBaseDesignerStore((state) => state.removePlacements)
  const movePlacements = useBaseDesignerStore((state) => state.movePlacements)
  const [tool, setTool] = useState<EditorTool>('select')
  const [interactionRevision, setInteractionRevision] = useState(0)
  const [routeDraft, setRouteDraft] = useState<RouteDraft | null>(null)
  const worldPreviewRoute = useMemo<RoutePreviewCell[]>(() => {
    if (!routeDraft) return []
    const cells = draftRouteCells(routeDraft)
    return cells.map((cell, index) => ({
      ...cell,
      buried: routeDraft.type.startsWith('underground') && index > 0 && index < cells.length - 1,
      routeIndex: index,
    }))
  }, [routeDraft])
  const routePreviewCheck = useMemo(
    () => (routeDraft ? checkRouteInLayout(stations, routeDraft.stationId, worldPreviewRoute, new Set(), routeDraft.type) : null),
    [routeDraft, worldPreviewRoute, stations],
  )
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [inventoryOpen, setInventoryOpen] = useState(false)
  const inventoryRef = useRef<LayoutInventoryHandle>(null)
  const inventoryToggleRef = useRef<HTMLButtonElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const inspectorRef = useRef<HTMLElement>(null)
  const inspectorToggleRef = useRef<HTMLButtonElement>(null)
  const [hiddenInspectorId, setHiddenInspectorId] = useState<string | null>(null)
  const initialFitDone = useRef(false)
  const [activeStationId, setActiveStationId] = useState<string | null>(null)
  const [selectedPart, setSelectedPart] = useState<SelectedPart | null>(null)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>([])
  const [droneModalStationId, setDroneModalStationId] = useState<string | null>(null)
  const [activeDroneSlot, setActiveDroneSlot] = useState<0 | 1>(0)
  const [selectionPreview, setSelectionPreview] = useState<SelectionPreview | null>(null)
  const [clipboard, setClipboard] = useState<LayoutClipboard | null>(null)
  const [pendingPaste, setPendingPaste] = useState<readonly BasePlacement[] | null>(null)
  const [pasteCursor, setPasteCursor] = useState<PasteCursor | null>(null)
  const lastFloorCursor = useRef<PasteCursor | null>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [flow, setFlow] = useState<ReactFlowInstance<StationFlowNode | NoteFlowNode> | null>(null)
  const activeStation = stations.find((station) => station.id === activeStationId)
  const droneModalStation = stations.find((station) => station.id === droneModalStationId && station.type === 'drone_station') ?? null
  const selectedStation = selectedPart && stations.find((station) => station.id === selectedPart.stationId)
  const selectedPlacement = selectedStation?.placements.find((piece) => piece.id === selectedPart?.placementId)
  const hasSelectedMachine = Boolean(selectedPlacement && PLACEABLES[selectedPlacement.type].category === 'machine')
  const inspectorVisible = hasSelectedMachine && !inventoryOpen && selectedPlacement?.id !== hiddenInspectorId
  const hasStations = stations.length > 0
  const inventoryEntries = useMemo(() => buildLayoutInventory(stations), [stations])
  const selectedInventoryKey = selectedPlacement ? inventoryEntryKey(selectedPlacement) : null
  const selectedNote = notes.find((note) => note.id === selectedNoteId)
  const selectedAreaSet = useMemo(() => new Set(selectedAreaIds), [selectedAreaIds])
  const machines = useMemo(
    () => stations.flatMap((station) => station.placements).filter((piece) => PLACEABLES[piece.type].category === 'machine'),
    [stations],
  )
  const knownEnergyUse = machines.reduce((sum, piece) => sum + (powerByBuildingId.get(powerBuildingIds[piece.type] ?? '') ?? 0), 0)
  const unknownEnergyUse = machines.filter((piece) => powerByBuildingId.get(powerBuildingIds[piece.type] ?? '') === undefined).length
  const reactors = machines.filter((piece) => piece.type === 'reactor').length
  const requiredEnergyLabel = unknownEnergyUse
    ? knownEnergyUse > 0
      ? `≥${knownEnergyUse.toFixed(1)} MJ`
      : '— MJ'
    : `${knownEnergyUse.toFixed(1)} MJ`
  const worldPieces = useMemo(() => worldPlacements(stations), [stations])
  const worldOccupied = useMemo(() => indexPlacements(worldPieces), [worldPieces])
  const corridors = useMemo(() => connectedCorridors(stations), [stations])
  const neighborsByStation = useMemo(
    () => new Map(stations.map((station) => [station.id, neighboringPlacements(station, corridors, worldPieces)])),
    [stations, corridors, worldPieces],
  )
  const dronePorts = useMemo(() => stations.flatMap(droneOutputPorts).filter((port) => port.itemId), [stations])
  const droneSourceCells = useMemo(() => new Set(dronePorts.map((port) => `${port.x},${port.y}`)), [dronePorts])
  const canTraverseWorld = useCallback<CanTraverseEdge>(
    (x, y, face) => {
      const [dx, dy] = directionSteps[face]
      return canCrossStationBoundary(stations, { x, y }, { x: x + dx, y: y + dy }, corridors)
    },
    [stations, corridors],
  )
  const animatedBelts = useMemo(
    () => connectedProductionBelts(worldPieces, worldOccupied, canTraverseWorld, dronePorts),
    [worldPieces, worldOccupied, canTraverseWorld, dronePorts],
  )
  const selectedWorldPlacement = selectedPart ? worldPieces.find((piece) => piece.id === selectedPart.placementId) : undefined
  const selectedPorts = selectedWorldPlacement ? machinePortStates(worldOccupied, selectedWorldPlacement, canTraverseWorld) : []
  const pastePreview = useMemo<PastePreview | null>(() => {
    if (!pendingPaste || !pasteCursor) return null
    const station = stations.find((candidate) => candidate.id === pasteCursor.stationId)
    if (!station) return null
    const pieces = clipboardPlacementsAt(pendingPaste, {
      x: station.position.x / CELL_SIZE + pasteCursor.x,
      y: station.position.y / CELL_SIZE + pasteCursor.y,
    })
    return { stationId: station.id, pieces, valid: Boolean(pastePlacementOwners(stations, station.id, pieces)) }
  }, [pendingPaste, pasteCursor, stations])
  const statusMessage =
    pastePreview?.valid === false
      ? 'Copy does not fit here. Choose connected, empty floor; nothing has been pasted.'
      : routePreviewCheck?.ok === false && routeDraft
        ? routeIssueMessage(routePreviewCheck.issue, routeDraft.type)
        : notice
  const activeToolLabel = pendingPaste
    ? 'Place copied parts · click to confirm · Esc to cancel'
    : tool === 'select'
      ? 'Select parts · Shift-drag for an area (parts only)'
      : tool === 'erase'
        ? 'Erase'
        : PLACEABLES[tool].label

  const selectTool = useCallback((next: EditorTool) => {
    useBaseDesignerStore.getState().cancelMove()
    setInteractionRevision((revision) => revision + 1)
    setTool(next)
    setRouteDraft(null)
    setNotice(null)
    setSelectionPreview(null)
    setPendingPaste(null)
    setPasteCursor(null)
    if (next !== 'select') setSelectedAreaIds([])
  }, [])

  const clearSelectionPreview = useCallback(() => setSelectionPreview(null), [])

  const selectInventoryEntry = useCallback(
    (entry: LayoutInventoryEntry) => {
      selectTool('select')
      setSelectedAreaIds([])
      setSelectedNoteId(null)
      setSelectedPart({ stationId: entry.stationId, placementId: entry.placement.id })
      setActiveStationId(entry.stationId)
      setNotice(
        `${PLACEABLES[entry.placement.type].label}${entry.kind === 'route' ? ` route · ${entry.cellCount} cells` : ''} selected from inventory.`,
      )
    },
    [selectTool],
  )

  const locateInventoryEntry = useCallback(
    (entry: LayoutInventoryEntry) => {
      selectInventoryEntry(entry)
      if (flow) void flow.fitBounds(entry.bounds, { padding: 0.35, duration: 0 })
      requestAnimationFrame(() => focusStationGrid(canvasRef.current, entry.stationId))
    },
    [flow, selectInventoryEntry],
  )

  const closeInventory = useCallback(() => {
    setInventoryOpen(false)
    requestAnimationFrame(() => inventoryToggleRef.current?.focus({ preventScroll: true }))
  }, [])

  const openInspector = useCallback(() => {
    setInventoryOpen(false)
    setHiddenInspectorId(null)
    requestAnimationFrame(() => inspectorRef.current?.focus({ preventScroll: true }))
  }, [])

  const closeInspector = useCallback(() => {
    setHiddenInspectorId(selectedPlacement?.id ?? null)
    requestAnimationFrame(() => inspectorToggleRef.current?.focus({ preventScroll: true }))
  }, [selectedPlacement?.id])

  const handlePasteHover = useCallback(
    (stationId: string, x: number, y: number) => {
      const previous = lastFloorCursor.current
      lastFloorCursor.current = { stationId, x, y }
      if (!pendingPaste) return
      if (previous?.stationId !== stationId || previous.x !== x || previous.y !== y) setNotice(null)
      setPasteCursor((current) => (current?.stationId === stationId && current.x === x && current.y === y ? current : { stationId, x, y }))
    },
    [pendingPaste],
  )

  const handlePasteLeave = useCallback((stationId: string) => {
    setPasteCursor((current) => (current?.stationId === stationId ? null : current))
  }, [])

  const handlePasteCell = useCallback(
    (stationId: string, x: number, y: number) => {
      if (!pendingPaste) return
      const station = stations.find((candidate) => candidate.id === stationId)
      if (!station) return
      handlePasteHover(stationId, x, y)
      const id = pastePlacements(stationId, pendingPaste, { x: station.position.x / CELL_SIZE + x, y: station.position.y / CELL_SIZE + y })
      if (!id) {
        setNotice('Copy does not fit here. Choose connected, empty floor; nothing has been pasted.')
        return
      }
      const owner = useBaseDesignerStore.getState().stations.find((candidate) => candidate.placements.some((piece) => piece.id === id))
      setSelectedPart(owner ? { stationId: owner.id, placementId: id } : null)
      setActiveStationId(owner?.id ?? stationId)
      setSelectedAreaIds([])
      setSelectedNoteId(null)
      setPendingPaste(null)
      setPasteCursor(null)
      setNotice('Copy placed. Ctrl+V to place another.')
    },
    [pendingPaste, stations, pastePlacements, handlePasteHover],
  )

  const previewAreaMove = useCallback(
    (sourceStationId: string, dx: number, dy: number) => {
      if (dx === 0 && dy === 0) {
        setSelectionPreview(null)
        return
      }
      const valid = canMovePlacementsInLayout(stations, selectedAreaIds, dx, dy)
      setSelectionPreview((current) =>
        current?.sourceStationId === sourceStationId && current.dx === dx && current.dy === dy && current.valid === valid
          ? current
          : { sourceStationId, dx, dy, valid },
      )
    },
    [stations, selectedAreaIds],
  )

  useEffect(() => {
    if (!flow || !hasStations || initialFitDone.current) return
    const frame = requestAnimationFrame(() => {
      initialFitDone.current = true
      void flow.fitView({ maxZoom: 1.15, padding: 0.2, duration: 0 })
    })
    return () => cancelAnimationFrame(frame)
  }, [flow, hasStations])

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
        if (!station) return
        const worldX = station.position.x / CELL_SIZE + x
        const worldY = station.position.y / CELL_SIZE + y
        const point: RouteAnchor = portFace
          ? { kind: 'port', x: worldX, y: worldY, face: portFace, role: portRole, routeId: portRouteId, mergeTargetId }
          : { kind: 'floor', x: worldX, y: worldY }
        if (!routeDraft || routeDraft.type !== tool) {
          if (point.kind === 'port' && point.role === 'input') {
            setNotice('Start from an output, or from an empty floor cell.')
            return
          }
          const startCheck = checkRouteInLayout(stations, stationId, routeCells([point]), new Set(), tool)
          if (!startCheck.ok) {
            setNotice(routeIssueMessage(startCheck.issue, tool))
            return
          }
          setRouteDraft({ stationId, type: tool, anchors: [point], hover: point })
          setNotice('Click to add anchors, click a machine port to connect, or click the last anchor again to finish.')
          return
        }
        const last = routeDraft.anchors[routeDraft.anchors.length - 1]
        if (point.kind === 'port') {
          if (point.role === 'output') {
            setNotice('Finish at an input, or on an empty floor cell.')
            return
          }
          if (last.kind === 'port' && last.x === worldX && last.y === worldY && last.face === point.face) {
            setNotice('Choose another port or floor cell to continue this belt.')
            return
          }
          const cells = routeCells([...routeDraft.anchors, point])
          const routeCheck = checkRouteInLayout(stations, routeDraft.stationId, cells, new Set(), tool, true)
          if (!routeCheck.ok) {
            setNotice(routeIssueMessage(routeCheck.issue, tool))
            return
          }
          const mergeIds = [routeDraft.anchors[0], point]
            .filter((anchor): anchor is Extract<RouteAnchor, { kind: 'port' }> => anchor.kind === 'port')
            .flatMap((anchor) => (anchor.routeId ? [anchor.routeId] : []))
          if (
            placeRoute(
              routeDraft.stationId,
              tool,
              cells,
              mergeIds,
              point.mergeTargetId ? { targetId: point.mergeTargetId, face: point.face } : undefined,
            )
          ) {
            setRouteDraft(null)
            setNotice(null)
          } else {
            setNotice('This belt cannot join at that port. Approach its input from the open side or choose another endpoint.')
          }
          return
        }
        if (last.x === worldX && last.y === worldY) {
          const cells = routeCells(routeDraft.anchors)
          const routeCheck = checkRouteInLayout(stations, routeDraft.stationId, cells, new Set(), tool, true)
          if (!routeCheck.ok) {
            setNotice(routeIssueMessage(routeCheck.issue, tool))
            return
          }
          const start = routeDraft.anchors[0]
          if (placeRoute(routeDraft.stationId, tool, cells, start.kind === 'port' && start.routeId ? [start.routeId] : [])) {
            setRouteDraft(null)
            setNotice(null)
          } else {
            setNotice('This belt cannot join its starting route. Choose another endpoint or redraw the route.')
          }
          return
        }
        const anchors = [...routeDraft.anchors, point]
        const segmentCheck = checkRouteInLayout(stations, routeDraft.stationId, routeCells(anchors), new Set(), tool)
        if (!segmentCheck.ok) {
          setNotice(routeIssueMessage(segmentCheck.issue, tool))
          return
        }
        setRouteDraft({ ...routeDraft, anchors, hover: point })
        setNotice('Anchor added. Click another point, or click this anchor again to finish.')
      } else if (tool === 'select') {
        setSelectedNoteId(null)
        setSelectedAreaIds([])
        if (station?.type === 'drone_station') {
          setSelectedPart(null)
          setNotice('Drone module: click either drone to choose its item. Nothing can be built inside it.')
          return
        }
        const placed = station && worldOccupied.get(`${station.position.x / CELL_SIZE + x},${station.position.y / CELL_SIZE + y}`)
        const owner = placed && stations.find((candidate) => candidate.id === placed.stationId)
        setSelectedPart(placed ? { stationId: placed.stationId, placementId: placed.id } : null)
        const routeLength = placed?.routeId ? worldPieces.filter((piece) => piece.routeId === placed.routeId).length : 0
        setNotice(
          placed?.routeId
            ? `${PLACEABLES[placed.type].label} route · ${routeLength} cells. Drag to move the whole route.`
            : placed
              ? `${PLACEABLES[placed.type].label} · cell ${placed.x - (owner?.position.x ?? station.position.x) / CELL_SIZE + 1}, ${placed.y - (owner?.position.y ?? station.position.y) / CELL_SIZE + 1}`
              : `Empty cell ${x + 1}, ${y + 1}`,
        )
      } else if (tool === 'erase') {
        const placed = station && worldOccupied.get(`${station.position.x / CELL_SIZE + x},${station.position.y / CELL_SIZE + y}`)
        const owner = placed && stations.find((candidate) => candidate.id === placed.stationId)
        if (placed && owner) removeAt(owner.id, placed.x - owner.position.x / CELL_SIZE, placed.y - owner.position.y / CELL_SIZE)
        setSelectedPart(null)
        setNotice(null)
      } else if (place(stationId, tool, x, y, direction)) {
        setNotice(null)
      } else {
        setNotice(
          station?.type === 'drone_station'
            ? 'Drone modules have no buildable interior. Start belts at an output port.'
            : 'No space here. Choose an empty area inside the station.',
        )
      }
    },
    [tool, stations, worldOccupied, worldPieces, routeDraft, place, placeRoute, removeAt],
  )

  const handleRouteHover = useCallback(
    (stationId: string, anchor: RouteAnchor) => {
      const station = stations.find((candidate) => candidate.id === stationId)
      if (!station) return
      const hover = { ...anchor, x: anchor.x + station.position.x / CELL_SIZE, y: anchor.y + station.position.y / CELL_SIZE }
      const previousHover = routeDraft?.hover
      if (previousHover && !sameRouteAnchor(previousHover, hover)) setNotice(null)
      setRouteDraft((draft) => {
        if (!draft || draft.type !== tool) return draft
        const previous = draft.hover
        if (sameRouteAnchor(previous, hover)) return draft
        return { ...draft, hover }
      })
    },
    [routeDraft, stations, tool],
  )

  const handleMovePlacement = useCallback(
    (stationId: string, placementId: string, x: number, y: number) => {
      if (!movePlacement(stationId, placementId, x, y)) return false
      const owner = useBaseDesignerStore.getState().stations.find((station) => station.placements.some((piece) => piece.id === placementId))
      if (owner) {
        setActiveStationId(owner.id)
        setSelectedPart({ stationId: owner.id, placementId })
      }
      setNotice(null)
      return true
    },
    [movePlacement],
  )

  const handleToggleMachineOutput = useCallback(
    (stationId: string, placementId: string, face: Direction, offset: number) => {
      if (!toggleMachineOutput(stationId, placementId, face, offset)) {
        setNotice('This port is no longer available. Select the machine again.')
        return
      }
      const machine = useBaseDesignerStore
        .getState()
        .stations.find((station) => station.id === stationId)
        ?.placements.find((piece) => piece.id === placementId)
      const disabled = machine?.disabledOutputPorts?.includes(machinePortKey({ face, offset }))
      setNotice(`Output ${disabled ? 'disabled' : 'enabled'}. Input belts stay connected. Hover a port and press F to toggle output.`)
    },
    [toggleMachineOutput],
  )

  const nodes = useMemo<(StationFlowNode | NoteFlowNode)[]>(
    () => [
      ...stations.map((station): StationFlowNode => ({
        id: station.id,
        type: 'station',
        position: station.position,
        data: {
          station,
          layoutStations: stations,
          layoutCorridors: corridors,
          worldPieces,
          worldPreviewRoute,
          interactionRevision,
          externalPlacements: neighborsByStation.get(station.id) ?? [],
          animatedBelts,
          droneSourceCells,
          tool,
          active: station.id === activeStationId,
          selectedPlacementId: selectedPart?.stationId === station.id ? selectedPart.placementId : null,
          selectedRouteId: selectedPlacement?.routeId ?? null,
          selectedAreaIds: selectedAreaSet,
          selectionPreview,
          pasteActive: pendingPaste !== null,
          pastePreview,
          onPasteHover: handlePasteHover,
          onPasteLeave: handlePasteLeave,
          onPasteCell: handlePasteCell,
          onActivate: setActiveStationId,
          onCell: handleCell,
          onPickTool: selectTool,
          onOpenDroneOutput: (stationId, slot) => {
            selectTool('select')
            setDroneModalStationId(stationId)
            setActiveDroneSlot(slot)
            setSelectedPart(null)
            setNotice(null)
          },
          onAreaSelect: (ids) => {
            setSelectionPreview(null)
            setSelectedAreaIds(ids)
            setSelectedPart(null)
            setSelectedNoteId(null)
            setNotice(
              ids.length
                ? `${ids.length} parts selected (no stations or notes). Drag to move, Shift + arrows to nudge, Ctrl+C to copy, or Delete to remove.`
                : 'No parts in this area. Stations and notes are selected individually.',
            )
          },
          onMoveArea: (ids, dx, dy) => {
            const moved = movePlacements(ids, dx, dy)
            setNotice(moved ? null : 'Selection cannot move onto a wall, gap, or occupied floor.')
            return moved
          },
          onSelectionPreview: previewAreaMove,
          onClearSelectionPreview: clearSelectionPreview,
          onRouteHover: handleRouteHover,
          onMovePlacement: handleMovePlacement,
          onMoveRoute: moveRoute,
          onToggleStationLock: toggleStationLock,
          onToggleMachineOutput: handleToggleMachineOutput,
          onReleaseTool: () => selectTool('select'),
          routeDraft,
          routePreviewValid: routePreviewCheck?.ok ?? false,
        },
        draggable: tool === 'select' && pendingPaste === null,
        selectable: true,
        zIndex: station.placements.some((piece) => {
          const footprint = PLACEABLES[piece.type]
          const size = STATION_TYPES[station.type].footprintCells
          return piece.x < 0 || piece.y < 0 || piece.x + footprint.width > size || piece.y + footprint.height > size
        })
          ? 2
          : 0,
      })),
      ...notes.map((note): NoteFlowNode => ({
        id: note.id,
        type: 'note',
        position: note.position,
        data: { text: note.text, selected: note.id === selectedNoteId, onCommit: (text) => updateNote(note.id, text) },
        dragHandle: '.base-note-handle',
        draggable: tool === 'select' && pendingPaste === null,
        selectable: true,
        zIndex: 8,
      })),
    ],
    [
      stations,
      notes,
      selectedNoteId,
      selectedAreaSet,
      selectionPreview,
      pendingPaste,
      pastePreview,
      handlePasteHover,
      handlePasteLeave,
      handlePasteCell,
      updateNote,
      corridors,
      neighborsByStation,
      worldPieces,
      worldPreviewRoute,
      interactionRevision,
      clearSelectionPreview,
      animatedBelts,
      droneSourceCells,
      tool,
      activeStationId,
      selectedPart,
      selectedPlacement,
      handleCell,
      handleRouteHover,
      handleMovePlacement,
      moveRoute,
      movePlacements,
      previewAreaMove,
      toggleStationLock,
      handleToggleMachineOutput,
      routeDraft,
      routePreviewCheck,
      selectTool,
    ],
  )

  const add = (type: StationType) => {
    addStation(type)
    setNotice('Station added. Use Fit layout if it is outside the current view.')
  }

  const addLayoutNote = () => {
    const bounds = canvasRef.current?.getBoundingClientRect()
    const position =
      flow && bounds
        ? flow.screenToFlowPosition({ x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 })
        : { x: 120, y: 120 }
    const id = addNote(position)
    setSelectedNoteId(id)
    setSelectedPart(null)
    setSelectedAreaIds([])
    setActiveStationId(null)
    selectTool('select')
  }

  const copySelection = useCallback(() => {
    selectTool('select')
    setPendingPaste(null)
    setPasteCursor(null)
    if (selectedAreaIds.length) {
      const source = worldPieces.filter((piece) => selectedAreaSet.has(piece.id)).map(withoutStationOwner)
      setClipboard({ kind: 'placements', source })
      setNotice(`${source.length} parts copied, including whole routes. Stations and notes are not included.`)
    } else if (selectedNote) {
      setClipboard({ kind: 'note', source: selectedNote })
      setNotice('Note copied.')
    } else if (selectedPlacement && selectedStation) {
      const source = selectedPlacement.routeId
        ? worldPieces
            .filter((piece) => piece.routeId === selectedPlacement.routeId)
            .map((piece) => ({
              ...withoutStationOwner(piece),
              x: piece.x - selectedStation.position.x / CELL_SIZE,
              y: piece.y - selectedStation.position.y / CELL_SIZE,
            }))
        : [selectedPlacement]
      setClipboard({ kind: 'placements', source })
      setNotice(`${source.length > 1 ? 'Route' : PLACEABLES[selectedPlacement.type].label} copied.`)
    } else if (activeStation) {
      setClipboard({ kind: 'station', source: activeStation, externalRouteIds: externalStationRouteIds(stations, activeStation.id) })
      setNotice(`${activeStation.name} copied.`)
    }
  }, [selectedAreaIds, selectedAreaSet, selectedNote, selectedPlacement, selectedStation, activeStation, stations, worldPieces, selectTool])

  const pasteSelection = useCallback(() => {
    if (!clipboard) return
    selectTool('select')
    if (clipboard.kind === 'note') {
      const id = cloneNote(clipboard.source)
      setSelectedNoteId(id)
      setSelectedPart(null)
      setActiveStationId(null)
      setNotice('Note copied to the canvas.')
      return
    }
    if (clipboard.kind === 'station') {
      const result = cloneStation(clipboard.source, clipboard.externalRouteIds)
      setActiveStationId(result.id)
      setSelectedPart(null)
      const omitted = [
        result.skippedRoutes ? `${result.skippedRoutes} route${result.skippedRoutes === 1 ? '' : 's'}` : null,
        result.skippedParts ? `${result.skippedParts} part${result.skippedParts === 1 ? '' : 's'}` : null,
      ].filter(Boolean)
      setNotice(
        omitted.length
          ? `Station copied. Not included: ${omitted.join(' and ')} extending beyond this module.`
          : 'Station copied to the canvas.',
      )
      return
    }
    setPendingPaste(clipboard.source)
    setPasteCursor(lastFloorCursor.current)
    setSelectedPart(null)
    setSelectedNoteId(null)
    setSelectedAreaIds([])
    setNotice('Move onto station floor to preview this copy. Click or press Enter to place; Esc or right-click cancels.')
    const stationId = selectedPart?.stationId ?? activeStationId ?? stations[0]?.id
    if (stationId) requestAnimationFrame(() => focusStationGrid(canvasRef.current, stationId))
  }, [clipboard, cloneNote, cloneStation, selectTool, selectedPart, activeStationId, stations])

  const deleteSelection = useCallback(() => {
    selectTool('select')
    setPendingPaste(null)
    setPasteCursor(null)
    if (selectedAreaIds.length) {
      removePlacements(selectedAreaIds)
      setSelectedAreaIds([])
      setNotice(null)
    } else if (selectedNote) {
      removeNote(selectedNote.id)
      setSelectedNoteId(null)
      setNotice(null)
    } else if (selectedPlacement && selectedPart) {
      const restoreInventoryFocus = inventoryRef.current?.containsFocus()
      const restoreCanvasFocus = inspectorRef.current?.contains(document.activeElement)
      const index = inventoryEntries.findIndex((entry) => entry.key === selectedInventoryKey)
      const next = index >= 0 ? (inventoryEntries[index + 1] ?? inventoryEntries[index - 1]) : undefined
      removeAt(selectedPart.stationId, selectedPlacement.x, selectedPlacement.y)
      setSelectedPart(null)
      if (restoreInventoryFocus) {
        if (next) selectInventoryEntry(next)
        requestAnimationFrame(() => inventoryRef.current?.focusEntry(next?.key))
      } else if (restoreCanvasFocus) {
        requestAnimationFrame(() => focusStationGrid(canvasRef.current, selectedPart.stationId))
      }
      setNotice(`${PLACEABLES[selectedPlacement.type].label}${selectedPlacement.routeId ? ' route' : ''} removed.`)
    } else if (activeStationId) {
      setDeleteOpen(true)
    }
  }, [
    selectedAreaIds,
    selectedNote,
    selectedPlacement,
    selectedPart,
    activeStationId,
    removePlacements,
    removeNote,
    removeAt,
    inventoryEntries,
    selectedInventoryKey,
    selectInventoryEntry,
    selectTool,
  ])

  const rotateSelection = useCallback(() => {
    selectTool('select')
    if (!selectedPlacement || !selectedPart) return
    if (selectedPlacement.routeId) {
      setNotice('Redraw a belt route to change its turns.')
      return
    }
    const focusedControl = document.activeElement
    const fromInspector = inspectorRef.current?.contains(focusedControl)
    rotateAt(selectedPart.stationId, selectedPlacement.x, selectedPlacement.y)
    if (fromInspector)
      requestAnimationFrame(() => {
        if (!focusedControl?.isConnected) inspectorRef.current?.focus({ preventScroll: true })
      })
  }, [selectedPlacement, selectedPart, rotateAt, selectTool])

  const changeHistory = useCallback(
    (action: 'undo' | 'redo') => {
      const fromInventory = inventoryRef.current?.containsFocus()
      const fromInspector = inspectorRef.current?.contains(document.activeElement)
      const stationId = selectedPart?.stationId
      selectTool('select')
      if (action === 'undo') undo()
      else redo()
      setSelectedPart(null)
      setSelectedAreaIds([])
      setSelectedNoteId(null)
      setDroneModalStationId(null)
      setActiveStationId(null)
      requestAnimationFrame(() => {
        if (fromInventory) inventoryRef.current?.focusEntry()
        else if (fromInspector && (!stationId || !focusStationGrid(canvasRef.current, stationId)))
          inventoryToggleRef.current?.focus({ preventScroll: true })
      })
    },
    [selectedPart, selectTool, undo, redo],
  )

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (
        paletteOpen ||
        deleteOpen ||
        (event.target instanceof HTMLElement && event.target.closest('input, textarea, [contenteditable="true"], [role="dialog"]'))
      )
        return
      if (event.defaultPrevented || event.repeat) return
      const command = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()
      if (command && key === 'z') {
        event.preventDefault()
        changeHistory(event.shiftKey ? 'redo' : 'undo')
      } else if (command && key === 'y') {
        event.preventDefault()
        changeHistory('redo')
      } else if (command && key === 'c') {
        event.preventDefault()
        copySelection()
      } else if (command && key === 'v') {
        event.preventDefault()
        pasteSelection()
      } else if (command && key === 'x') {
        event.preventDefault()
        copySelection()
        deleteSelection()
      } else if (!command && (key === 'delete' || key === 'backspace')) {
        event.preventDefault()
        deleteSelection()
      } else if (!command && key === 'r' && selectedPart) {
        event.preventDefault()
        rotateSelection()
      } else if (key === 'escape') {
        selectTool('select')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    const onBlur = () => selectTool('select')
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('blur', onBlur)
    }
  }, [paletteOpen, deleteOpen, selectedPart, copySelection, pasteSelection, deleteSelection, rotateSelection, changeHistory, selectTool])

  return (
    <div className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-background">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2 border-b border-divider bg-content1 px-3 py-2 sm:px-4">
          <Button
            size="sm"
            color="primary"
            className="rounded-sm"
            onPress={() => {
              selectTool('select')
              setPaletteOpen(true)
            }}
            startContent={<Plus size={14} aria-hidden />}
          >
            Build
          </Button>
          <Button
            size="sm"
            variant={tool === 'select' && !pendingPaste ? 'solid' : 'flat'}
            color={tool === 'select' && !pendingPaste ? 'primary' : 'default'}
            onPress={() => selectTool('select')}
            startContent={<Hand size={14} />}
            aria-pressed={tool === 'select' && !pendingPaste}
          >
            Select
          </Button>
          <Button
            size="sm"
            variant={tool === 'erase' ? 'solid' : 'flat'}
            color={tool === 'erase' ? 'primary' : 'default'}
            onPress={() => selectTool('erase')}
            startContent={<Eraser size={14} />}
            aria-pressed={tool === 'erase'}
          >
            Erase
          </Button>
          <Button size="sm" variant="flat" onPress={addLayoutNote} startContent={<StickyNote size={14} aria-hidden />}>
            Note
          </Button>
          <Button
            ref={inventoryToggleRef}
            size="sm"
            variant="flat"
            aria-expanded={inventoryOpen}
            aria-controls="base-layout-inventory"
            onPress={() => {
              if (inventoryOpen) closeInventory()
              else {
                setInventoryOpen(true)
                requestAnimationFrame(() => inventoryRef.current?.focusEntry(selectedInventoryKey))
              }
            }}
            startContent={<List size={14} aria-hidden />}
          >
            Inventory
          </Button>
          <Button
            ref={inspectorToggleRef}
            size="sm"
            variant="flat"
            isDisabled={!hasSelectedMachine}
            aria-expanded={inspectorVisible}
            aria-controls="base-machine-inspector"
            onPress={inspectorVisible ? closeInspector : openInspector}
            startContent={<Settings2 size={14} aria-hidden />}
          >
            Inspector
          </Button>
          <BasePlanComparison stations={stations} />
        </div>
        <div className="flex min-w-0 items-center justify-between gap-3 border-b border-divider bg-content1 px-3 py-1.5 text-xs text-foreground/75 sm:px-4">
          <span className="min-w-0 flex-1 truncate" title={activeToolLabel}>
            {activeToolLabel}
          </span>
          <span className="shrink-0">{activeStation?.name ?? `${stations.length} stations`}</span>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-divider bg-content1 px-3 py-1.5 sm:px-4">
          <div className="flex flex-wrap gap-1.5 text-xs">
            <span className="py-1 text-foreground/80 tabular-nums" title="Placed production and support machines">
              <Factory size={13} aria-hidden className="mr-1.5 inline text-primary" />
              {machines.length} buildings
            </span>
            <span
              className="py-1 text-foreground/80 tabular-nums"
              title={
                unknownEnergyUse
                  ? `${unknownEnergyUse} placed structures have no power-use value in the source catalog; the displayed figure includes only known values.`
                  : 'Known required energy'
              }
            >
              <Zap size={13} aria-hidden className="mr-1.5 inline text-warning" />
              Required {requiredEnergyLabel}
            </span>
            <span
              className="py-1 text-foreground/80 tabular-nums"
              title={reactors ? 'Reactor generation is not present in the current game catalog' : 'No generators placed'}
            >
              Produced {reactors ? '— MJ' : '0 MJ'}
            </span>
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-1">
            <Tooltip content="Undo · Ctrl+Z">
              <Button isIconOnly size="sm" variant="light" aria-label="Undo" isDisabled={!canUndo} onPress={() => changeHistory('undo')}>
                <Undo2 size={16} />
              </Button>
            </Tooltip>
            <Tooltip content="Redo · Ctrl+Y">
              <Button isIconOnly size="sm" variant="light" aria-label="Redo" isDisabled={!canRedo} onPress={() => changeHistory('redo')}>
                <Redo2 size={16} />
              </Button>
            </Tooltip>
            <span className="mx-0.5 h-6 w-px bg-divider" aria-hidden />
            <Tooltip content="Copy · Ctrl+C">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                aria-label="Copy selected element"
                isDisabled={!selectedAreaIds.length && !selectedNote && !selectedPlacement && !activeStation}
                onPress={copySelection}
              >
                <Copy size={16} />
              </Button>
            </Tooltip>
            <Tooltip content="Paste · Ctrl+V">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                aria-label="Paste copied element"
                aria-pressed={pendingPaste !== null}
                isDisabled={!clipboard}
                onPress={pasteSelection}
              >
                <ClipboardPaste size={16} />
              </Button>
            </Tooltip>
            <Tooltip content="Rotate · R">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                aria-label="Rotate selected element"
                isDisabled={!selectedPlacement || Boolean(selectedPlacement.routeId)}
                onPress={rotateSelection}
              >
                <RotateCw size={16} />
              </Button>
            </Tooltip>
            <Tooltip content="Delete · Del">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                color="danger"
                aria-label="Delete selected element"
                isDisabled={!selectedAreaIds.length && !selectedNote && !selectedPlacement && !activeStation}
                onPress={deleteSelection}
              >
                <Trash2 size={16} />
              </Button>
            </Tooltip>
            <span className="mx-0.5 h-6 w-px bg-divider" aria-hidden />
            <Tooltip content="Zoom out">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                aria-label="Zoom out"
                isDisabled={!flow}
                onPress={() => void flow?.zoomOut({ duration: 0 })}
              >
                <ZoomOut size={16} aria-hidden />
              </Button>
            </Tooltip>
            <Tooltip content="Zoom in">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                aria-label="Zoom in"
                isDisabled={!flow}
                onPress={() => void flow?.zoomIn({ duration: 0 })}
              >
                <ZoomIn size={16} aria-hidden />
              </Button>
            </Tooltip>
            <Tooltip content="Fit layout">
              <Button
                isIconOnly
                size="sm"
                variant="light"
                aria-label="Fit layout"
                isDisabled={!flow || (!stations.length && !notes.length)}
                onPress={() => void flow?.fitView({ maxZoom: 1.15, padding: 0.2, duration: 0 })}
              >
                <Scan size={16} aria-hidden />
              </Button>
            </Tooltip>
          </div>
        </div>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <div ref={canvasRef} className="relative min-h-0 min-w-0 flex-1" onPointerCancelCapture={() => selectTool('select')}>
            <ReactFlow<StationFlowNode | NoteFlowNode>
              nodes={nodes}
              edges={[]}
              onInit={setFlow}
              nodeTypes={nodeTypes}
              onNodeDragStart={(_, node) => {
                if (node.type === 'note') useBaseDesignerStore.getState().beginMoveNote()
                else useBaseDesignerStore.getState().beginMoveStation()
              }}
              onNodeDrag={(_, node) => {
                const state = useBaseDesignerStore.getState()
                if (node.type === 'note' && state.dragStartNotes) moveNote(node.id, node.position)
                else if (node.type === 'station' && state.dragStartStations) moveStation(node.id, node.position)
              }}
              onNodeDragStop={(_, node) => {
                if (node.type === 'note') {
                  const state = useBaseDesignerStore.getState()
                  if (state.dragStartNotes) {
                    moveNote(node.id, node.position)
                    state.endMoveNote()
                  }
                } else {
                  const state = useBaseDesignerStore.getState()
                  if (state.dragStartStations) {
                    moveStation(node.id, node.position)
                    state.endMoveStation()
                  }
                }
              }}
              snapToGrid
              snapGrid={stationSnapGrid}
              onNodeClick={(_, node) => {
                if (pendingPaste) return
                if (node.type === 'note') {
                  setSelectedAreaIds([])
                  setSelectedNoteId(node.id)
                  setActiveStationId(null)
                  setSelectedPart(null)
                } else {
                  setActiveStationId(node.id)
                  setSelectedNoteId(null)
                }
              }}
              onPaneClick={() => {
                if (pendingPaste) {
                  setNotice('Place the copy on station floor or an aligned corridor, not in open space.')
                  return
                }
                setActiveStationId(null)
                setSelectedPart(null)
                setSelectedNoteId(null)
                setSelectedAreaIds([])
              }}
              onPaneContextMenu={(event) => {
                event.preventDefault()
                selectTool('select')
              }}
              defaultViewport={{ x: 120, y: 100, zoom: 1 }}
              minZoom={0.2}
              maxZoom={2}
              colorMode="dark"
              deleteKeyCode={null}
              className="bg-background"
            >
              <Background variant={BackgroundVariant.Lines} gap={CELL_SIZE} color="hsl(var(--heroui-default-300) / 0.25)" />
            </ReactFlow>
            {stations.length === 0 ? (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
                <div className="max-w-sm border border-divider bg-content1/95 p-6 text-center shadow-lg shadow-black/20">
                  <Box size={28} aria-hidden className="mx-auto mb-3 text-primary" />
                  <h2 className="text-lg font-semibold">Start with a station</h2>
                  <p className="mt-1 text-sm text-foreground/75">
                    Open Build to add a station, then place machines and draw belts. Reloading clears this session-only layout.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
          {inventoryOpen || inspectorVisible ? (
            <div className="flex max-h-[45%] min-h-0 w-full shrink-0 flex-col overflow-y-auto border-t border-divider bg-content1 md:max-h-none md:w-80 md:border-t-0 md:border-l">
              {inventoryOpen ? (
                <LayoutInventoryPanel
                  ref={inventoryRef}
                  entries={inventoryEntries}
                  stations={stations}
                  selectedKey={selectedInventoryKey}
                  onSelect={selectInventoryEntry}
                  onLocate={locateInventoryEntry}
                  onInspect={openInspector}
                  onCopy={copySelection}
                  onRotate={rotateSelection}
                  onDelete={deleteSelection}
                  onClose={closeInventory}
                />
              ) : selectedPlacement && selectedPart ? (
                <MachineRecipePanel
                  key={selectedPlacement.id}
                  ref={inspectorRef}
                  onClose={closeInspector}
                  placement={selectedPlacement}
                  ports={selectedPorts}
                  onToggleOutput={(port) =>
                    handleToggleMachineOutput(selectedPart.stationId, selectedPart.placementId, port.face, port.offset)
                  }
                  onAssign={(recipeId) => assignRecipe(selectedPart.stationId, selectedPart.placementId, recipeId)}
                  onAssignInputItem={(itemId) => setMachineInputItem(selectedPart.stationId, selectedPart.placementId, itemId)}
                />
              ) : null}
            </div>
          ) : null}
        </div>
        <p
          role="status"
          aria-atomic="true"
          className="max-h-20 min-h-7 shrink-0 overflow-y-auto border-t border-divider bg-content1 px-3 py-1 text-xs text-foreground/80 sm:px-4"
        >
          {statusMessage ?? 'Session only · reloading clears this layout.'}
        </p>
      </div>

      <BuildPaletteModal open={paletteOpen} onOpenChange={setPaletteOpen} tool={tool} onSelect={selectTool} onAddStation={add} />
      <DroneOutputModal
        station={droneModalStation}
        activeSlot={activeDroneSlot}
        onSlotChange={setActiveDroneSlot}
        onOpenChange={(open) => {
          if (!open) setDroneModalStationId(null)
        }}
        onAssign={(stationId, slot, itemId) => setDroneOutput(stationId, slot, itemId)}
      />

      <Modal isOpen={deleteOpen} onOpenChange={setDeleteOpen} placement="center" classNames={{ base: 'rounded-sm bg-content1' }}>
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>Remove station?</ModalHeader>
              <ModalBody>
                <p className="text-sm text-foreground/75">
                  {activeStation?.name} and everything placed inside it will be removed from this session.
                </p>
              </ModalBody>
              <ModalFooter>
                <Button variant="flat" onPress={onClose}>
                  Cancel
                </Button>
                <Button
                  color="danger"
                  onPress={() => {
                    if (activeStation && !removeStation(activeStation.id)) {
                      setNotice('Remove the parts linked across this station doorway before deleting it.')
                      onClose()
                      return
                    }
                    setActiveStationId(null)
                    setSelectedPart(null)
                    onClose()
                  }}
                >
                  Remove station
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  )
}
