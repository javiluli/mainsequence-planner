import { useCallback, useLayoutEffect, useMemo, useRef, useState, type MouseEvent, type PointerEvent } from 'react'
import { selectionAreaIds } from '../../lib/geometry/selection-geometry'
import { type CanTraverseEdge } from '../../lib/connections/connections'
import { indexPlacements } from '../../lib/layout/placement'
import { placementProposal, transformedPlacementOwners, type QuarterTurn } from '../../lib/layout/layout-transform'
import { machinePorts, portOutsideCell } from '../../lib/connections/ports'
import { sameRouteAnchor, type RouteAnchor } from '../../lib/routes/route'
import {
  beltEndAnchor,
  beltJunctionAnchor,
  dronePortAnchor,
  getPortAnchor,
  getBeltEndAnchor,
  gridCell,
} from '../../lib/geometry/station-spatial'
import { CELL_SIZE, PLACEABLES, STATION_TYPES, isPlaceableTool, isRouteTool, isSplitterType } from '../../model/catalog'
import { type StationNodeData } from '../../model/station-node'

interface MachineDrag {
  kind: 'machine'
  id: string
  ownerId: string
  offsetX: number
  offsetY: number
  x: number
  y: number
  moved: boolean
}

interface RouteDrag {
  kind: 'route'
  routeId: string
  startX: number
  startY: number
  dx: number
  dy: number
  moved: boolean
}

interface SelectionDrag {
  kind: 'selection'
  startX: number
  startY: number
  dx: number
  dy: number
  moved: boolean
}

interface AreaDrag {
  startX: number
  startY: number
  endX: number
  endY: number
  startClientX: number
  startClientY: number
  moved: boolean
}

type PlacementDrag = (MachineDrag | RouteDrag | SelectionDrag) & { turns: number }

type InteractionData = Pick<
  StationNodeData,
  | 'station'
  | 'layoutStations'
  | 'worldPieces'
  | 'interactionRevision'
  | 'externalPlacements'
  | 'tool'
  | 'selectedAreaIds'
  | 'selectionPreview'
  | 'pasteActive'
  | 'routeDraft'
  | 'onActivate'
  | 'onSelectStation'
  | 'onCell'
  | 'onPickTool'
  | 'onStartBelt'
  | 'onAreaSelect'
  | 'onSelectionPreview'
  | 'onClearSelectionPreview'
  | 'onRouteHover'
  | 'onTransformPlacements'
  | 'onToggleMachineOutput'
  | 'onOutputCommand'
  | 'onClearMachineItem'
  | 'onReleaseTool'
  | 'onPlacementGesture'
>

/**
 * One grid capture arbitrates area selection, part/route movement and port hit priority.
 * Pointer cells are station-local; geometry receives world cells when a gesture crosses modules.
 * Refs serve event handlers and React state renders the same session; release delegates the commit to the editor.
 */
