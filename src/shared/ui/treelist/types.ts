import type { ReactNode } from 'react'

/** Shared connector geometry; incoming lines and child continuations must use the same horizontal anchor. */
export interface TreeListLineConfig {
  indentWidthClass: string
  /** Horizontal anchor within a node; the same coordinate aligns its incoming and outgoing branches. */
  lineXClass: string
  lineYClass: string
  lineColorClass: string
}

/** Branch state passed to domain renderers; toggle affects only this tree occurrence. */
export interface TreeListNodeRenderProps<TNode> {
  node: TNode
  path: string
  depth: number
  isLast: boolean
  hasChildren: boolean
  isExpanded: boolean
  toggle: () => void
}

/** Generic tree composition; custom IDs must distinguish occurrences when a domain node appears twice. */
export interface TreeListProps<TNode> {
  data: TNode[]
  getNodeId?: (node: TNode, path: string) => string
  getChildren?: (node: TNode) => TNode[] | undefined
  defaultExpanded?: boolean
  className?: string
  lineConfig?: Partial<TreeListLineConfig>
  children: (props: TreeListNodeRenderProps<TNode>) => ReactNode
}

export interface TreeListNodeProps {
  hasChildren: boolean
  isExpanded: boolean
  toggle: () => void
  className?: string
  interactiveClassName?: string
  disabledClassName?: string
  children: ReactNode
}
