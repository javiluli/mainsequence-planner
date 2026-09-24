import { usePlannerResultReveal } from '@/features/planner/hooks/use-planner-result-reveal'
import { PlannerDiagramLoading } from '@/features/planner/ui/planner-diagram-loading'
import { useReducedMotion } from 'framer-motion'
import { Suspense, useCallback, useEffect, useState, type ComponentType } from 'react'

interface PlannerDiagramRevealProps {
  Content: ComponentType
  label: string
  skipLoading?: boolean
  onRevealReady?: () => void
}

const DiagramContent = ({ Content, onReady }: { Content: ComponentType; onReady: () => void }) => {
  useEffect(() => onReady(), [onReady])
  return <Content />
}

function FadeOnlyDiagram({ Content, label }: Pick<PlannerDiagramRevealProps, 'Content' | 'label'>) {
  const phase = useReducedMotion() ? 'ready' : 'content-enter'

  return (
    <div className="relative h-full min-h-0" data-testid="planner-diagram" data-reveal-phase={phase}>
      <Suspense fallback={<PlannerDiagramLoading label={label} />}>
        <div className="planner-diagram-content h-full min-h-0" data-phase={phase}>
          <Content />
        </div>
      </Suspense>
    </div>
  )
}

function StagedDiagram({ Content, label, onRevealReady }: PlannerDiagramRevealProps) {
  const [contentReady, setContentReady] = useState(false)
  const markContentReady = useCallback(() => setContentReady(true), [])
  const phase = usePlannerResultReveal(contentReady, useReducedMotion() ?? false)
  const contentVisible = phase === 'content-enter' || phase === 'ready'

  useEffect(() => {
    if (phase === 'ready') onRevealReady?.()
  }, [onRevealReady, phase])

  return (
    <div className="relative h-full min-h-0" data-testid="planner-diagram" data-reveal-phase={phase}>
      <div className="planner-diagram-content h-full min-h-0" data-phase={phase} aria-hidden={!contentVisible} inert={!contentVisible}>
        <Suspense fallback={null}>
          <DiagramContent Content={Content} onReady={markContentReady} />
        </Suspense>
      </div>
      {!contentVisible && (
        <div className="planner-diagram-loading pointer-events-none absolute inset-0" data-phase={phase}>
          <PlannerDiagramLoading label={label} />
        </div>
      )}
    </div>
  )
}

/** The first view of a plan is staged; prepared tabs fade in without a loading delay. */
export function PlannerDiagramReveal({ skipLoading = false, ...props }: PlannerDiagramRevealProps) {
  // A readiness update must not interrupt the initial staged reveal mid-transition.
  const [fadeOnly] = useState(skipLoading)
  return fadeOnly ? <FadeOnlyDiagram Content={props.Content} label={props.label} /> : <StagedDiagram {...props} />
}
