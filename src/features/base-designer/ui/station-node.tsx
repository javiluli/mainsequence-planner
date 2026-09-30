import { cn } from '@heroui/react'
import { itemNameById } from '@/shared/data'
import { AssetImage } from '@/shared/ui/asset-image'
import { type NodeProps } from '@xyflow/react'
import { ArrowRight, Box, LockKeyhole, LockKeyholeOpen, Plus, X } from 'lucide-react'
import { useMemo, type CSSProperties } from 'react'
import {
  beltConnection,
  beltIncoming,
  beltOutputs,
  canAccessMachinePort,
  machinePortFlow,
  type BeltFlow,
  type CanTraverseEdge,
  type OccupiedCells,
} from '../lib/connections'
import { indexPlacements, type BasePlacement } from '../lib/placement'
import { recipeForPlaceable, recipeOutputs } from '../lib/machine-recipes'
import { machinePortKey, machinePorts, oppositeDirection, portOutsideCell } from '../lib/ports'
import { type RouteAnchor } from '../lib/route'
import { canCrossStationBoundary, droneOutputPorts } from '../lib/stations'
import { canMoveInLayout, canMoveRouteInLayout, canPlaceInLayout, routeCellOwner } from '../lib/world-layout'
import {
  CELL_SIZE,
  PLACEABLES,
  STATION_GATE_CELLS,
  STATION_TYPES,
  isRouteTool,
  isSplitterType,
  type Direction,
  type PlaceableType,
} from '../model/catalog'

import { MACHINE_BODY_INSET, cellInStation, edgePoints, faceSteps, portPosition } from '../lib/station-spatial'
import { type StationFlowNode } from '../model/station-node'
import { useStationInteractions } from './use-station-interactions'

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

function stationFramePath(footprintCells: number, gateStarts: readonly number[], openFaces: readonly string[]): string {
  const outer = footprintCells * CELL_SIZE
  const frameSize = outer + STATION_FRAME_CLEARANCE * 2
  const segments = (face: Direction): [number, number][] => {
    if (!openFaces.includes(face)) return [[0, footprintCells]]
    const rails: [number, number][] = []
    let start = 0
    for (const gate of gateStarts) {
      rails.push([start, gate])
      start = gate + STATION_GATE_CELLS
    }
    rails.push([start, footprintCells])
    return rails
  }
  const coordinate = (cell: number) =>
    cell === 0 ? 1.5 : cell === footprintCells ? frameSize - 1.5 : STATION_FRAME_CLEARANCE + cell * CELL_SIZE
  return (['north', 'south', 'west', 'east'] as const)
    .flatMap((face) =>
      segments(face).map(([from, to]) =>
        face === 'north'
          ? `M${coordinate(from)} 1.5 H${coordinate(to)}`
          : face === 'south'
            ? `M${coordinate(from)} ${frameSize - 1.5} H${coordinate(to)}`
            : face === 'west'
              ? `M1.5 ${coordinate(from)} V${coordinate(to)}`
              : `M${frameSize - 1.5} ${coordinate(from)} V${coordinate(to)}`,
      ),
    )
    .join(' ')
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
  const main =
    bend && connectedInput === connectedOutput ? `M${startX} ${startY} Q10 10 ${endX} ${endY}` : `M${startX} ${startY} L${endX} ${endY}`
  const branches = (placement.extraIncoming ?? []).map((face) => {
    const [x, y] = edgePoints[face]
    return `M${x} ${y} L10 10`
  })
  return [main, ...branches].join(' ')
}

function beltFlowPath(placement: BasePlacement, flow: BeltFlow): string {
  const [startX, startY] = edgePoints[flow.entering]
  const [endX, endY] = edgePoints[flow.leaving]
  if (isSplitterType(placement.type) || placement.extraIncoming?.includes(flow.entering)) {
    return `M${startX} ${startY} L10 10 L${endX} ${endY}`
  }
  return flow.entering === oppositeDirection(flow.leaving)
    ? `M${startX} ${startY} L${endX} ${endY}`
    : `M${startX} ${startY} Q10 10 ${endX} ${endY}`
}

