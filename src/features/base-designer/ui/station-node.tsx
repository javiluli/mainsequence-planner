import { Button, cn } from '@heroui/react'
import { itemNameById } from '@/shared/data'
import { AssetImage } from '@/shared/ui/asset-image'
import { type NodeProps } from '@xyflow/react'
import { Box, LockKeyhole, LockKeyholeOpen, Package, Split } from 'lucide-react'
import { memo, useCallback, useMemo, type CSSProperties } from 'react'
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
import { canCrossStationBoundary } from '../lib/stations'
import { canMoveInLayout, canMoveRouteInLayout, canPlaceInLayout, routeCellOwner } from '../lib/world-layout'
import { CELL_SIZE, PLACEABLES, STATION_TYPES, isRouteTool, isSplitterType, type PlaceableType } from '../model/catalog'

import {
  MACHINE_BODY_INSET,
  beltEndAnchor,
  cellInStation,
  corridorLockPosition,
  edgePoints,
  faceSteps,
  portPosition,
} from '../lib/station-spatial'
import { type StationFlowNode } from '../model/station-node'
import { useStationInteractions } from './use-station-interactions'
import { DroneStationArtwork, StationFrame } from './station-artwork'
import { PortArrow, PortMarker } from './port-marker'

const unrestrictedEdge: CanTraverseEdge = () => true

const machineMarkings: Partial<Record<PlaceableType, string>> = {
  reactor: 'REACTOR',
  refinery: 'REFINERY',
  assembler: 'ASSEMBLER',
  material_lab: 'MATERIAL LAB',
  container: 'BOX',
  enrichment: 'ENRICHMENT',
  computation_lab: 'COMPUTATION LAB',
}

function beltPath(placement: BasePlacement) {
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
  const [startX, startY] = edgePoints[entering]
  const [endX, endY] = edgePoints[placement.direction]
  const bend = entering !== oppositeDirection(placement.direction)
  const main = bend ? `M${startX} ${startY} Q10 10 ${endX} ${endY}` : `M${startX} ${startY} L${endX} ${endY}`
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

export const BeltTile = memo(function BeltTile({
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
  const path = beltPath(placement)
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
            <Split size={10} strokeWidth={2.5} />
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
                <PortArrow direction={input ? oppositeDirection(face) : face} />
              </span>
            )
          })}
        </>
      ) : null}
      {!splitter && !preview && !placement.buried
        ? (['input', 'output'] as const).map((role) => {
            if (role === 'input' && sourceInput) return null
            const anchor = beltEndAnchor(occupied, placement.x, placement.y, placement.type, role, canTraverse ?? unrestrictedEdge)
            if (!anchor || anchor.kind !== 'port') return null
            const [left, top] = edgePoints[anchor.face]
            const hovered =
              hoveredPort?.kind === 'port' &&
              hoveredPort.x === anchor.x &&
              hoveredPort.y === anchor.y &&
              hoveredPort.face === anchor.face &&
              hoveredPort.routeId === anchor.routeId
            return (
              <PortMarker
                key={role}
                className="base-belt-end"
                face={anchor.face}
                flow="unconnected"
                arrowDirection={role === 'input' ? oppositeDirection(anchor.face) : anchor.face}
                hovered={hovered}
                style={{ left, top }}
                title={role === 'input' ? 'Join belt here' : 'Continue belt here'}
              />
            )
          })
        : null}
    </div>
  )
})