export function useStationInteractions(data: InteractionData, canTraverse: CanTraverseEdge) {
  const {
    station,
    onSelectStation,
    layoutStations,
    worldPieces,
    interactionRevision,
    externalPlacements,
    tool,
    selectedAreaIds,
    selectionPreview,
    pasteActive,
    routeDraft,
    onActivate,
    onCell,
    onPickTool,
    onStartBelt,
    onAreaSelect,
    onSelectionPreview,
    onClearSelectionPreview,
    onRouteHover,
    onTransformPlacements,
    onToggleMachineOutput,
    onOutputCommand,
    onClearMachineItem,
    onReleaseTool,
    onPlacementGesture,
  } = data
  const size = STATION_TYPES[station.type].footprintCells
  const worldX = station.position.x / CELL_SIZE
  const worldY = station.position.y / CELL_SIZE
  const cellAt = (event: MouseEvent<HTMLDivElement>) => gridCell(event, event.currentTarget.getBoundingClientRect(), size)
  const [cursor, setCursor] = useState({ x: 0, y: 0 })
  const [hovered, setHovered] = useState(false)
  const [hoveredPort, setHoveredPort] = useState<RouteAnchor | null>(null)
  const [dragging, setDragging] = useState<PlacementDrag | null>(null)
  const [areaDrag, setAreaDrag] = useState<AreaDrag | null>(null)
  const areaDragRef = useRef<AreaDrag | null>(null)
  const dragRef = useRef<PlacementDrag | null>(null)
  const hasPlacementGesture = dragging !== null
  const hasAreaGesture = areaDrag !== null
  const dragSource = (current: PlacementDrag) =>
    worldPieces.filter((piece) =>
      current.kind === 'selection'
        ? selectedAreaIds.has(piece.id)
        : current.kind === 'route'
          ? piece.routeId === current.routeId
          : piece.id === current.id,
    )
  const proposalFor = (current: PlacementDrag) => {
    const source = dragSource(current)
    const original = source[0]
    const dx = current.kind === 'machine' ? current.x + worldX - (original?.x ?? worldX) : current.dx
    const dy = current.kind === 'machine' ? current.y + worldY - (original?.y ?? worldY) : current.dy
    return placementProposal(source, dx, dy, current.turns)
  }
  const capturedPointer = useRef<{ id: number; target: HTMLDivElement } | null>(null)
  const cancelGesture = useCallback(() => {
    if (dragRef.current?.kind === 'selection') onClearSelectionPreview()
    dragRef.current = null
    areaDragRef.current = null
    const capture = capturedPointer.current
    capturedPointer.current = null
    if (capture?.target.hasPointerCapture(capture.id)) capture.target.releasePointerCapture(capture.id)
    setDragging(null)
    setAreaDrag(null)
    setHovered(false)
    setHoveredPort(null)
  }, [onClearSelectionPreview])

  useLayoutEffect(() => {
    if ((!hasPlacementGesture && !hasAreaGesture) || !onPlacementGesture) return
    return onPlacementGesture({
      canRotate: hasPlacementGesture,
      rotate: (turn: QuarterTurn) => {
        const current = dragRef.current
        if (!current) return false
        const next = { ...current, moved: true, turns: (current.turns + turn + 4) % 4 }
        dragRef.current = next
        setDragging(next)
        if (next.kind === 'selection') onSelectionPreview(station.id, next.dx, next.dy, next.turns)
        return true
      },
      cancel: cancelGesture,
    })
  }, [hasPlacementGesture, hasAreaGesture, station.id, onSelectionPreview, onPlacementGesture, cancelGesture])

  // Dispose the old gesture before painting a new tool, layout, paste or history state.
  useLayoutEffect(() => cancelGesture, [tool, pasteActive, interactionRevision, cancelGesture])
  // An idle port stays under the pointer when F changes its permission. Actual captures still cancel on layout changes.
  useLayoutEffect(
    () => () => {
      if (dragRef.current || areaDragRef.current || capturedPointer.current) cancelGesture()
    },
    [layoutStations, cancelGesture],
  )

  const capturePointer = (event: PointerEvent<HTMLDivElement>) => {
    capturedPointer.current = { id: event.pointerId, target: event.currentTarget }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const draggedId = dragging?.kind === 'machine' && dragging.moved ? dragging.id : undefined
  const draggedRouteId = dragging?.kind === 'route' && dragging.moved ? dragging.routeId : undefined
  const occupied = useMemo(
    () =>
      indexPlacements([
        ...externalPlacements.filter(
          (piece) => (draggedId === undefined || piece.id !== draggedId) && !(selectionPreview && selectedAreaIds.has(piece.id)),
        ),
        ...station.placements.filter(
          (piece) =>
            (draggedId === undefined || piece.id !== draggedId) &&
            (draggedRouteId === undefined || piece.routeId !== draggedRouteId) &&
            !(selectionPreview && selectedAreaIds.has(piece.id)),
        ),
      ]),
    [station.placements, externalPlacements, draggedId, draggedRouteId, selectionPreview, selectedAreaIds],
  )

  const portPieces = useMemo(
    () =>
      [...station.placements, ...externalPlacements].filter(
        (piece) => PLACEABLES[piece.type].category === 'machine' || isSplitterType(piece.type),
      ),
    [station.placements, externalPlacements],
  )

  // Click and hover use the same priority: drone, machine/splitter, junction, route end.
  const portAt = (event: PointerEvent<HTMLDivElement>, cell: { x: number; y: number }) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return (
      dronePortAnchor(event, bounds, station) ??
      getPortAnchor(event, bounds, portPieces, size, canTraverse) ??
      (isRouteTool(tool) || tool === 'select'
        ? getBeltEndAnchor(event, bounds, occupied, size, tool, routeDraft ? 'input' : 'output', canTraverse)
        : null) ??
      (tool === 'select' ? getBeltEndAnchor(event, bounds, occupied, size, tool, 'input', canTraverse) : null) ??
      (isRouteTool(tool) ? beltJunctionAnchor(occupied, cell.x, cell.y, tool, routeDraft, canTraverse, worldX, worldY) : null) ??
      (isRouteTool(tool) ? beltEndAnchor(occupied, cell.x, cell.y, tool, routeDraft ? 'input' : 'output', canTraverse) : null)
    )
  }

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || capturedPointer.current) return
    if (event.button === 1) {
      event.preventDefault()
      return
    }
    if (event.button !== 0) return
    onActivate(station.id)
    const cell = cellAt(event)
    setCursor(cell)
    if (pasteActive) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    if (tool === 'select' && event.shiftKey) {
      event.preventDefault()
      event.stopPropagation()
      const next = {
        startX: cell.x,
        startY: cell.y,
        endX: cell.x,
        endY: cell.y,
        startClientX: event.clientX,
        startClientY: event.clientY,
        moved: false,
      }
      areaDragRef.current = next
      setAreaDrag(next)
      capturePointer(event)
      return
    }
    if (isRouteTool(tool)) {
      const port = portAt(event, cell)
      if (port?.kind === 'port') {
        setHoveredPort(port)
        onCell(station.id, port.x, port.y, undefined, port.face, port.role, port.routeId, port.mergeTargetId)
        return
      }
      setHoveredPort(null)
    }
    if (tool === 'select') {
      const port = portAt(event, cell)
      if (port?.kind === 'port' && onStartBelt) {
        event.preventDefault()
        event.stopPropagation()
        onStartBelt(station.id, port)
        return
      }
      const placed =
        occupied.get(`${cell.x},${cell.y}`) ??
        [...station.placements, ...externalPlacements].find((piece) => piece.buried && piece.x === cell.x && piece.y === cell.y)
      if (placed && selectedAreaIds.has(placed.id)) {
        event.preventDefault()
        event.stopPropagation()
        const next: PlacementDrag = { kind: 'selection', startX: cell.x, startY: cell.y, dx: 0, dy: 0, moved: false, turns: 0 }
        dragRef.current = next
        setDragging(next)
        capturePointer(event)
        return
      }
      if (placed && !placed.routeId) {
        event.preventDefault()
        event.stopPropagation()
        const next: PlacementDrag = {
          kind: 'machine',
          id: placed.id,
          ownerId: 'stationId' in placed && typeof placed.stationId === 'string' ? placed.stationId : station.id,
          offsetX: cell.x - placed.x,
          offsetY: cell.y - placed.y,
          x: placed.x,
          y: placed.y,
          moved: false,
          turns: 0,
        }
        dragRef.current = next
        setDragging(next)
        capturePointer(event)
      } else if (placed?.routeId) {
        event.preventDefault()
        event.stopPropagation()
        const next: PlacementDrag = {
          kind: 'route',
          routeId: placed.routeId,
          startX: cell.x,
          startY: cell.y,
          dx: 0,
          dy: 0,
          moved: false,
          turns: 0,
        }
        dragRef.current = next
        setDragging(next)
        capturePointer(event)
      }
    }
    const footprint = isPlaceableTool(tool) ? PLACEABLES[tool] : null
    const origin =
      footprint && !isRouteTool(tool)
        ? { x: cell.x - Math.floor((footprint.width - 1) / 2), y: cell.y - Math.floor((footprint.height - 1) / 2) }
        : cell
    onCell(station.id, origin.x, origin.y)
    if (footprint && !isRouteTool(tool)) setHovered(false)
  }

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || (capturedPointer.current && capturedPointer.current.id !== event.pointerId)) return
    const cell = cellAt(event)
    if (pasteActive) {
      setCursor((current) => (current.x === cell.x && current.y === cell.y ? current : cell))
      return
    }
    if (areaDragRef.current) {
      const area = areaDragRef.current
      const next = {
        ...area,
        endX: cell.x,
        endY: cell.y,
        moved: area.moved || Math.hypot(event.clientX - area.startClientX, event.clientY - area.startClientY) > 3,
      }
      areaDragRef.current = next
      setAreaDrag(next)
      return
    }
    setHovered(true)
    setCursor((current) => (current.x === cell.x && current.y === cell.y ? current : cell))
    const port = isRouteTool(tool) || tool === 'select' ? portAt(event, cell) : null
    setHoveredPort((current) => (sameRouteAnchor(current, port) ? current : port))

    if (routeDraft && isRouteTool(tool)) onRouteHover(station.id, port ?? { kind: 'floor', ...cell })
    const currentDrag = dragRef.current
    if (currentDrag && event.buttons & 1) {
      const x = currentDrag.kind === 'machine' ? cell.x - currentDrag.offsetX : cell.x - currentDrag.startX
      const y = currentDrag.kind === 'machine' ? cell.y - currentDrag.offsetY : cell.y - currentDrag.startY
      const changed =
        currentDrag.kind === 'machine' ? x !== currentDrag.x || y !== currentDrag.y : x !== currentDrag.dx || y !== currentDrag.dy
      if (changed) {
        const next: PlacementDrag =
          currentDrag.kind === 'machine' ? { ...currentDrag, x, y, moved: true } : { ...currentDrag, dx: x, dy: y, moved: true }
        dragRef.current = next
        setDragging(next)
        if (next.kind === 'selection') onSelectionPreview(station.id, next.dx, next.dy, next.turns)
      }
    }
  }

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || capturedPointer.current?.id !== event.pointerId) return
    if (areaDragRef.current) {
      const area = areaDragRef.current
      if (!area.moved) {
        onSelectStation(station.id, true)
        cancelGesture()
        return
      }
      // Both local endpoint cells are included; the domain selector receives half-open bounds in world cells.
      const left = worldX + Math.min(area.startX, area.endX)
      const right = worldX + Math.max(area.startX, area.endX) + 1
      const top = worldY + Math.min(area.startY, area.endY)
      const bottom = worldY + Math.max(area.startY, area.endY) + 1
      onAreaSelect(selectionAreaIds(worldPieces, { left, right, top, bottom }))
      cancelGesture()
      return
    }
    const currentDrag = dragRef.current
    if (!currentDrag) return
    if (currentDrag.moved) {
      onTransformPlacements(proposalFor(currentDrag))
      if (currentDrag.kind === 'selection') onClearSelectionPreview()
    }
    cancelGesture()
  }

  // Publish only the hovered output command. F is dispatched by the editor, independently of grid focus.
  useLayoutEffect(() => {
    if (tool !== 'select' || pasteActive || hoveredPort?.kind !== 'port' || !onOutputCommand) return
    const machine = portPieces
      .filter((piece) => PLACEABLES[piece.type].category === 'machine')
      .flatMap((piece) => machinePorts(piece).map((port) => ({ piece, port, outside: portOutsideCell(piece, port) })))
      .find(({ port, outside }) => port.face === hoveredPort.face && outside.x === hoveredPort.x && outside.y === hoveredPort.y)
    if (!machine) return
    const ownerId = 'stationId' in machine.piece && typeof machine.piece.stationId === 'string' ? machine.piece.stationId : station.id
    return onOutputCommand(() => onToggleMachineOutput(ownerId, machine.piece.id, machine.port.face, machine.port.offset))
  }, [tool, pasteActive, hoveredPort, portPieces, station.id, onOutputCommand, onToggleMachineOutput])

  const handleAuxClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 1) return
    event.preventDefault()
    event.stopPropagation()
    const { x, y } = cellAt(event)
    const placed = occupied.get(`${x},${y}`)
    if (placed) onPickTool(placed.type)
  }

  const handlePointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    if (capturedPointer.current?.id === event.pointerId) cancelGesture()
  }

  const handleLostPointerCapture = handlePointerCancel

  const handlePointerEnter = (event: PointerEvent<HTMLDivElement>) => {
    setHovered(true)
    const cell = cellAt(event)
    setCursor(cell)
  }

  const handlePointerLeave = () => {
    setHovered(false)
    setHoveredPort(null)
  }

  const handleContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    if (tool === 'select' && !pasteActive && !dragRef.current && !areaDragRef.current) {
      const cell = cellAt(event)
      const piece = occupied.get(`${cell.x},${cell.y}`)
      if (piece?.recipeId && PLACEABLES[piece.type].category === 'machine') {
        const ownerId = 'stationId' in piece && typeof piece.stationId === 'string' ? piece.stationId : station.id
        onClearMachineItem(ownerId, piece.id)
        return
      }
    }
    cancelGesture()
    onReleaseTool()
  }

  const movingPieces = dragging?.moved ? proposalFor(dragging) : []
  return {
    cursor,
    hovered,
    hoveredPort,
    dragging,
    movingPieces,
    movingValid: movingPieces.length > 0 && Boolean(transformedPlacementOwners(layoutStations, movingPieces)),
    areaDrag,
    draggedId,
    draggedRouteId,
    occupied,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleLostPointerCapture,
    handlePointerEnter,
    handlePointerLeave,
    handleContextMenu,
    handleAuxClick,
  }
}
