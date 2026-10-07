import { cn } from '@heroui/react'
import { memo } from 'react'
import type { TreeListNodeProps } from './types'

const ROW_BASE = 'flex min-w-0 w-full flex-1 items-center rounded-lg text-left transition-colors motion-reduce:transition-none'

const TreeListNodeRaw = ({
  hasChildren,
  isExpanded,
  toggle,
  className,
  interactiveClassName = 'cursor-pointer',
  disabledClassName = 'cursor-default',
  children,
}: TreeListNodeProps) => {
  const resolvedClassName = cn(ROW_BASE, hasChildren ? interactiveClassName : disabledClassName, className)

  if (!hasChildren) return <div className={resolvedClassName}>{children}</div>

  return (
    <button
      type="button"
      aria-expanded={isExpanded}
      onClick={toggle}
      className={cn(
        resolvedClassName,
        'outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:-outline-offset-2 focus-visible:outline-focus',
      )}
    >
      {children}
    </button>
  )
}

export const TreeListNode = memo(TreeListNodeRaw)
