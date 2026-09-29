import { cn } from '@heroui/react'
import { type Node, type NodeProps } from '@xyflow/react'
import { ArrowRight, LockKeyhole, LockKeyholeOpen } from 'lucide-react'
import { useMemo, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent, type PointerEvent } from 'react'
import { beltConnection, beltIncoming, beltOutputs, machinePortFlow, type CanTraverseEdge, type OccupiedCells } from '../lib/connections'
import { indexPlacements, type BasePlacement, type BaseStation } from '../lib/placement'
import { machinePorts, oppositeDirection, portOutsideCell, type MachinePort } from '../lib/ports'
import { routeCells, type RouteAnchor, type RouteDraft } from '../lib/route'
import { canCrossStationBoundary, connectedCorridors } from '../lib/stations'
import {
  canMoveInLayout,
  canMoveRouteInLayout,
  canPlaceInLayout,
  canPlaceRouteInLayout,
  routeCellOwner,
  worldPlacements,
  type WorldPlacement,
} from '../lib/world-layout'
import {
  CELL_SIZE,
  PLACEABLES,
  STATION_GATE_CELLS,
  STATION_TYPES,
  isPlaceableTool,
  isRouteTool,
  isSplitterType,
  type Direction,
  type EditorTool,
  type PlaceableType,
} from '../model/catalog'

export interface StationNodeData extends Record<string, unknown> {
  station: BaseStation
  layoutStations: BaseStation[]
  externalPlacements: WorldPlacement[]
  animatedBelts: ReadonlyMap<string, number>
  tool: EditorTool
  active: boolean
  selectedPlacementId: string | null
  selectedRouteId: string | null
  routeDraft: RouteDraft | null
  onActivate: (stationId: string) => void
  onCell: (
    stationId: string,
    x: number,
    y: number,
    direction?: Direction,
    portFace?: Direction,
    portRole?: 'input' | 'output',
    portRouteId?: string,
  ) => void
  onPickTool: (type: PlaceableType) => void
  onRouteHover: (stationId: string, anchor: RouteAnchor) => void
  onMovePlacement: (stationId: string, placementId: string, x: number, y: number) => boolean
  onMoveRoute: (stationId: string, routeId: string, dx: number, dy: number) => boolean
  onToggleStationLock: (firstId: string, secondId: string) => void
  onReleaseTool: () => void
}

export type StationFlowNode = Node<StationNodeData, 'station'>

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

type PlacementDrag = MachineDrag | RouteDrag

const arrowAngles: Record<Direction, number> = { north: -90, east: 0, south: 90, west: 180 }

const machineMarkings: Partial<Record<PlaceableType, string>> = {
  reactor: 'REACTOR',
  refinery: 'REFINERY',
  assembler: 'ASSEMBLER',
  material_lab: 'MATERIAL LAB',
  container: 'BOX',
  enrichment: 'ENRICHMENT',
  computation_lab: 'COMPUTATION LAB',
}

/** These optical insets do not change the snapped, buildable cell footprints. */
const STATION_FRAME_CLEARANCE = 4
const MACHINE_BODY_INSET = 3

function stationFramePath(footprintCells: number, gateStarts: readonly number[]): string {
  const outer = footprintCells * CELL_SIZE
  const frameSize = outer + STATION_FRAME_CLEARANCE * 2
  const rails: [number, number][] = []
  let start = 0
  for (const gate of gateStarts) {
    rails.push([start, gate])
    start = gate + STATION_GATE_CELLS
  }
  rails.push([start, footprintCells])
  return rails
    .flatMap(([from, to]) => {
      const a = from === 0 ? 1.5 : STATION_FRAME_CLEARANCE + from * CELL_SIZE
      const b = to === footprintCells ? frameSize - 1.5 : STATION_FRAME_CLEARANCE + to * CELL_SIZE
      return [`M${a} 1.5 H${b}`, `M${a} ${frameSize - 1.5} H${b}`, `M1.5 ${a} V${b}`, `M${frameSize - 1.5} ${a} V${b}`]
    })
    .join(' ')
}

