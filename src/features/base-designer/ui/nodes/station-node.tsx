import { Button, cn } from '@heroui/react'
import { type NodeProps } from '@xyflow/react'
import { LockKeyhole, LockKeyholeOpen } from 'lucide-react'
import { useCallback, useLayoutEffect, useMemo } from 'react'
import { type CanTraverseEdge } from '../../lib/connections/connections'
import { indexPlacements, type BasePlacement } from '../../lib/layout/placement'
import { oppositeDirection } from '../../lib/connections/ports'
import { canCrossStationBoundary, droneOutputPorts } from '../../lib/layout/stations'
import { canPlaceInLayout } from '../../lib/layout/placement-validation'
import { floorOwner } from '../../lib/layout/world-layout'
import { CELL_SIZE, PLACEABLES, STATION_TYPES, isRouteTool } from '../../model/catalog'
import { corridorLockPosition, faceSteps } from '../../lib/geometry/station-spatial'
import { type StationFlowNode } from '../../model/station-node'
import { useStationInteractions } from './use-station-interactions'
import { DroneStationArtwork, StationFrame } from '../artwork/station-artwork'
import { PortMarker } from '../artwork/port-marker'
import { BeltTile } from '../artwork/belt-tile'
import { MachineTile } from '../artwork/machine-tile'

/**
 * Adapts the parent's shared world snapshot to station-local artwork and grid events.
 * Domain validation here only colors previews; callbacks delegate writes to the confirmed-state owner.
 */
