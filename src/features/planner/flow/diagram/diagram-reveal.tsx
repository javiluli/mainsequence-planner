import { PlannerDiagramLoading } from '@/features/planner/ui/planner-diagram-loading'
import { Suspense, memo, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ComponentType } from 'react'

/** A graph reports current measurements; other views are ready when their suspended content commits. */
export interface PlannerDiagramContentProps {
  onReady?: () => void
}

interface PlannerDiagramRevealProps {
  Content: ComponentType<PlannerDiagramContentProps>
  label: string
  showLoading?: boolean
  waitForReady?: boolean
  onPresented?: () => void
}

type RevealPhase = 'loading' | 'loading-exit' | 'content-enter' | 'ready'

const REDUCED_MOTION_QUERY = '(prefers-reduced-motion: reduce)'

/** Subscribes to live OS preference changes without retaining the initial media value. */
const subscribeToReducedMotion = (onChange: () => void) => {
  const media = globalThis.matchMedia(REDUCED_MOTION_QUERY)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}
const getReducedMotion = () => globalThis.matchMedia(REDUCED_MOTION_QUERY).matches

/** Records actual suspension while the visual loading layer remains outside the boundary. */
function PendingContent({ onSuspend }: { onSuspend: () => void }) {
  useLayoutEffect(onSuspend, [onSuspend])
  return null
}

/** Reports actual content readiness and shields costly diagrams from presentation-only phase renders. */
const DiagramContent = memo(function DiagramContent({
  Content,
  waitForReady,
  onReady,
}: Pick<PlannerDiagramRevealProps, 'Content' | 'waitForReady'> & { onReady: () => void }) {
  useLayoutEffect(() => {
    if (!waitForReady) onReady()
  }, [waitForReady, onReady])
  return <Content onReady={onReady} />
})

/**
 * Presents one result with the requested Orb/exit/entry sequence, keeping navigation outside it.
 * Callers key this component by result/view. Prepared views skip the loading hold. Only presentation uses a timer; graph readiness comes from measurements.
 */
export function PlannerDiagramReveal({ Content, label, showLoading = true, waitForReady = false, onPresented }: PlannerDiagramRevealProps) {
  const reduceMotion = useSyncExternalStore(subscribeToReducedMotion, getReducedMotion, () => false)
  const [phase, setPhase] = useState<RevealPhase>('loading')
  const [contentReady, setContentReady] = useState(false)
  // Capture the mode for this keyed result; marking it presented must not change its callback or replay the entrance.
  const loadingMode = useRef(showLoading)
  const loadingStartedAt = useRef(0)
  const suspended = useRef(false)
  const contentVisible = phase === 'content-enter' || phase === 'ready'

  useLayoutEffect(() => {
    loadingStartedAt.current = performance.now()
  }, [])
  const markSuspended = useCallback(() => {
    suspended.current = true
  }, [])
  const markReady = useCallback(() => {
    setContentReady(true)
    if (getReducedMotion()) setPhase('ready')
    else if (!loadingMode.current && !waitForReady && !suspended.current)
      setPhase((current) => (current === 'loading' ? 'content-enter' : current))
  }, [waitForReady])

  useEffect(() => {
    if (!contentReady || phase === 'ready') return
    const nextPhase = reduceMotion ? 'ready' : phase === 'loading' ? 'loading-exit' : phase === 'loading-exit' ? 'content-enter' : 'ready'
    const delay = reduceMotion
      ? 0
      : phase === 'loading'
        ? Math.max(0, 300 - (performance.now() - loadingStartedAt.current))
        : phase === 'loading-exit'
          ? 150
          : 220
    // One owned timer at a time; replacing a result or changing the media cancels the pending transition.
    const timer = globalThis.setTimeout(() => setPhase(nextPhase), delay)
    return () => globalThis.clearTimeout(timer)
  }, [contentReady, phase, reduceMotion])

  useEffect(() => {
    if (phase === 'ready') onPresented?.()
  }, [phase, onPresented])

  return (
    <div className="relative h-full min-h-0" data-testid="planner-diagram" data-reveal-phase={phase}>
      <div className="planner-diagram-content h-full min-h-0" data-phase={phase} aria-hidden={!contentVisible} inert={!contentVisible}>
        <Suspense fallback={<PendingContent onSuspend={markSuspended} />}>
          <DiagramContent Content={Content} waitForReady={waitForReady} onReady={markReady} />
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
