import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'

import { cn } from '@heroui/react'

type Gap = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'

type Columns = 1 | 2 | 3 | 4 | 5 | 6 | 12

type Rows = 1 | 2 | 3 | 4 | 5 | 6

type Flow = 'row' | 'col' | 'dense' | 'row-dense' | 'col-dense'

const gapClasses: Record<Gap, string> = {
  none: 'gap-0',
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-4',
  xl: 'gap-6',
}

const colClasses: Record<Columns, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
  6: 'grid-cols-6',
  12: 'grid-cols-12',
}

const rowClasses: Record<Rows, string> = {
  1: 'grid-rows-1',
  2: 'grid-rows-2',
  3: 'grid-rows-3',
  4: 'grid-rows-4',
  5: 'grid-rows-5',
  6: 'grid-rows-6',
}

const flowClasses: Record<Flow, string> = {
  row: 'grid-flow-row',
  col: 'grid-flow-col',
  dense: 'grid-flow-dense',
  'row-dense': 'grid-flow-row-dense',
  'col-dense': 'grid-flow-col-dense',
}

export type GridProps<T extends ElementType = 'div'> = {
  as?: T
  children?: ReactNode
  gap?: Gap
  columns?: Columns
  rows?: Rows
  flow?: Flow
  className?: string
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children' | 'className'>

export const Grid = <T extends ElementType = 'div'>({
  as,
  children,
  gap = 'sm',
  columns,
  rows,
  flow = 'row',
  className,
  ...props
}: GridProps<T>) => {
  const Component = as ?? 'div'

  return (
    <Component
      className={cn(
        'grid',
        gapClasses[gap],
        columns ? colClasses[columns] : null,
        rows ? rowClasses[rows] : null,
        flowClasses[flow],
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  )
}