export function BeltTile({
  occupied,
  placement,
  canTraverse,
  preview,
  valid = true,
  flows,
  selected = false,
  moving = false,
  interactive = false,
  sourceInput = false,
  hoveredPort,
}: {
  occupied: OccupiedCells
  placement: BasePlacement
  canTraverse?: CanTraverseEdge
  preview?: boolean
  valid?: boolean
  flows?: readonly BeltFlow[]
  selected?: boolean
  moving?: boolean
  interactive?: boolean
  sourceInput?: boolean
  hoveredPort?: RouteAnchor | null
}) {
  const tunnel = placement.type.startsWith('underground')
  const connectedInput = tunnel || sourceInput || Boolean(beltConnection(occupied, placement, beltIncoming(placement), canTraverse))
  const connectedOutput = tunnel || beltOutputs(placement).some((face) => Boolean(beltConnection(occupied, placement, face, canTraverse)))
  const path = beltPath(placement, connectedInput, connectedOutput)
  const splitter = isSplitterType(placement.type)
  const incoming = beltIncoming(placement)
  const inputDescription = splitter ? ` · Input ${incoming}; outputs ${beltOutputs(placement).join(', ')}` : ''
  return (
    <div
      title={
        preview
          ? undefined
          : `${PLACEABLES[placement.type].label} · ${placement.x + 1}, ${placement.y + 1} · ${placement.direction}${inputDescription}`
      }
      className={cn(
        'base-placement base-placement--logistics absolute',
        interactive ? 'nodrag pointer-events-auto cursor-move' : 'pointer-events-none',
        interactive && 'base-placement--interactive',
        placement.type.startsWith('underground') && 'base-placement--underground',
        placement.buried && 'base-placement--buried',
        splitter && 'base-placement--splitter',
        preview && 'base-placement--preview',
        preview && !valid && 'base-placement--invalid',
        Boolean(flows?.length) && 'base-placement--flowing',
        selected && 'base-placement--selected-route',
        moving && 'base-placement--moving',
      )}
      style={{ left: placement.x * CELL_SIZE, top: placement.y * CELL_SIZE, width: CELL_SIZE, height: CELL_SIZE }}
    >
      <svg viewBox="0 0 20 20" className="absolute inset-0 h-full w-full" aria-hidden>
        <path d={path} className="base-belt-shell" />
        <path d={path} className="base-belt-core" />
        {flows?.map((flow) => (
          <path
            key={`${flow.entering}-${flow.leaving}`}
            d={beltFlowPath(placement, flow)}
            className="base-belt-slats"
            style={{ animationDelay: `${-((15 - (flow.phase % 15)) % 15) / 15}s` }}
          />
        ))}
      </svg>
      {splitter ? (
        <>
          <span className="base-splitter-center absolute" aria-hidden>
            S
          </span>
          {(['north', 'east', 'south', 'west'] as const).map((face) => {
            const input = face === incoming
            const connected = !preview && Boolean(beltConnection(occupied, placement, face, canTraverse))
            const [dx, dy] = faceSteps[face]
            const hovered =
              hoveredPort?.kind === 'port' &&
              hoveredPort.face === face &&
              hoveredPort.x === placement.x + dx &&
              hoveredPort.y === placement.y + dy
            return (
              <span
                key={face}
                className="base-splitter-port absolute"
                data-face={face}
                data-role={input ? 'input' : 'output'}
                data-connected={connected}
                data-hovered={hovered}
                title={`${face} · ${input ? 'Input' : 'Output'} · ${connected ? 'Connected' : 'No connection'}`}
                aria-hidden
              >
                <ArrowRight
                  size={8}
                  strokeWidth={3}
                  style={{ transform: `rotate(${arrowAngles[input ? oppositeDirection(face) : face]}deg)` }}
                />
              </span>
            )
          })}
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
  const markerSize = compact ? 14 : 28
  const storage = placement.type === 'container'
  const recipe = recipeForPlaceable(placement.type, placement.recipeId)
  const products = recipe ? recipeOutputs(recipe) : []
  const productNames = products.map((product) => itemNameById.get(product.id) ?? product.id).join(', ')
  const productSlots = Math.max(2, Math.floor((info.width * CELL_SIZE - MACHINE_BODY_INSET * 2 - 8) / (markerSize + 3)))
  const visibleProducts = products.slice(0, products.length > productSlots ? productSlots - 1 : productSlots)
  const hiddenProductCount = products.length - visibleProducts.length
  const machineStyle: CSSProperties & Record<'--base-machine-inset' | '--base-marker-size', string> = {
    left: placement.x * CELL_SIZE,
    top: placement.y * CELL_SIZE,
    width: info.width * CELL_SIZE,
    height: info.height * CELL_SIZE,
    '--base-machine-inset': `${MACHINE_BODY_INSET}px`,
    '--base-marker-size': `${markerSize}px`,
  }
  return (
    <div
      title={
        preview
          ? undefined
          : `${info.label} · ${placement.x + 1}, ${placement.y + 1} · ${info.width}×${info.height}${productNames ? ` · Produces ${productNames}` : ''}`
      }
      className={cn(
        'base-placement base-placement--machine absolute',
        interactive ? 'nodrag pointer-events-auto cursor-move' : 'pointer-events-none',
        interactive && 'base-placement--interactive',
        compact && 'base-placement--compact',
        storage && 'base-placement--storage',
        preview && 'base-placement--preview',
        preview && !valid && 'base-placement--invalid',
        moving && 'base-placement--moving',
        selected && 'base-placement--selected-machine',
      )}
      style={machineStyle}
    >
      <span className={cn('base-machine-shell absolute', products.length && 'base-machine-shell--has-products')} aria-hidden>
        <span className="base-machine-panel absolute inset-[4px]" />
        {products.length ? (
          <span className="base-machine-products absolute" aria-hidden>
            {visibleProducts.map((product, index) => (
              <span
                key={`${product.id}:${index}`}
                className="base-machine-product"
                title={`${index === 0 ? 'Primary product' : 'Co-product'}: ${itemNameById.get(product.id) ?? product.id}`}
              >
                <AssetImage kind="items" id={product.id} width={compact ? 12 : 22} alt="" />
              </span>
            ))}
            {hiddenProductCount ? (
              <span className="base-machine-product base-machine-product--count" title={`Products: ${productNames}`}>
                +{hiddenProductCount}
              </span>
            ) : null}
          </span>
        ) : storage ? (
          <Box className="base-storage-mark absolute" size={8} strokeWidth={2.5} />
        ) : (
          <span className="base-machine-vent absolute top-[14%] right-[13%]" />
        )}
        <span className="base-machine-band absolute right-[4px] left-[4px]">{machineMarkings[placement.type] ?? info.label}</span>
        {placement.inputItemId ? (
          <span
            className="base-machine-item absolute"
            title={`Input marker: ${itemNameById.get(placement.inputItemId) ?? placement.inputItemId}`}
          >
            <AssetImage kind="items" id={placement.inputItemId} width={compact ? 12 : 22} alt="" />
          </span>
        ) : null}
        <span className="base-machine-fastener base-machine-fastener--tl" />
        <span className="base-machine-fastener base-machine-fastener--tr" />
        <span className="base-machine-fastener base-machine-fastener--bl" />
        <span className="base-machine-fastener base-machine-fastener--br" />
      </span>
      {machinePorts(placement)
        .filter((port) => !canTraverse || canAccessMachinePort(placement, port, canTraverse))
        .map((port) => {
          const flow = preview ? null : machinePortFlow(occupied, placement, port, canTraverse)
          const outputEnabled = !placement.disabledOutputPorts?.includes(machinePortKey(port))
          const portDescription = `${port.face} cell ${port.offset + 1} · ${flow === 'input' ? 'Input connected' : flow === 'output' ? 'Output connected' : flow === 'disabled-output' ? 'Output blocked' : 'No belt'} · Output ${outputEnabled ? 'enabled' : 'disabled'}; input stays available`
          const outside = portOutsideCell(placement, port)
          const portHovered =
            hoveredPort?.kind === 'port' && hoveredPort.x === outside.x && hoveredPort.y === outside.y && hoveredPort.face === port.face
          const position = portPosition(placement, port)
          return (
            <span key={`${port.face}-${port.offset}`} aria-hidden>
              {flow && flow !== 'disabled-output' ? (
                <span className="base-machine-port-bridge absolute" data-face={port.face} style={position} />
              ) : null}
              <span
                className={cn(
                  'base-machine-port absolute',
                  routeable && 'base-machine-port--routeable',
                  portHovered && 'base-machine-port--hovered',
                )}
                data-face={port.face}
                data-flow={flow ?? 'unconnected'}
                data-output-enabled={outputEnabled}
                title={portDescription}
                style={position}
              >
                {flow === 'disabled-output' || (!flow && !outputEnabled) ? (
                  <X size={8} strokeWidth={3} />
                ) : flow ? (
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
    layoutCorridors,
    worldPieces,
    worldPreviewRoute,
    externalPlacements,
    animatedBelts,
    droneSourceCells,
    tool,
    active,
    selectedPlacementId,
    selectedRouteId,
    selectedAreaIds,
    selectionPreview,
    pasteActive,
    pastePreview,
    routeDraft,
    routePreviewValid,
    onActivate,
    onOpenDroneOutput,
    onToggleStationLock,
  } = data
  const { footprintCells, gateStarts, openFaces } = STATION_TYPES[station.type]
  const outerSize = footprintCells * CELL_SIZE
  const frameSize = outerSize + STATION_FRAME_CLEARANCE * 2
  const worldX = station.position.x / CELL_SIZE
  const worldY = station.position.y / CELL_SIZE
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
  const framePath = stationFramePath(footprintCells, gateStarts, openFaces)
  const {
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
  } = useStationInteractions(data, canTraverse)
  const routeActive = Boolean(routeDraft && isRouteTool(tool))
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

  const ghostType = station.type !== 'drone_station' && tool !== 'select' && tool !== 'erase' && !isRouteTool(tool) ? tool : null
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
  const movedGhostCell = movedGhostOwner && movedGhost ? cellInStation(movedGhost, station, movedGhostOwner) : { x: 0, y: 0 }
  const routeDrag = dragging?.kind === 'route' && dragging.moved ? dragging : null
  const movedRoute = routeDrag
    ? worldPieces
        .filter((piece) => piece.routeId === routeDrag.routeId)
        .map((piece) => ({ ...piece, x: piece.x - worldX + routeDrag.dx, y: piece.y - worldY + routeDrag.dy }))
    : []
  const movedRouteValid = routeDrag
    ? canMoveRouteInLayout(layoutStations, station.id, routeDrag.routeId, routeDrag.dx, routeDrag.dy)
    : false
  const movedRouteOccupied = routeDrag
    ? indexPlacements([...station.placements.filter((piece) => piece.routeId !== routeDrag.routeId), ...movedRoute])
    : occupied
  const selectedGhosts =
    selectionPreview?.sourceStationId === station.id
      ? worldPieces
          .filter((piece) => selectedAreaIds.has(piece.id))
          .map((piece) => ({ ...piece, x: piece.x - worldX + selectionPreview.dx, y: piece.y - worldY + selectionPreview.dy }))
      : []
  const pastedGhosts =
    pastePreview?.stationId === station.id
      ? pastePreview.pieces.map((piece) => ({
          ...piece,
          id: `paste-${piece.id}`,
          routeId: piece.routeId ? `paste-${piece.routeId}` : undefined,
          x: piece.x - worldX,
          y: piece.y - worldY,
        }))
      : []
  const groupGhosts = [...selectedGhosts, ...pastedGhosts]
  const selectedGhostOccupied = groupGhosts.length
    ? indexPlacements([
        ...station.placements.filter((piece) => !selectedAreaIds.has(piece.id)),
        ...externalPlacements.filter((piece) => !selectedAreaIds.has(piece.id)),
        ...groupGhosts,
      ])
    : occupied

  return (
    <section
      data-base-station-id={station.id}
      className={cn(
        'base-station relative',
        active && 'base-station--active',
        station.type === 'drone_station' && 'base-station--drone',
        pastedGhosts.length > 0 && 'base-station--paste-preview',
      )}
      style={{ width: outerSize, height: outerSize }}
    >
      <svg
        className={cn('base-station-frame absolute', tool === 'select' && !pasteActive && 'base-station-frame--interactive')}
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
        aria-label={
          station.type === 'drone_station'
            ? `${station.name}, ${footprintCells} by ${footprintCells} module, no internal building area, two output ports on its south face.`
            : `${station.name}, ${footprintCells} by ${footprintCells} buildable cells, with walls between stations except at doorways. Shift-drag selects parts only, not stations or notes. Click to place, arrow keys and Enter for keyboard placement, Escape or right-click to stop.`
        }
        className={cn(
          'base-station-grid nopan relative touch-none outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-focus',
          (tool !== 'select' || pasteActive) && 'nodrag',
          tool === 'select' && !pasteActive ? 'cursor-grab' : 'cursor-crosshair',
        )}
        style={{ width: outerSize, height: outerSize }}
        onPointerDown={handlePointerDown}
        onAuxClick={handleAuxClick}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handleLostPointerCapture}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onContextMenu={handleContextMenu}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
      >
        {station.type === 'drone_station' ? (
          <>
            <svg className="base-drone-art pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 280 280" aria-hidden>
              <path d="M119 28h42l10 22H109z" fill="#3a4b56" stroke="#7f939e" strokeWidth="2" />
              <path d="M88 54h104l58 43v86l-58 43H88l-58-43V97z" fill="#aebbc4" stroke="#526672" strokeWidth="5" />
              <path d="M91 62h98l53 39v78l-53 39H91l-53-39v-78z" fill="#d1d8dc" stroke="#eff2f1" strokeWidth="2" />
              <path d="M106 58h68l-11 42h-46zM83 190h114l-11 29H94z" fill="#899aa5" opacity=".8" />
              <rect x="29" y="119" width="47" height="46" rx="12" fill="#e7bd66" stroke="#956b35" strokeWidth="3" />
              <rect x="38" y="127" width="29" height="30" rx="8" fill="#8797a1" stroke="#50626e" strokeWidth="2" />
              <rect x="204" y="119" width="47" height="46" rx="12" fill="#e7bd66" stroke="#956b35" strokeWidth="3" />
              <rect x="213" y="127" width="29" height="30" rx="8" fill="#8797a1" stroke="#50626e" strokeWidth="2" />
              <path d="M118 91h44l17 38-17 60h-44l-17-60z" fill="#81909a" stroke="#5a6b76" strokeWidth="3" />
              <path d="M112 121h56l13 16-13 18h-56l-13-18z" fill="#eaa53d" stroke="#a76f24" strokeWidth="3" />
              <circle cx="140" cy="138" r="13" fill="#536673" stroke="#f6c766" strokeWidth="4" />
              <circle cx="140" cy="138" r="5" fill="#b3c4cb" />
              <path d="M105 205v73h70v-73" fill="#758894" stroke="#526672" strokeWidth="3" />
              <text x="140" y="187" textAnchor="middle" fill="#364b56" fontSize="10" fontWeight="800" letterSpacing="2">
                DRONE
              </text>
            </svg>
            {([0, 1] as const).map((slot) => {
              const itemId = station.droneOutputs?.[slot]
              const label = itemId ? (itemNameById.get(itemId) ?? itemId) : 'unassigned'
              return (
                <span
                  key={`drone-cargo-${slot}`}
                  className={cn('base-drone-item absolute', (tool !== 'select' || pasteActive) && 'pointer-events-none')}
                  style={{ left: slot === 0 ? 29 : 204, top: 119 }}
                >
                  {itemId ? <AssetImage kind="items" id={itemId} width={28} alt="" /> : <Plus size={16} aria-hidden />}
                  {tool === 'select' && !pasteActive ? (
                    <button
                      type="button"
                      className="nodrag nopan absolute inset-0 rounded-[10px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                      aria-label={`Assign item to drone ${slot + 1}, currently ${label}`}
                      title={`Drone ${slot + 1}: ${label}. Click to assign.`}
                      onPointerDown={(event) => event.stopPropagation()}
                      onClick={(event) => {
                        event.stopPropagation()
                        onActivate(station.id)
                        onOpenDroneOutput(station.id, slot)
                      }}
                    />
                  ) : null}
                </span>
              )
            })}
            {droneOutputPorts(station).map((port) => (
              <span
                key={port.slot}
                className="base-drone-port pointer-events-none absolute"
                style={{ left: (port.x - worldX + 0.5) * CELL_SIZE, top: outerSize }}
                title={
                  port.itemId
                    ? `Output ${port.slot + 1}: ${itemNameById.get(port.itemId) ?? port.itemId}`
                    : `Output ${port.slot + 1}: unassigned`
                }
              >
                <ArrowRight size={9} style={{ transform: 'rotate(90deg)' }} aria-hidden />
              </span>
            ))}
          </>
        ) : null}
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
        {station.placements.map((placed) => {
          if (
            placed.id === draggedId ||
            (draggedRouteId !== undefined && placed.routeId === draggedRouteId) ||
            (selectionPreview && selectedAreaIds.has(placed.id))
          )
            return null
          return PLACEABLES[placed.type].category === 'logistics' ? (
            <BeltTile
              key={placed.id}
              occupied={occupied}
              placement={placed}
              canTraverse={canTraverse}
              flows={animatedBelts.get(placed.id)}
              sourceInput={droneSourceCells.has(`${worldX + placed.x},${worldY + placed.y}`)}
              selected={placed.id === selectedPlacementId || placed.routeId === selectedRouteId || selectedAreaIds.has(placed.id)}
              hoveredPort={hoveredPort}
              interactive={tool === 'select' && !pasteActive}
            />
          ) : (
            <MachineTile
              key={placed.id}
              occupied={occupied}
              placement={placed}
              canTraverse={canTraverse}
              routeable={isRouteTool(tool)}
              hoveredPort={hoveredPort}
              selected={placed.id === selectedPlacementId || selectedAreaIds.has(placed.id)}
              interactive={tool === 'select' && !pasteActive}
            />
          )
        })}
        {routeDraft && routeActive
          ? previewRoute.map((cell) => (
              <BeltTile
                key={`preview-${cell.x}-${cell.y}`}
                occupied={previewOccupied}
                placement={{ id: 'preview', type: routeDraft.type, ...cell }}
                canTraverse={canTraverse}
                preview
                valid={routePreviewValid}
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
                movedGhostOwner && canMoveInLayout(layoutStations, movedGhostOwner.id, movedGhost.id, movedGhostCell.x, movedGhostCell.y),
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
                movedGhostOwner && canMoveInLayout(layoutStations, movedGhostOwner.id, movedGhost.id, movedGhostCell.x, movedGhostCell.y),
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
        {groupGhosts.map((piece) =>
          PLACEABLES[piece.type].category === 'machine' ? (
            <MachineTile
              key={`selection-${piece.id}`}
              occupied={selectedGhostOccupied}
              placement={piece}
              canTraverse={canTraverse}
              preview
              moving
              valid={pasteActive ? pastePreview?.valid : selectionPreview?.valid}
              selected
            />
          ) : (
            <BeltTile
              key={`selection-${piece.id}`}
              occupied={selectedGhostOccupied}
              placement={piece}
              canTraverse={canTraverse}
              preview
              moving
              valid={pasteActive ? pastePreview?.valid : selectionPreview?.valid}
              selected
            />
          ),
        )}
        {areaDrag ? (
          <span
            className="pointer-events-none absolute z-20 border border-dashed border-primary bg-primary/10"
            style={{
              left: Math.min(areaDrag.startX, areaDrag.endX) * CELL_SIZE,
              top: Math.min(areaDrag.startY, areaDrag.endY) * CELL_SIZE,
              width: (Math.abs(areaDrag.endX - areaDrag.startX) + 1) * CELL_SIZE,
              height: (Math.abs(areaDrag.endY - areaDrag.startY) + 1) * CELL_SIZE,
            }}
            aria-hidden
          />
        ) : null}
        <span
          className="base-grid-cursor pointer-events-none absolute hidden border border-primary/80"
          style={{ left: cursor.x * CELL_SIZE, top: cursor.y * CELL_SIZE, width: CELL_SIZE, height: CELL_SIZE }}
        />
      </div>
      {tool === 'select' && !pasteActive
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
