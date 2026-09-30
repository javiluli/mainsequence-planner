import { useCallback, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { type CanTraverseEdge } from '../lib/connections'
import { indexPlacements } from '../lib/placement'
import { machinePorts, portOutsideCell } from '../lib/ports'
import { sameRouteAnchor, type RouteAnchor } from '../lib/route'
import { beltEndAnchor, beltJunctionAnchor, cellInStation, dronePortAnchor, getPortAnchor, gridCell } from '../lib/station-spatial'
import { canMoveInLayout, canMoveRouteInLayout } from '../lib/world-layout'
import { CELL_SIZE, PLACEABLES, STATION_TYPES, isPlaceableTool, isRouteTool } from '../model/catalog'
import { type StationNodeData } from '../model/station-node'

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
}

type PlacementDrag = MachineDrag | RouteDrag | SelectionDrag

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
  | 'onPasteHover'
  | 'onPasteLeave'
  | 'onPasteCell'
  | 'onActivate'
  | 'onCell'
  | 'onPickTool'
  | 'onAreaSelect'
  | 'onMoveArea'
  | 'onSelectionPreview'
  | 'onClearSelectionPreview'
  | 'onRouteHover'
  | 'onMovePlacement'
  | 'onMoveRoute'
  | 'onToggleMachineOutput'
  | 'onReleaseTool'
>

