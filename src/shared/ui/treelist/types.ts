import type { ReactNode } from 'react'

export interface TreeListLineConfig {
  indentWidthClass: string
  lineXClass: string
  lineYClass: string
  lineGapClass: string
  lineColorClass: string
  capExtensionPx: number
}

export interface TreeListNodeRenderProps<TNode> {
  node: TNode
  path: string
  depth: number
  isLast: boolean
  hasChildren: boolean
  isExpanded: boolean
  toggle: () => void
}

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
