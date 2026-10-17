import type { ResearchTechnology, ScienceTypeId } from '@/shared/@types/research.type'
import type { Node } from '@xyflow/react'

/** General contains technologies without science costs; all bypasses branch filtering. */
export type ResearchBranchFilter = ScienceTypeId | 'all' | 'general'

/** Technology plus view-only context flags; these never represent player unlock progress. */
export interface ResearchNodeData extends Record<string, unknown> {
  technology: ResearchTechnology
  contextual: boolean
  dimmed: boolean
  independent: boolean
}

export type ResearchFlowNode = Node<ResearchNodeData, 'researchTechnology'>
