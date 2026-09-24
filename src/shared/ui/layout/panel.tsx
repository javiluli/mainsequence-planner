import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'

import { cn } from '@heroui/react'

export type PanelPadding = 'none' | 'sm' | 'md' | 'lg'

export type PanelProps<T extends ElementType = 'div'> = {
  as?: T
  children?: ReactNode
  variant?: PanelVariant
  padding?: PanelPadding
  className?: string
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children' | 'className'>

const paddingClasses: Record<PanelPadding, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
}

const panelVariantClasses = {
  plain: '',
  default: 'rounded-md border border-divider/70 bg-content1',
  muted: 'rounded-md border border-divider/70 bg-content1/20',
  subtle: 'rounded-sm border border-divider/65 bg-content1/55',
} as const

export type PanelVariant = keyof typeof panelVariantClasses

export const Panel = <T extends ElementType = 'div'>({
  as,
  children,
  className,
  variant = 'default',
  padding = 'md',
  ...props
}: PanelProps<T>) => {
  const Component = as ?? 'div'

  return (
    <Component className={cn(panelVariantClasses[variant], paddingClasses[padding], className)} {...props}>
      {children}
    </Component>
  )
}
