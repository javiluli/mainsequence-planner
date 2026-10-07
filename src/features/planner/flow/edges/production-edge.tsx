import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from '@xyflow/react'
import type { PlannerFlowEdge } from '../types'

/** The card sits over the Bezier at its midpoint without replacing the semantic edge name. */
export function ProductionEdge({
  id,
  data,
  style,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps<PlannerFlowEdge>) {
  const [path, labelX, labelY] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })

  return (
    <>
      <BaseEdge id={id} path={path} style={style} />
      {data && (
        <EdgeLabelRenderer>
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute flex max-w-40 min-w-30 flex-col items-center rounded-sm border bg-content2 px-2.5 py-1.5 text-center leading-tight text-foreground transition-[opacity,border-color] duration-150 ${data.emphasis === 'dimmed' ? 'border-divider opacity-15' : data.emphasis === 'connected' ? 'border-primary opacity-100' : 'border-divider'}`}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
          >
            <span className="max-w-full truncate text-xs font-semibold" title={data.itemName}>
              {data.itemName}
            </span>
            <span className="mt-0.5 font-mono text-xs font-medium text-foreground/80 tabular-nums">
              {data.amountPerMinute.toFixed(1)}/min{data.isByproduct ? ' · co-product' : ''}
            </span>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
