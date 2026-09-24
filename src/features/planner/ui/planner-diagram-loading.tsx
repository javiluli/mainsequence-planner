import { ThinkingOrb } from 'thinking-orbs'

/** Loading feedback belongs to the active diagram, not its tabs or planner controls. */
export function PlannerDiagramLoading({ label }: { label: string }) {
  return (
    <div role="status" aria-label={`Loading ${label}`} aria-busy="true" className="grid h-full min-h-0 place-items-center">
      <ThinkingOrb state="solving" size={64} aria-hidden="true" />
    </div>
  )
}