/** Transient gestures stay outside the persisted layout and the station artwork. */
export function useStationInteractions(data: InteractionData, canTraverse: CanTraverseEdge) {
  const {
    station,
    layoutStations,
    worldPieces,
    interactionRevision,
    externalPlacements,
    tool,
    selectedAreaIds,
    selectionPreview,
    pasteActive,
    routeDraft,
    onPasteHover,
    onPasteLeave,
    onPasteCell,
    onActivate,
    onCell,
    onPickTool,
    onAreaSelect,
    onMoveArea,
    onSelectionPreview,
    onClearSelectionPreview,
    onRouteHover,
    onMovePlacement,
    onMoveRoute,
    onToggleMachineOutput,
    onReleaseTool,
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

  // Dispose the old gesture before painting a new tool, layout, paste or history state.
  useLayoutEffect(() => cancelGesture, [tool, pasteActive, layoutStations, interactionRevision, cancelGesture])

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

  // Click and hover use the same priority: drone, machine/splitter, junction, route end.
  const portAt = (event: PointerEvent<HTMLDivElement>, cell: { x: number; y: number }) => {
    const bounds = event.currentTarget.getBoundingClientRect()
    return (
      dronePortAnchor(event, bounds, station) ??
      getPortAnchor(event, bounds, [...station.placements, ...externalPlacements], size, canTraverse) ??
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
    if (tool === 'select') event.currentTarget.focus()
    const cell = cellAt(event)
    setCursor(cell)
    onPasteHover(station.id, cell.x, cell.y)
    if (pasteActive) {
      event.preventDefault()
      event.stopPropagation()
      onPasteCell(station.id, cell.x, cell.y)
      return
    }
    if (tool === 'select' && event.shiftKey) {
      event.preventDefault()
      event.stopPropagation()
      const next = { startX: cell.x, startY: cell.y, endX: cell.x, endY: cell.y }
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
      const placed = occupied.get(`${cell.x},${cell.y}`)
      if (placed && selectedAreaIds.has(placed.id)) {
        event.preventDefault()
        event.stopPropagation()
        const next: SelectionDrag = { kind: 'selection', startX: cell.x, startY: cell.y, dx: 0, dy: 0, moved: false }
        dragRef.current = next
        setDragging(next)
        capturePointer(event)
        return
      }
      if (placed && !placed.routeId) {
        event.stopPropagation()
        const next: MachineDrag = {
          kind: 'machine',
          id: placed.id,
          ownerId: 'stationId' in placed && typeof placed.stationId === 'string' ? placed.stationId : station.id,
          offsetX: cell.x - placed.x,
          offsetY: cell.y - placed.y,
          x: placed.x,
          y: placed.y,
          moved: false,
        }
        dragRef.current = next
        setDragging(next)
        capturePointer(event)
      } else if (placed?.routeId) {
        event.stopPropagation()
        const next: RouteDrag = { kind: 'route', routeId: placed.routeId, startX: cell.x, startY: cell.y, dx: 0, dy: 0, moved: false }
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
    onPasteHover(station.id, cell.x, cell.y)
    if (pasteActive) {
      setCursor((current) => (current.x === cell.x && current.y === cell.y ? current : cell))
      return
    }
    if (areaDragRef.current) {
      const next = { ...areaDragRef.current, endX: cell.x, endY: cell.y }
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
        if (next.kind === 'selection') onSelectionPreview(station.id, next.dx, next.dy)
      }
    }
  }

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || capturedPointer.current?.id !== event.pointerId) return
    if (areaDragRef.current) {
      const area = areaDragRef.current
      const left = worldX + Math.min(area.startX, area.endX)
      const right = worldX + Math.max(area.startX, area.endX) + 1
      const top = worldY + Math.min(area.startY, area.endY)
      const bottom = worldY + Math.max(area.startY, area.endY) + 1
      const pieces = worldPieces
      const touched = pieces.filter((piece) => {
        const footprint = PLACEABLES[piece.type]
        return piece.x < right && piece.x + footprint.width > left && piece.y < bottom && piece.y + footprint.height > top
      })
      const routes = new Set(touched.flatMap((piece) => (piece.routeId ? [piece.routeId] : [])))
      onAreaSelect(
        pieces.filter((piece) => touched.includes(piece) || (piece.routeId && routes.has(piece.routeId))).map((piece) => piece.id),
      )
      cancelGesture()
      return
    }
    const currentDrag = dragRef.current
    if (!currentDrag) return
    if (currentDrag.moved) {
      if (currentDrag.kind === 'selection') {
        if (currentDrag.dx !== 0 || currentDrag.dy !== 0) onMoveArea([...selectedAreaIds], currentDrag.dx, currentDrag.dy)
        onClearSelectionPreview()
      } else if (currentDrag.kind === 'machine') {
        const owner = layoutStations.find((candidate) => candidate.id === currentDrag.ownerId)
        if (owner) {
          const { x, y } = cellInStation(currentDrag, station, owner)
          if (canMoveInLayout(layoutStations, owner.id, currentDrag.id, x, y)) onMovePlacement(owner.id, currentDrag.id, x, y)
        }
      } else if (
        currentDrag.kind === 'route' &&
        canMoveRouteInLayout(layoutStations, station.id, currentDrag.routeId, currentDrag.dx, currentDrag.dy)
      ) {
        onMoveRoute(station.id, currentDrag.routeId, currentDrag.dx, currentDrag.dy)
      }
    }
    cancelGesture()
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.metaKey) return
    if (event.repeat && !event.key.startsWith('Arrow')) return
    const movement: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    }
    if (pasteActive && event.key in movement) {
      event.preventDefault()
      event.stopPropagation()
      const [dx, dy] = movement[event.key]
      const next = { x: cursor.x + dx, y: cursor.y + dy }
      setCursor(next)
      onPasteHover(station.id, next.x, next.y)
    } else if (pasteActive && (event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault()
      event.stopPropagation()
      onPasteCell(station.id, cursor.x, cursor.y)
    } else if (event.key.toLowerCase() === 'f' && tool === 'select' && !pasteActive && hoveredPort?.kind === 'port') {
      const machine = [...station.placements, ...externalPlacements]
        .filter((piece) => PLACEABLES[piece.type].category === 'machine')
        .flatMap((piece) =>
          machinePorts(piece).map((port) => ({
            piece,
            port,
            outside: portOutsideCell(piece, port),
          })),
        )
        .find(({ port, outside }) => port.face === hoveredPort.face && outside.x === hoveredPort.x && outside.y === hoveredPort.y)
      if (machine) {
        event.preventDefault()
        event.stopPropagation()
        const ownerId = 'stationId' in machine.piece && typeof machine.piece.stationId === 'string' ? machine.piece.stationId : station.id
        onToggleMachineOutput(ownerId, machine.piece.id, machine.port.face, machine.port.offset)
      }
    } else if (event.shiftKey && event.key in movement && selectedAreaIds.size > 0) {
      event.preventDefault()
      event.stopPropagation()
      const [dx, dy] = movement[event.key]
      onMoveArea([...selectedAreaIds], dx, dy)
    } else if (event.key in movement) {
      event.preventDefault()
      event.stopPropagation()
      setHoveredPort(null)
      const [dx, dy] = movement[event.key]
      if (canTraverse(cursor.x, cursor.y, dx > 0 ? 'east' : dx < 0 ? 'west' : dy > 0 ? 'south' : 'north')) {
        const next = { x: cursor.x + dx, y: cursor.y + dy }
        setCursor(next)
        onPasteHover(station.id, next.x, next.y)
      }
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      event.stopPropagation()
      setHoveredPort(null)
      onActivate(station.id)
      const footprint = isPlaceableTool(tool) ? PLACEABLES[tool] : null
      onCell(
        station.id,
        cursor.x - (footprint && !isRouteTool(tool) ? Math.floor((footprint.width - 1) / 2) : 0),
        cursor.y - (footprint && !isRouteTool(tool) ? Math.floor((footprint.height - 1) / 2) : 0),
      )
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      cancelGesture()
      onReleaseTool()
    }
  }

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
    onPasteHover(station.id, cell.x, cell.y)
  }

  const handlePointerLeave = () => {
    setHovered(false)
    setHoveredPort(null)
    onPasteLeave(station.id)
  }

  const handleContextMenu = (event: MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    cancelGesture()
    onReleaseTool()
  }

  const handleFocus = () => onPasteHover(station.id, cursor.x, cursor.y)

  return {
    cursor,
    hovered,
    hoveredPort,
    dragging,
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
    handleKeyDown,
    handleAuxClick,
    handleFocus,
  }
}