function getCell(event: PointerEvent<HTMLDivElement>, size: number) {
  const bounds = event.currentTarget.getBoundingClientRect()
  const x = Math.floor(((event.clientX - bounds.left) / bounds.width) * size)
  const y = Math.floor(((event.clientY - bounds.top) / bounds.height) * size)
  return { x, y }
}

function portPosition(machine: BasePlacement, port: MachinePort) {
  const footprint = PLACEABLES[machine.type]
  switch (port.face) {
    case 'north':
      return { left: (port.offset + 0.5) * CELL_SIZE, top: MACHINE_BODY_INSET }
    case 'east':
      return { left: footprint.width * CELL_SIZE - MACHINE_BODY_INSET, top: (port.offset + 0.5) * CELL_SIZE }
    case 'south':
      return { left: (port.offset + 0.5) * CELL_SIZE, top: footprint.height * CELL_SIZE - MACHINE_BODY_INSET }
    case 'west':
      return { left: MACHINE_BODY_INSET, top: (port.offset + 0.5) * CELL_SIZE }
  }
}

/** A port is easier to select than its visible 7px mark; routing still begins on the adjacent free cell. */
function getPortAnchor(
  event: PointerEvent<HTMLDivElement>,
  placements: readonly BasePlacement[],
  size: number,
  canTraverse: CanTraverseEdge,
): RouteAnchor | null {
  const bounds = event.currentTarget.getBoundingClientRect()
  const scaleX = bounds.width / (size * CELL_SIZE)
  const scaleY = bounds.height / (size * CELL_SIZE)
  let nearest: { anchor: RouteAnchor; distance: number } | null = null
  for (const machine of placements) {
    if (isSplitterType(machine.type)) {
      for (const face of ['north', 'east', 'south', 'west'] as const) {
        const [edgeX, edgeY] = edgePoints[face]
        const dx = event.clientX - (bounds.left + (machine.x * CELL_SIZE + edgeX) * scaleX)
        const dy = event.clientY - (bounds.top + (machine.y * CELL_SIZE + edgeY) * scaleY)
        const distance = dx * dx + dy * dy
        if (distance > 14 * 14 || (nearest && distance >= nearest.distance)) continue
        if (!canTraverse(machine.x, machine.y, face)) continue
        const [stepX, stepY] = faceSteps[face]
        nearest = {
          anchor: {
            kind: 'port',
            x: machine.x + stepX,
            y: machine.y + stepY,
            face,
            role: face === beltIncoming(machine) ? 'input' : 'output',
          },
          distance,
        }
      }
      continue
    }
    if (PLACEABLES[machine.type].category !== 'machine') continue
    for (const port of machinePorts(machine)) {
      const position = portPosition(machine, port)
      const dx = event.clientX - (bounds.left + (machine.x * CELL_SIZE + position.left) * scaleX)
      const dy = event.clientY - (bounds.top + (machine.y * CELL_SIZE + position.top) * scaleY)
      const distance = dx * dx + dy * dy
      if (distance > 14 * 14 || (nearest && distance >= nearest.distance)) continue
      if (!canAccessMachinePort(machine, port, canTraverse)) continue
      const cell = portOutsideCell(machine, port)
      nearest = { anchor: { kind: 'port', ...cell, face: port.face }, distance }
    }
  }
  return nearest?.anchor ?? null
}

const edgePoints: Record<Direction, readonly [number, number]> = {
  west: [0, 10],
  east: [20, 10],
  north: [10, 0],
  south: [10, 20],
}
const faceSteps: Record<Direction, readonly [number, number]> = {
  west: [-1, 0],
  east: [1, 0],
  north: [0, -1],
  south: [0, 1],
}

/** A visible I/O must have a reachable floor cell beyond the machine, including across a doorway. */
function canAccessMachinePort(machine: BasePlacement, port: MachinePort, canTraverse: CanTraverseEdge): boolean {
  const outside = portOutsideCell(machine, port)
  const [dx, dy] = faceSteps[port.face]
  return canTraverse(outside.x - dx, outside.y - dy, port.face)
}

