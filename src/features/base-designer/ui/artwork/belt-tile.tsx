import { cn } from '@heroui/react'
import { memo, useMemo } from 'react'
import { Split } from 'lucide-react'
import {
  beltConnection,
  beltIncoming,
  beltInputFaces,
  beltOutputs,
  type CanTraverseEdge,
  type OccupiedCells,
} from '../../lib/connections/connections'
import type { BeltFlow } from '../../lib/connections/belt-flow'
import type { BasePlacement } from '../../lib/layout/placement'
import { oppositeDirection } from '../../lib/connections/ports'
import type { RouteAnchor } from '../../lib/routes/route'
import { beltEndAnchor, edgePoints, faceSteps } from '../../lib/geometry/station-spatial'
import { CELL_SIZE, PLACEABLES, isSplitterType } from '../../model/catalog'
import { PortArrow, PortMarker } from './port-marker'
import { BeltArtwork } from './belt-artwork'

const unrestrictedEdge: CanTraverseEdge = () => true

/**
 * Paint logistics and their interactive port hints in the caller's cell frame (station-local or world).
 * Occupancy/traversal must use that frame; proposals, validation and confirmed flow phases belong to callers.
 * Derived lateral inputs affect artwork only, never the stored placement or its explicit junctions.
 */
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
  const splitter = isSplitterType(placement.type)
  const incoming = beltIncoming(placement)
  const artworkPlacement = useMemo(() => {
    if (preview) return placement
    const inputs = beltInputFaces(occupied, placement, canTraverse)
    const extraIncoming = inputs.filter((face) => face !== beltIncoming(placement))
    return extraIncoming.length === (placement.extraIncoming?.length ?? 0) ? placement : { ...placement, extraIncoming }
  }, [placement, occupied, canTraverse, preview])
  const inputDescription = splitter ? ` · Input ${incoming}; outputs ${beltOutputs(placement).join(', ')}` : ''
  const tunnelDescription =
    placement.type.startsWith('underground') && !placement.buried
      ? ` · Tunnel ${placement.routeIndex === undefined || placement.routeIndex === 0 ? 'entrance' : 'exit'}`
      : ''
  return (
    <div
      title={
        preview
          ? undefined
          : `${PLACEABLES[placement.type].label} · ${placement.x + 1}, ${placement.y + 1} · ${placement.direction}${inputDescription}${tunnelDescription}`
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
      <BeltArtwork placement={artworkPlacement} flows={flows} />
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
                className="base-io-port base-splitter-port absolute"
                data-face={face}
                data-role={input ? 'input' : 'output'}
                data-flow={connected ? (input ? 'input' : 'output') : 'unconnected'}
                data-connected={connected}
                data-hovered={hovered}
                title={`${face} · ${input ? 'Input' : 'Output'} · ${connected ? 'Connected' : 'No connection'}`}
                aria-hidden
              >
                {!connected ? <PortArrow direction={input ? oppositeDirection(face) : face} /> : null}
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
