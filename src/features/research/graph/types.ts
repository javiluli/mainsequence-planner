import type { ResearchTechnology, ScienceTypeId } from '@/shared/@types/research.type'
import type { Node } from '@xyflow/react'

export type ResearchBranchFilter = ScienceTypeId | 'all' | 'general'

export interface ResearchNodeData extends Record<string, unknown> {
  technology: ResearchTechnology
  contextual: boolean
  dimmed: boolean
  independent: boolean
}

export type ResearchFlowNode = Node<ResearchNodeData, 'researchTechnology'>
