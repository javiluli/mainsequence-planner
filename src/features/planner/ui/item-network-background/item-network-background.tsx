import { useId } from 'react'
import { usePlannerTarget } from '@/features/planner/hooks/use-planner-target'
import { useNetworkCanvas } from './hooks/use-network-canvas'
import { useNetworkInteraction } from './hooks/use-network-interaction'

export function ItemNetworkBackground() {
  const { containerRef, canvasRef, controllerRef } = useNetworkCanvas()
  const { selectTargetItem } = usePlannerTarget()
  const { activeName, canvasEvents } = useNetworkInteraction({ controllerRef, onSelect: selectTargetItem })
  const instructionsId = useId()
  const statusId = useId()

  return (
    <div ref={containerRef} className="planner-network absolute inset-0 z-0 overflow-hidden">
      <canvas
        ref={canvasRef}
        role="group"
        tabIndex={0}
        aria-label="Main Sequence item shortcuts"
        aria-describedby={`${instructionsId} ${statusId}`}
        className="block h-full w-full focus-visible:outline-1 focus-visible:-outline-offset-2 focus-visible:outline-primary"
        {...canvasEvents}
      />
      <p id={instructionsId} className="sr-only">
        Use the arrow keys to choose an item and Enter or Space to select it as your production target. The network is decorative, not a
        recipe map.
      </p>
      <p id={statusId} role="status" className="sr-only">
        {activeName}
      </p>
    </div>
  )
}