export const MachineTile = memo(function MachineTile({
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
  onOpenItem,
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
  onOpenItem?: (placementId: string) => void
}) {
  const info = PLACEABLES[placement.type]
  const compact = info.width <= 3
  const markerSize = Math.min(88, Math.min(info.width, info.height) * CELL_SIZE * 0.5)
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
          : `${info.label} · ${placement.x + 1}, ${placement.y + 1} · ${info.width}×${info.height}${productNames ? ` · Produces ${productNames} · Right-click to clear product` : ''}`
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
      onDragStart={(event) => event.preventDefault()}
    >
      <span
        className={cn('base-machine-shell pointer-events-none absolute', products.length && 'base-machine-shell--has-products')}
        aria-hidden
      >
        <span className="base-machine-panel absolute inset-[4px]" />
        {products.length ? (
          <span className="base-machine-products absolute" aria-hidden>
            {visibleProducts.map((product, index) => (
              <span
                key={`${product.id}:${index}`}
                className={cn('base-machine-product', index === 0 && 'base-machine-product--primary')}
                title={`${index === 0 ? 'Primary product' : 'Co-product'}: ${itemNameById.get(product.id) ?? product.id}`}
              >
                <AssetImage kind="items" id={product.id} width={index === 0 ? markerSize : compact ? 12 : 22} alt="" />
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
        {!products.length ? (
          <span className="base-machine-band absolute right-[4px] left-[4px]">{machineMarkings[placement.type] ?? info.label}</span>
        ) : null}
        <span className="base-machine-fastener base-machine-fastener--tl" />
        <span className="base-machine-fastener base-machine-fastener--tr" />
        <span className="base-machine-fastener base-machine-fastener--bl" />
        <span className="base-machine-fastener base-machine-fastener--br" />
      </span>
      {interactive && onOpenItem && !storage && !products.length ? (
        <Button
          isIconOnly
          size="sm"
          variant="flat"
          aria-label={`Choose product for ${info.label}`}
          title="Choose product"
          className="base-machine-item-button nodrag nopan absolute h-5 min-h-0 w-5 min-w-0 rounded-sm p-0"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          onPress={() => onOpenItem(placement.id)}
        >
          <Package size={12} aria-hidden />
        </Button>
      ) : null}
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
              <PortMarker
                className={cn(
                  'base-machine-port absolute',
                  routeable && 'base-machine-port--routeable',
                  portHovered && 'base-machine-port--hovered',
                )}
                face={port.face}
                flow={flow ?? (outputEnabled ? 'unconnected' : 'disabled-output')}
                outputEnabled={outputEnabled}
                connected={Boolean(flow && flow !== 'disabled-output')}
                hovered={portHovered}
                title={portDescription}
                style={position}
              />
            </span>
          )
        })}
    </div>
  )
})

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
    onOpenMachineItem,
    onToggleStationLock,
  } = data
  const { footprintCells } = STATION_TYPES[station.type]
  const outerSize = footprintCells * CELL_SIZE
  const worldX = station.position.x / CELL_SIZE
  const worldY = station.position.y / CELL_SIZE
  const openMachineItem = useCallback((placementId: string) => onOpenMachineItem(station.id, placementId), [station.id, onOpenMachineItem])
  // Route hover does not change walls or placed machines. Keep their render inputs stable.
  const canTraverse: CanTraverseEdge = useCallback(
    (x, y, face) => {
      const [dx, dy] = faceSteps[face]
      return canCrossStationBoundary(
        layoutStations,
        { x: worldX + x, y: worldY + y },
        { x: worldX + x + dx, y: worldY + y + dy },
        layoutCorridors,
      )
    },
    [layoutStations, layoutCorridors, worldX, worldY],
  )
  const ownedCorridors = layoutCorridors.filter((corridor) => corridor.ownerId === station.id)
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
  const joinAnchor = routeDraft?.hover
  const joinPreview =
    routeActive &&
    joinAnchor?.kind === 'port' &&
    joinAnchor.mergeTargetId &&
    previewRoute.some((cell) => cell.x === joinAnchor.x - worldX && cell.y === joinAnchor.y - worldY)
      ? joinAnchor
      : null

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
      <StationFrame station={station} corridors={layoutCorridors} interactive={tool === 'select' && !pasteActive} />
      <div
        role="group"
        aria-roledescription="station grid"
        tabIndex={0}
        aria-label={
          station.type === 'drone_station'
            ? `${station.name}, ${footprintCells} by ${footprintCells} module, no internal building area, two output ports on its ${station.direction ?? 'south'} face.`
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
          <DroneStationArtwork
            station={station}
            corridors={layoutCorridors}
            hoveredPort={hoveredPort}
            onAssign={
              tool === 'select' && !pasteActive
                ? (slot) => {
                    onActivate(station.id)
                    onOpenDroneOutput(station.id, slot)
                  }
                : undefined
            }
          />
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
          const footprint = PLACEABLES[placed.type]
          const nearbyPort =
            hoveredPort &&
            hoveredPort.x >= placed.x - 1 &&
            hoveredPort.x <= placed.x + footprint.width &&
            hoveredPort.y >= placed.y - 1 &&
            hoveredPort.y <= placed.y + footprint.height
              ? hoveredPort
              : null
          return PLACEABLES[placed.type].category === 'logistics' ? (
            <BeltTile
              key={placed.id}
              occupied={occupied}
              placement={placed}
              canTraverse={canTraverse}
              flows={animatedBelts.get(placed.id)}
              sourceInput={droneSourceCells.has(`${worldX + placed.x},${worldY + placed.y}`)}
              selected={placed.id === selectedPlacementId || placed.routeId === selectedRouteId || selectedAreaIds.has(placed.id)}
              hoveredPort={nearbyPort}
              interactive={tool === 'select' && !pasteActive}
            />
          ) : (
            <MachineTile
              key={placed.id}
              occupied={occupied}
              placement={placed}
              canTraverse={canTraverse}
              routeable={isRouteTool(tool)}
              hoveredPort={nearbyPort}
              selected={placed.id === selectedPlacementId || selectedAreaIds.has(placed.id)}
              interactive={tool === 'select' && !pasteActive}
              onOpenItem={openMachineItem}
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
        {joinPreview ? (
          <PortMarker
            className="base-belt-join-preview"
            face={joinPreview.face}
            flow={routePreviewValid ? 'unconnected' : 'disabled-output'}
            arrowDirection={oppositeDirection(joinPreview.face)}
            hovered={routePreviewValid}
            style={{
              left: (joinPreview.x - worldX + 0.5 - faceSteps[joinPreview.face][0] / 2) * CELL_SIZE,
              top: (joinPreview.y - worldY + 0.5 - faceSteps[joinPreview.face][1] / 2) * CELL_SIZE,
            }}
            title={routePreviewValid ? 'Join conveyor' : 'Cannot join conveyor here'}
          />
        ) : null}
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
        ? ownedCorridors.flatMap((corridor) =>
            (['near', 'far'] as const).map((side) => {
              const locked = station.lockedTo.includes(corridor.otherId)
              return (
                <Button
                  key={`lock-${corridor.id}-${side}`}
                  isIconOnly
                  disableAnimation
                  disableRipple
                  variant="flat"
                  className="base-corridor-lock nodrag nopan absolute h-5 min-h-0 w-5 min-w-0 rounded-sm p-0"
                  style={corridorLockPosition(
                    corridor,
                    { x: worldX, y: worldY },
                    station.type === 'drone_station'
                      ? 'start'
                      : layoutStations.find((other) => other.id === corridor.otherId)?.type === 'drone_station'
                        ? 'end'
                        : undefined,
                    side,
                  )}
                  aria-label={locked ? 'Unlock stations' : 'Lock stations together'}
                  aria-pressed={locked}
                  title={locked ? 'Unlock stations' : 'Lock stations together'}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  onPress={() => onToggleStationLock(station.id, corridor.otherId)}
                >
                  {locked ? <LockKeyhole size={10} aria-hidden /> : <LockKeyholeOpen size={10} aria-hidden />}
                </Button>
              )
            }),
          )
        : null}
    </section>
  )
}
