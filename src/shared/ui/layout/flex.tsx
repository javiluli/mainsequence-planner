import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'

import { cn } from '@heroui/react'

type Gap = 'none' | 'xs' | 'sm' | 'md' | 'lg' | 'xl'
type Align = 'start' | 'center' | 'end' | 'stretch' | 'baseline'
type Justify = 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly'
type Direction = 'row' | 'row-reverse' | 'col' | 'col-reverse'
type Wrap = 'nowrap' | 'wrap' | 'wrap-reverse'

const gapClasses: Record<Gap, string> = {
  none: 'gap-0',
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-4',
  xl: 'gap-6',
}

const alignClasses: Record<Align, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  stretch: 'items-stretch',
  baseline: 'items-baseline',
}

const justifyClasses: Record<Justify, string> = {
  start: 'justify-start',
  center: 'justify-center',
  end: 'justify-end',
  between: 'justify-between',
  around: 'justify-around',
  evenly: 'justify-evenly',
}

const directionClasses: Record<Direction, string> = {
  row: 'flex-row',
  'row-reverse': 'flex-row-reverse',
  col: 'flex-col',
  'col-reverse': 'flex-col-reverse',
}

const wrapClasses: Record<Wrap, string> = {
  nowrap: 'flex-nowrap',
  wrap: 'flex-wrap',
  'wrap-reverse': 'flex-wrap-reverse',
}

export type FlexProps<T extends ElementType = 'div'> = {
  as?: T
  children?: ReactNode
  gap?: Gap
  align?: Align
  justify?: Justify
  direction?: Direction
  wrap?: Wrap
  className?: string
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children' | 'className'>

export const Flex = <T extends ElementType = 'div'>({
  as,
  children,
  gap = 'sm',
  align = 'center',
  justify = 'start',
  direction = 'row',
  wrap = 'nowrap',
  className,
  ...props
}: FlexProps<T>) => {
  const Component = as ?? 'div'

  return (
    <Component
      className={cn(
        'flex',
        gapClasses[gap],
        alignClasses[align],
        justifyClasses[justify],
        directionClasses[direction],
        wrapClasses[wrap],
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  )
}