export function StationNode({ data }: NodeProps<StationFlowNode>) {
  const {
    station,
    movementValid,
    toolDirection,
    layoutStations,
    layoutCorridors,
    worldPreviewRoute,
    animatedBelts,
    droneSourceCells,
    tool,
    active,
    selectedPlacementId,
    selectedRouteId,
    selectedAreaIds,
    selectionPreview,
    pasteActive,
    routeDraft,
    routePreviewValid,
    onActivate,
    onOpenDroneOutput,
    onClearDroneOutput,
    onOpenMachineItem,
    onToggleStationLock,
    onBuildPreviewChange,
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
  // Drone locks sit inside its non-buildable footprint, so its node must own the controls too.
  const lockCorridors = layoutCorridors.filter((corridor) => {
    if (corridor.ownerId !== station.id && corridor.otherId !== station.id) return false
    const drone = layoutStations.find(
      (candidate) => candidate.type === 'drone_station' && (candidate.id === corridor.ownerId || candidate.id === corridor.otherId),
    )
    return (drone?.id ?? corridor.ownerId) === station.id
  })
  const {
    cursor,
    hovered,
    hoveredPort,
    movingPieces,
    movingValid,
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
  } = useStationInteractions(data, canTraverse)
  const routeActive = Boolean(routeDraft && isRouteTool(tool))
  // Artwork only needs the unique floor/corridor owner; the parent/store validates route reachability.
  // Reuse the parent corridors instead of rebuilding the connected group for every cell in every node.
  const previewRoute = useMemo(
    () =>
      worldPreviewRoute
        .filter((cell) => floorOwner(layoutStations, layoutCorridors, cell.x, cell.y)?.id === station.id)
        .map((cell) => ({ ...cell, x: cell.x - worldX, y: cell.y - worldY })),
    [worldPreviewRoute, worldX, worldY, layoutStations, layoutCorridors, station.id],
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

  const ghostType = station.type !== 'drone_station' && tool !== 'select' && !isRouteTool(tool) ? tool : null
  const ghost: BasePlacement | null = ghostType
    ? {
        id: 'preview',
        type: ghostType,
        x: cursor.x - Math.floor((PLACEABLES[ghostType].width - 1) / 2),
        y: cursor.y - Math.floor((PLACEABLES[ghostType].height - 1) / 2),
        direction: toolDirection ?? (ghostType === 'material_lab' || ghostType === 'computation_lab' ? 'south' : 'east'),
      }
    : null
  const buildPreviewActive = Boolean(ghost && hovered)
  // Report visibility only on enter/leave; command routing must not infer application state from artwork classes.
  useLayoutEffect(() => {
    if (!buildPreviewActive || !onBuildPreviewChange) return
    onBuildPreviewChange(station.id, true)
    return () => onBuildPreviewChange(station.id, false)
  }, [buildPreviewActive, station.id, onBuildPreviewChange])
  const movingGhosts = movingPieces.map((piece) => ({ ...piece, x: piece.x - worldX, y: piece.y - worldY }))
  const movingOccupied = movingGhosts.length ? indexPlacements([...occupied.values(), ...movingGhosts]) : occupied

  return (
    <section
      data-base-station-id={station.id}
      data-movement-valid={movementValid}
      className={cn(
        'base-station relative',
        active && 'base-station--active',
        movementValid !== undefined && 'base-station--moving',
        station.type === 'drone_station' && 'base-station--drone',
      )}
      style={{ width: outerSize, height: outerSize }}
    >
      <StationFrame station={station} corridors={layoutCorridors} interactive={tool === 'select' && !pasteActive} />
      <div
        role="group"
        aria-roledescription="station grid"
        aria-label={
          station.type === 'drone_station'
            ? `${station.name}, ${footprintCells} by ${footprintCells} module, no internal building area, two output ports on its ${station.direction ?? 'south'} face.`
            : `${station.name}, ${footprintCells} by ${footprintCells} buildable cells, with walls between stations except at doorways. Shift-drag selects parts only, not stations or notes. Click to place, Escape or right-click to stop.`
        }
        className={cn(
          'base-station-grid nopan relative touch-none',
          (tool !== 'select' || pasteActive) && 'nodrag',
          tool === 'select' && !pasteActive ? 'cursor-grab' : 'cursor-crosshair',
        )}
        style={{ width: outerSize, height: outerSize }}
        onPointerDown={handlePointerDown}
        onClick={(event) => event.stopPropagation()}
        onAuxClick={handleAuxClick}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
        onLostPointerCapture={handleLostPointerCapture}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        onContextMenu={handleContextMenu}
      >
        {station.type === 'drone_station' ? (
          <DroneStationArtwork
            station={station}
            corridors={layoutCorridors}
            hoveredPort={hoveredPort}
            connectedOutputs={
              new Set(
                droneOutputPorts(station)
                  .filter((port) => droneSourceCells.has(`${port.x},${port.y}`))
                  .map((port) => port.slot),
              )
            }
            interactive={!pasteActive && (tool === 'select' || isRouteTool(tool))}
            onAssign={
              tool === 'select' && !pasteActive
                ? (slot) => {
                    onActivate(station.id)
                    onOpenDroneOutput(station.id, slot)
                  }
                : undefined
            }
            onClear={tool === 'select' && !pasteActive && onClearDroneOutput ? (slot) => onClearDroneOutput(station.id, slot) : undefined}
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
              interactive={tool === 'select'}
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
              interactive={tool === 'select'}
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
              .filter((anchor) => floorOwner(layoutStations, layoutCorridors, anchor.x, anchor.y)?.id === station.id)
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
        {movingGhosts.map((piece) =>
          PLACEABLES[piece.type].category === 'machine' ? (
            <MachineTile
              key={`selection-${piece.id}`}
              occupied={movingOccupied}
              placement={piece}
              canTraverse={canTraverse}
              preview
              moving
              valid={movingValid}
              selected
            />
          ) : (
            <BeltTile
              key={`selection-${piece.id}`}
              occupied={movingOccupied}
              placement={piece}
              canTraverse={canTraverse}
              preview
              moving
              valid={movingValid}
              selected
            />
          ),
        )}
        {areaDrag ? (
          <span
            className="pointer-events-none absolute z-20 border-2 border-dashed border-primary/85 bg-primary/10"
            style={{
              left: Math.min(areaDrag.startX, areaDrag.endX) * CELL_SIZE,
              top: Math.min(areaDrag.startY, areaDrag.endY) * CELL_SIZE,
              width: (Math.abs(areaDrag.endX - areaDrag.startX) + 1) * CELL_SIZE,
              height: (Math.abs(areaDrag.endY - areaDrag.startY) + 1) * CELL_SIZE,
            }}
            aria-hidden
          />
        ) : null}
      </div>
      {tool === 'select' && !pasteActive
        ? lockCorridors.flatMap((corridor) =>
            (['near', 'far'] as const).map((side) => {
              const otherId = corridor.ownerId === station.id ? corridor.otherId : corridor.ownerId
              const locked = station.lockedTo.includes(otherId)
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
                    station.type === 'drone_station' ? (corridor.ownerId === station.id ? 'start' : 'end') : undefined,
                    side,
                  )}
                  aria-label={locked ? 'Unlock stations' : 'Lock stations together'}
                  aria-pressed={locked}
                  title={locked ? 'Unlock stations' : 'Lock stations together'}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  onPress={() => onToggleStationLock(station.id, otherId)}
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
