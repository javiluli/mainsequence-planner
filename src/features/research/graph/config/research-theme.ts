import type { ResearchTechnology, ScienceTypeId } from '@/shared/@types/research.type'

export const RESEARCH_BRANCH_STYLES: Record<ScienceTypeId | 'general', { dot: string; node: string }> = {
  alien_technology: { dot: 'bg-violet-400', node: 'border-violet-400/45' },
  astronomy_science: { dot: 'bg-cyan-400', node: 'border-cyan-400/45' },
  computation_science: { dot: 'bg-blue-400', node: 'border-blue-400/45' },
  electromagnetic_science: { dot: 'bg-amber-400', node: 'border-amber-400/45' },
  material_science: { dot: 'bg-indigo-400', node: 'border-indigo-400/45' },
  quantum_science: { dot: 'bg-fuchsia-400', node: 'border-fuchsia-400/45' },
  xenobiology_science: { dot: 'bg-emerald-400', node: 'border-emerald-400/45' },
  general: { dot: 'bg-default-500', node: 'border-default-400/45' },
}

export const getTechnologyBranch = (technology: ResearchTechnology): ScienceTypeId | 'general' => technology.costs[0]?.type ?? 'general'
