import { ThinkingOrb } from 'thinking-orbs'

/** Animated feedback for the active result; reveal owns its lifetime, and the installed Orb respects reduced motion. */
export function PlannerDiagramLoading({ label }: { label: string }) {
  return (
    <div role="status" aria-label={`Loading ${label}`} aria-busy="true" className="grid h-full min-h-0 place-items-center">
      <ThinkingOrb state="solving" size={64} aria-hidden="true" />
    </div>
  )
}