/** An unfinished route can be extended from its output or joined at its input. */
function beltEndAnchor(
  occupied: OccupiedCells,
  x: number,
  y: number,
  type: EditorTool,
  role: 'input' | 'output',
  canTraverse: CanTraverseEdge,
): RouteAnchor | null {
  const belt = occupied.get(`${x},${y}`)
  if (!belt || belt.type !== type || !belt.routeId) return null
  const face = role === 'output' ? belt.direction : beltIncoming(belt)
  if (beltConnection(occupied, belt, face, canTraverse) || !canTraverse(belt.x, belt.y, face)) return null
  const [dx, dy] = faceSteps[face]
  return { kind: 'port', x: belt.x + dx, y: belt.y + dy, face, role, routeId: belt.routeId }
}

function beltPath(placement: BasePlacement, connectedInput: boolean, connectedOutput: boolean) {
  const entering = beltIncoming(placement)
  if (isSplitterType(placement.type)) {
    const [inputX, inputY] = edgePoints[entering]
    return `M${inputX} ${inputY} L10 10 ${beltOutputs(placement)
      .map((face) => {
        const [x, y] = edgePoints[face]
        return `M10 10 L${x} ${y}`
      })
      .join(' ')}`
  }
  const [startX, startY] = connectedInput || !connectedOutput ? edgePoints[entering] : [10, 10]
  const [endX, endY] = connectedOutput || !connectedInput ? edgePoints[placement.direction] : [10, 10]
  const bend = entering !== oppositeDirection(placement.direction)
  return bend && connectedInput === connectedOutput
    ? `M${startX} ${startY} Q10 10 ${endX} ${endY}`
    : `M${startX} ${startY} L${endX} ${endY}`
}

export function BeltTile({
  occupied,
  placement,
  canTraverse,
  preview,
  valid = true,
  phase,
  selected = false,
  moving = false,
  interactive = false,
}: {
  occupied: OccupiedCells
  placement: BasePlacement
  canTraverse?: CanTraverseEdge
  preview?: boolean
  valid?: boolean
  phase?: number
  selected?: boolean
  moving?: boolean
  interactive?: boolean
}) {
  const connectedInput = Boolean(beltConnection(occupied, placement, beltIncoming(placement), canTraverse))
  const connectedOutput = beltOutputs(placement).some((face) => Boolean(beltConnection(occupied, placement, face, canTraverse)))
  const path = beltPath(placement, connectedInput, connectedOutput)
  const splitter = isSplitterType(placement.type)
  return (
    <div
      title={preview ? undefined : `${PLACEABLES[placement.type].label} · ${placement.x + 1}, ${placement.y + 1} · ${placement.direction}`}
      className={cn(
        'base-placement base-placement--logistics absolute',
        interactive ? 'nodrag pointer-events-auto cursor-move' : 'pointer-events-none',
        placement.type.startsWith('underground') && 'base-placement--underground',
        splitter && 'base-placement--splitter',
        preview && 'base-placement--preview',
        preview && !valid && 'base-placement--invalid',
        phase !== undefined && 'base-placement--flowing',
        selected && 'base-placement--selected-route',
        moving && 'base-placement--moving',
      )}
      style={{ left: placement.x * CELL_SIZE, top: placement.y * CELL_SIZE, width: CELL_SIZE, height: CELL_SIZE }}
    >
      <svg viewBox="0 0 20 20" className="absolute inset-0 h-full w-full" aria-hidden>
        <path d={path} className="base-belt-shell" />
        <path d={path} className="base-belt-core" />
        {phase === undefined ? null : (
          <path d={path} className="base-belt-slats" style={{ animationDelay: `${-((15 - (phase % 15)) % 15) / 15}s` }} />
        )}
      </svg>
      {splitter ? (
        <>
          <span className="base-splitter-center absolute" aria-hidden>
            S
          </span>
          {(['north', 'east', 'south', 'west'] as const).map((face) => (
            <span
              key={face}
              className="base-splitter-port absolute"
              data-face={face}
              data-role={face === beltIncoming(placement) ? 'input' : 'output'}
              aria-hidden
            >
              <ArrowRight
                size={8}
                style={{ transform: `rotate(${arrowAngles[face === beltIncoming(placement) ? oppositeDirection(face) : face]}deg)` }}
              />
            </span>
          ))}
        </>
      ) : null}
    </div>
  )
}

