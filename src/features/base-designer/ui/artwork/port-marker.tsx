import { cn } from '@heroui/react'
import { ChevronRight, X } from 'lucide-react'
import type { CSSProperties } from 'react'
import { oppositeDirection } from '../../lib/connections/ports'
import type { Direction } from '../../model/catalog'

const arrowAngles: Record<Direction, number> = { north: -90, east: 0, south: 90, west: 180 }

export function PortArrow({ direction }: { direction: Direction }) {
  return (
    <ChevronRight size={6} strokeWidth={2} className="shrink-0" style={{ transform: `rotate(${arrowAngles[direction]}deg)` }} aria-hidden />
  )
}

/** Visual state only: connection validity remains in the domain and shared hit-testing. */
export function PortMarker({
  face,
  flow,
  hovered = false,
  outputEnabled,
  connected,
  arrowDirection,
  className,
  style,
  title,
}: {
  face: Direction
  flow: 'input' | 'output' | 'unconnected' | 'disabled-output'
  hovered?: boolean
  outputEnabled?: boolean
  connected?: boolean
  arrowDirection?: Direction
  className?: string
  style: CSSProperties
  title: string
}) {
  return (
    <span
      className={cn('base-io-port pointer-events-none absolute', className)}
      data-face={face}
      data-flow={flow}
      data-hovered={hovered}
      data-output-enabled={outputEnabled}
      data-connected={connected}
      style={style}
      title={title}
      aria-hidden
    >
      {flow === 'disabled-output' ? (
        <X size={8} strokeWidth={3} />
      ) : !connected && (flow !== 'unconnected' || arrowDirection) ? (
        <PortArrow direction={arrowDirection ?? (flow === 'input' ? oppositeDirection(face) : face)} />
      ) : null}
    </span>
  )
}
