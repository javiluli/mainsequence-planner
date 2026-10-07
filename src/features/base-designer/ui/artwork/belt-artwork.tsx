import { memo, useId } from 'react'
import { beltIncoming, beltOutputs } from '../../lib/connections/connections'
import { type BeltFlow } from '../../lib/connections/belt-flow'
import type { BasePlacement } from '../../lib/layout/placement'
import { oppositeDirection } from '../../lib/connections/ports'
import { edgePoints } from '../../lib/geometry/station-spatial'
import { isSplitterType, isUndergroundType, type Direction } from '../../model/catalog'

const angles: Record<Direction, number> = { east: 0, south: 90, west: 180, north: -90 }

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

// Interaction/highlight changes belong to the tile wrapper; stable placement/flow inputs keep SVG paths and clip IDs intact.
export const BeltArtwork = memo(function BeltArtwork({ placement, flows }: { placement: BasePlacement; flows?: readonly BeltFlow[] }) {
  const clipId = useId()
  const path = beltPath(placement)
  const endpoint = isUndergroundType(placement.type) && !placement.buried
  const entrance = placement.routeIndex === undefined || placement.routeIndex === 0
  return (
    <svg viewBox="0 0 20 20" className="absolute inset-0 h-full w-full" aria-hidden>
      {endpoint ? (
        <defs>
          <clipPath id={clipId}>
            <rect x={entrance ? 0 : 10} y={0} width={10} height={20} transform={`rotate(${angles[placement.direction]} 10 10)`} />
          </clipPath>
        </defs>
      ) : null}
      <g clipPath={endpoint ? `url(#${clipId})` : undefined}>
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
      </g>
      {endpoint ? (
        <g
          className="base-tunnel-mouth"
          data-role={entrance ? 'entrance' : 'exit'}
          transform={`rotate(${angles[placement.direction]} 10 10)`}
        >
          <path d={entrance ? 'M10 3 H17 V17 H10 Z' : 'M3 3 H10 V17 H3 Z'} />
          <path className="base-tunnel-lip" d="M10 4 V16" />
        </g>
      ) : null}
    </svg>
  )
})