export function MachineTile({
  occupied,
  placement,
  canTraverse,
  preview,
  valid = true,
  moving = false,
  routeable = false,
  hoveredPort,
  selected = false,
  interactive = false,
}: {
  occupied: OccupiedCells
  placement: BasePlacement
  canTraverse?: CanTraverseEdge
  preview?: boolean
  valid?: boolean
  moving?: boolean
  routeable?: boolean
  hoveredPort?: RouteAnchor | null
  selected?: boolean
  interactive?: boolean
}) {
  const info = PLACEABLES[placement.type]
  const compact = info.width <= 3
  const machineStyle: CSSProperties & Record<'--base-machine-inset', string> = {
    left: placement.x * CELL_SIZE,
    top: placement.y * CELL_SIZE,
    width: info.width * CELL_SIZE,
    height: info.height * CELL_SIZE,
    '--base-machine-inset': `${MACHINE_BODY_INSET}px`,
  }
  return (
    <div
      title={preview ? undefined : `${info.label} · ${placement.x + 1}, ${placement.y + 1} · ${info.width}×${info.height}`}
      className={cn(
        'base-placement base-placement--machine absolute',
        interactive ? 'nodrag pointer-events-auto cursor-move' : 'pointer-events-none',
        compact && 'base-placement--compact',
        preview && 'base-placement--preview',
        preview && !valid && 'base-placement--invalid',
        moving && 'base-placement--moving',
        selected && 'base-placement--selected-machine',
      )}
      style={machineStyle}
    >
      <span className="base-machine-shell absolute" aria-hidden>
        <span className="base-machine-panel absolute inset-[4px]" />
        <span className="base-machine-vent absolute top-[14%] right-[13%]" />
        <span className="base-machine-band absolute right-[4px] left-[4px]">{machineMarkings[placement.type] ?? info.label}</span>
        <span className="base-machine-fastener base-machine-fastener--tl" />
        <span className="base-machine-fastener base-machine-fastener--tr" />
        <span className="base-machine-fastener base-machine-fastener--bl" />
        <span className="base-machine-fastener base-machine-fastener--br" />
      </span>
      {machinePorts(placement)
        .filter((port) => !canTraverse || canAccessMachinePort(placement, port, canTraverse))
        .map((port) => {
          const flow = preview ? null : machinePortFlow(occupied, placement, port, canTraverse)
          const outside = portOutsideCell(placement, port)
          const portHovered =
            hoveredPort?.kind === 'port' && hoveredPort.x === outside.x && hoveredPort.y === outside.y && hoveredPort.face === port.face
          const position = portPosition(placement, port)
          return (
            <span key={`${port.face}-${port.offset}`} aria-hidden>
              {flow ? <span className="base-machine-port-bridge absolute" data-face={port.face} style={position} /> : null}
              <span
                className={cn(
                  'base-machine-port absolute',
                  routeable && 'base-machine-port--routeable',
                  portHovered && 'base-machine-port--hovered',
                )}
                data-face={port.face}
                data-flow={flow ?? undefined}
                style={position}
              >
                {flow ? (
                  <ArrowRight
                    size={8}
                    style={{ transform: `rotate(${arrowAngles[flow === 'output' ? port.face : oppositeDirection(port.face)]}deg)` }}
                  />
                ) : null}
              </span>
            </span>
          )
        })}
    </div>
  )
}

