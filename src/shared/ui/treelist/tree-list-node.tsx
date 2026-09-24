import { memo } from 'react'
import type { TreeListNodeProps } from './types'

const ROW_BASE = 'flex w-full flex-1 items-center rounded-lg text-left transition-colors'

const TreeListNodeRaw = ({
  hasChildren,
  isExpanded,
  toggle,
  className,
  interactiveClassName = 'cursor-pointer',
  disabledClassName = 'cursor-default',
  children,
}: TreeListNodeProps) => {
  const resolvedClassName = `${ROW_BASE} ${hasChildren ? interactiveClassName : disabledClassName} ${className ?? ''}`

  if (!hasChildren) return <div className={resolvedClassName}>{children}</div>

  return (
    <button type="button" aria-expanded={isExpanded} onClick={toggle} className={resolvedClassName}>
      {children}
    </button>
  )
}

export const TreeListNode = memo(TreeListNodeRaw)