export function StationNode({ data }: NodeProps<StationFlowNode>) {
  const {
    station,
    layoutStations,
    externalPlacements,
    animatedBelts,
    tool,
    active,
    selectedPlacementId,
    selectedRouteId,
    routeDraft,
    onActivate,
    onCell,
    onPickTool,
    onRouteHover,
    onMovePlacement,
    onMoveRoute,
    onToggleStationLock,
    onReleaseTool,
  } = data
  const { footprintCells, gateStarts } = STATION_TYPES[station.type]
  const size = footprintCells
  const outerSize = footprintCells * CELL_SIZE
  const frameSize = outerSize + STATION_FRAME_CLEARANCE * 2
  const worldX = station.position.x / CELL_SIZE
  const worldY = station.position.y / CELL_SIZE
  const layoutCorridors = useMemo(() => connectedCorridors(layoutStations), [layoutStations])
  const canTraverse: CanTraverseEdge = (x, y, face) => {
    const [dx, dy] = faceSteps[face]
    return canCrossStationBoundary(
      layoutStations,
      { x: worldX + x, y: worldY + y },
      { x: worldX + x + dx, y: worldY + y + dy },
      layoutCorridors,
    )
  }
  const ownedCorridors = layoutCorridors.filter((corridor) => corridor.ownerId === station.id)
  const framePath = stationFramePath(footprintCells, gateStarts)
  const [cursor, setCursor] = useState({ x: 0, y: 0 })
  const [hovered, setHovered] = useState(false)
  const [hoveredPort, setHoveredPort] = useState<RouteAnchor | null>(null)
  const [dragging, setDragging] = useState<PlacementDrag | null>(null)
  const dragRef = useRef<PlacementDrag | null>(null)
  const draggedId = dragging?.kind === 'machine' && dragging.moved ? dragging.id : undefined
  const draggedRouteId = dragging?.kind === 'route' && dragging.moved ? dragging.routeId : undefined
  const occupied = useMemo(
    () =>
      indexPlacements([
        ...externalPlacements.filter((piece) => draggedId === undefined || piece.id !== draggedId),
        ...station.placements.filter(
          (piece) =>
            (draggedId === undefined || piece.id !== draggedId) && (draggedRouteId === undefined || piece.routeId !== draggedRouteId),
        ),
      ]),
    [station.placements, externalPlacements, draggedId, draggedRouteId],
  )
  const routeActive = Boolean(routeDraft && isRouteTool(tool))
  const worldPreviewRoute = useMemo(() => {
    if (!routeDraft || !routeActive) return []
    const last = routeDraft.anchors[routeDraft.anchors.length - 1]
    const hover = routeDraft.hover
    return routeCells(hover && (last.x !== hover.x || last.y !== hover.y) ? [...routeDraft.anchors, hover] : routeDraft.anchors)
  }, [routeActive, routeDraft])
  const previewRoute = useMemo(
    () =>
      worldPreviewRoute
        .filter((cell) => routeCellOwner(layoutStations, station.id, cell.x, cell.y)?.id === station.id)
        .map((cell) => ({ ...cell, x: cell.x - worldX, y: cell.y - worldY })),
    [worldPreviewRoute, worldX, worldY, layoutStations, station.id],
  )
  const previewOccupied = useMemo(() => {
    if (!routeDraft || !routeActive) return occupied
    const cells = new Map(occupied)
    worldPreviewRoute.forEach((worldCell, index) => {
      const cell = { ...worldCell, x: worldCell.x - worldX, y: worldCell.y - worldY }
      cells.set(`${cell.x},${cell.y}`, { id: `draft-${index}`, type: routeDraft.type, ...cell })
    })
    return cells
  }, [occupied, worldPreviewRoute, worldX, worldY, routeActive, routeDraft])
  const previewValid = routeDraft && routeActive ? canPlaceRouteInLayout(layoutStations, routeDraft.stationId, worldPreviewRoute) : false

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button === 1) {
      event.preventDefault()
      return
    }
    if (event.button !== 0) return
    onActivate(station.id)
    const cell = getCell(event, size)
    setCursor(cell)
    if (isRouteTool(tool)) {
      const port =
        getPortAnchor(event, [...station.placements, ...externalPlacements], size, canTraverse) ??
        beltEndAnchor(occupied, cell.x, cell.y, tool, routeDraft ? 'input' : 'output', canTraverse)
      if (port?.kind === 'port') {
        setHoveredPort(port)
        onCell(station.id, port.x, port.y, undefined, port.face, port.role, port.routeId)
        return
      }
      setHoveredPort(null)
    }
    if (tool === 'select') {
      const placed = occupied.get(`${cell.x},${cell.y}`)
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
        event.currentTarget.setPointerCapture(event.pointerId)
      } else if (placed?.routeId) {
        event.stopPropagation()
        const next: RouteDrag = { kind: 'route', routeId: placed.routeId, startX: cell.x, startY: cell.y, dx: 0, dy: 0, moved: false }
        dragRef.current = next
        setDragging(next)
        event.currentTarget.setPointerCapture(event.pointerId)
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
    const cell = getCell(event, size)
    setHovered(true)
    setCursor((current) => (current.x === cell.x && current.y === cell.y ? current : cell))
    const port = isRouteTool(tool)
      ? (getPortAnchor(event, [...station.placements, ...externalPlacements], size, canTraverse) ??
        beltEndAnchor(occupied, cell.x, cell.y, tool, routeDraft ? 'input' : 'output', canTraverse))
      : null
    setHoveredPort((current) =>
      current?.kind === 'port' && port?.kind === 'port' && current.x === port.x && current.y === port.y && current.face === port.face
        ? current
        : port,
    )
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
      }
    }
  }

  const handlePointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const currentDrag = dragRef.current
    if (!currentDrag) return
    if (currentDrag.moved) {
      if (currentDrag.kind === 'machine') {
        const owner = layoutStations.find((candidate) => candidate.id === currentDrag.ownerId)
        if (owner) {
          const x = currentDrag.x + (station.position.x - owner.position.x) / CELL_SIZE
          const y = currentDrag.y + (station.position.y - owner.position.y) / CELL_SIZE
          if (canMoveInLayout(layoutStations, owner.id, currentDrag.id, x, y)) onMovePlacement(owner.id, currentDrag.id, x, y)
        }
      } else if (
        currentDrag.kind === 'route' &&
        canMoveRouteInLayout(layoutStations, station.id, currentDrag.routeId, currentDrag.dx, currentDrag.dy)
      ) {
        onMoveRoute(station.id, currentDrag.routeId, currentDrag.dx, currentDrag.dy)
      }
    }
    dragRef.current = null
    setDragging(null)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const movement: Record<string, [number, number]> = {
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
    }
    if (event.key in movement) {
      event.preventDefault()
      event.stopPropagation()
      setHoveredPort(null)
      const [dx, dy] = movement[event.key]
      setCursor((current) => {
        const next = { x: current.x + dx, y: current.y + dy }
        return canTraverse(current.x, current.y, dx > 0 ? 'east' : dx < 0 ? 'west' : dy > 0 ? 'south' : 'north') ? next : current
      })
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
      if (dragRef.current) {
        dragRef.current = null
        setDragging(null)
      } else {
        onReleaseTool()
      }
    }
  }

  const handleAuxClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.button !== 1) return
    event.preventDefault()
    event.stopPropagation()
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = Math.floor(((event.clientX - bounds.left) / bounds.width) * size)
    const y = Math.floor(((event.clientY - bounds.top) / bounds.height) * size)
    const placed = occupied.get(`${x},${y}`)
    if (placed) onPickTool(placed.type)
  }

  const ghostType = tool !== 'select' && tool !== 'erase' && !isRouteTool(tool) ? tool : null
  const ghost: BasePlacement | null = ghostType
    ? {
        id: 'preview',
        type: ghostType,
        x: cursor.x - Math.floor((PLACEABLES[ghostType].width - 1) / 2),
        y: cursor.y - Math.floor((PLACEABLES[ghostType].height - 1) / 2),
        direction: ghostType === 'material_lab' || ghostType === 'computation_lab' ? 'south' : 'east',
      }
    : null
  const movedPiece =
    dragging?.kind === 'machine' &&
    dragging.moved &&
    [...station.placements, ...externalPlacements].find((piece) => piece.id === dragging.id)
  const movedGhost = movedPiece && dragging?.kind === 'machine' ? { ...movedPiece, x: dragging.x, y: dragging.y } : null
  const movedGhostOwner = dragging?.kind === 'machine' && layoutStations.find((candidate) => candidate.id === dragging.ownerId)
  const movedGhostX = movedGhostOwner && movedGhost ? movedGhost.x + (station.position.x - movedGhostOwner.position.x) / CELL_SIZE : 0
  const movedGhostY = movedGhostOwner && movedGhost ? movedGhost.y + (station.position.y - movedGhostOwner.position.y) / CELL_SIZE : 0
  const routeDrag = dragging?.kind === 'route' && dragging.moved ? dragging : null
  const movedRoute = routeDrag
    ? worldPlacements(layoutStations)
        .filter((piece) => piece.routeId === routeDrag.routeId)
        .map((piece) => ({ ...piece, x: piece.x - worldX + routeDrag.dx, y: piece.y - worldY + routeDrag.dy }))
    : []
  const movedRouteValid = routeDrag
    ? canMoveRouteInLayout(layoutStations, station.id, routeDrag.routeId, routeDrag.dx, routeDrag.dy)
    : false
  const movedRouteOccupied = routeDrag
    ? indexPlacements([...station.placements.filter((piece) => piece.routeId !== routeDrag.routeId), ...movedRoute])
    : occupied

  return (
    <section className={cn('base-station relative', active && 'base-station--active')} style={{ width: outerSize, height: outerSize }}>
      <svg
        className={cn('base-station-frame absolute', tool === 'select' && 'base-station-frame--interactive')}
        style={{ left: -STATION_FRAME_CLEARANCE, top: -STATION_FRAME_CLEARANCE }}
        width={frameSize}
        height={frameSize}
        viewBox={`0 0 ${frameSize} ${frameSize}`}
        aria-hidden
      >
        <path className="base-station-frame-hit" d={framePath} />
        <path d={framePath} />
        <circle cx="7" cy="7" r="2" />
        <circle cx={frameSize - 7} cy="7" r="2" />
        <circle cx="7" cy={frameSize - 7} r="2" />
        <circle cx={frameSize - 7} cy={frameSize - 7} r="2" />
      </svg>
      <div
        role="button"
        tabIndex={0}
        aria-label={`${station.name}, ${footprintCells} by ${footprintCells} buildable cells, with walls between stations except at doorways. Click to place, arrow keys and Enter for keyboard placement, Escape or right-click to stop.`}
        className={cn(
          'base-station-grid nopan relative touch-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus',
          tool !== 'select' && 'nodrag',
          tool === 'select' ? 'cursor-grab' : 'cursor-crosshair',
        )}
        style={{ width: outerSize, height: outerSize }}
        onPointerDown={handlePointerDown}
        onAuxClick={handleAuxClick}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          dragRef.current = null
          setDragging(null)
        }}
        onPointerEnter={(event) => {
          setHovered(true)
          setCursor(getCell(event, size))
        }}
        onPointerLeave={() => {
          setHovered(false)
          setHoveredPort(null)
        }}
        onContextMenu={(event) => {
          event.preventDefault()
          event.stopPropagation()
          onReleaseTool()
        }}
        onKeyDown={handleKeyDown}
      >
        {ownedCorridors.map((corridor) => (
          <span
            key={corridor.id}
            className={cn(
              'base-station-corridor absolute',
              corridor.width < corridor.height ? 'base-station-corridor--horizontal' : 'base-station-corridor--vertical',
              tool !== 'select' && 'nodrag',
            )}
            style={{
              left: (corridor.x - worldX) * CELL_SIZE,
              top: (corridor.y - worldY) * CELL_SIZE,
              width: corridor.width * CELL_SIZE,
              height: corridor.height * CELL_SIZE,
            }}
            title="Connected, buildable corridor"
          />
        ))}
        {station.placements.map((placed) =>
          placed.id === draggedId || (draggedRouteId !== undefined && placed.routeId === draggedRouteId) ? null : PLACEABLES[placed.type]
              .category === 'logistics' ? (
            <BeltTile
              key={placed.id}
              occupied={occupied}
              placement={placed}
              canTraverse={canTraverse}
              phase={animatedBelts.get(placed.id)}
              selected={placed.routeId === selectedRouteId}
              interactive={tool === 'select'}
            />
          ) : (
            <MachineTile
              key={placed.id}
              occupied={occupied}
              placement={placed}
              canTraverse={canTraverse}
              routeable={isRouteTool(tool)}
              hoveredPort={hoveredPort}
              selected={placed.id === selectedPlacementId}
              interactive={tool === 'select'}
            />
          ),
        )}
        {routeDraft && routeActive
          ? previewRoute.map((cell) => (
              <BeltTile
                key={`preview-${cell.x}-${cell.y}`}
                occupied={previewOccupied}
                placement={{ id: 'preview', type: routeDraft.type, ...cell }}
                canTraverse={canTraverse}
                preview
                valid={previewValid}
              />
            ))
          : null}
        {routeDraft && routeActive
          ? routeDraft.anchors
              .filter((anchor) => routeCellOwner(layoutStations, station.id, anchor.x, anchor.y)?.id === station.id)
              .map((anchor, index) => (
                <span
                  key={`anchor-${index}`}
                  className={cn(
                    'base-route-anchor pointer-events-none absolute',
                    anchor === routeDraft.anchors.at(-1) && 'base-route-anchor--last',
                  )}
                  style={{ left: (anchor.x - worldX + 0.5) * CELL_SIZE, top: (anchor.y - worldY + 0.5) * CELL_SIZE }}
                  aria-hidden
                />
              ))
          : null}
        {ghost && hovered ? (
          PLACEABLES[ghost.type].category === 'machine' ? (
            <MachineTile
              occupied={occupied}
              placement={ghost}
              canTraverse={canTraverse}
              preview
              valid={canPlaceInLayout(layoutStations, station.id, ghost.type, ghost.x, ghost.y)}
            />
          ) : (
            <BeltTile
              occupied={occupied}
              placement={ghost}
              canTraverse={canTraverse}
              preview
              valid={canPlaceInLayout(layoutStations, station.id, ghost.type, ghost.x, ghost.y)}
            />
          )
        ) : null}
        {movedGhost ? (
          PLACEABLES[movedGhost.type].category === 'machine' ? (
            <MachineTile
              occupied={occupied}
              placement={movedGhost}
              canTraverse={canTraverse}
              preview
              moving
              valid={Boolean(
                movedGhostOwner && canMoveInLayout(layoutStations, movedGhostOwner.id, movedGhost.id, movedGhostX, movedGhostY),
              )}
            />
          ) : (
            <BeltTile
              occupied={occupied}
              placement={movedGhost}
              canTraverse={canTraverse}
              preview
              moving
              valid={Boolean(
                movedGhostOwner && canMoveInLayout(layoutStations, movedGhostOwner.id, movedGhost.id, movedGhostX, movedGhostY),
              )}
            />
          )
        ) : null}
        {movedRoute.map((piece) => (
          <BeltTile
            key={`moving-${piece.id}`}
            occupied={movedRouteOccupied}
            placement={piece}
            canTraverse={canTraverse}
            preview
            moving
            valid={movedRouteValid}
            selected
          />
        ))}
        <span
          className="base-grid-cursor pointer-events-none absolute hidden border border-primary/80"
          style={{ left: cursor.x * CELL_SIZE, top: cursor.y * CELL_SIZE, width: CELL_SIZE, height: CELL_SIZE }}
        />
      </div>
      {tool === 'select'
        ? ownedCorridors
            .filter((corridor, index) => ownedCorridors.findIndex((other) => other.otherId === corridor.otherId) === index)
            .map((corridor) => {
              const locked = station.lockedTo.includes(corridor.otherId)
              return (
                <button
                  key={`lock-${corridor.otherId}`}
                  type="button"
                  className="base-corridor-lock nodrag nopan absolute"
                  style={{
                    left: (corridor.x - worldX + corridor.width / 2) * CELL_SIZE,
                    top: (corridor.y - worldY + corridor.height / 2) * CELL_SIZE,
                  }}
                  aria-label={locked ? 'Unlock stations' : 'Lock stations together'}
                  aria-pressed={locked}
                  title={locked ? 'Unlock stations' : 'Lock stations together'}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation()
                    onToggleStationLock(station.id, corridor.otherId)
                  }}
                >
                  {locked ? <LockKeyhole size={13} aria-hidden /> : <LockKeyholeOpen size={13} aria-hidden />}
                </button>
              )
            })
        : null}
    </section>
  )
}
