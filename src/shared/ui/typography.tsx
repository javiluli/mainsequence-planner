import type { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react'

import { cn } from '@heroui/react'

const variantClasses = {
  display: 'text-[2.25rem] leading-tight font-semibold tracking-tight',
  h1: 'text-[1.875rem] leading-tight font-semibold tracking-tight',
  h2: 'text-[1.5rem] leading-snug font-semibold tracking-tight',
  h3: 'text-[1.25rem] leading-snug font-semibold',
  h4: 'text-base leading-snug font-semibold',
  body: 'text-[0.95rem] leading-relaxed font-normal',
  small: 'text-[0.85rem] leading-snug font-medium',
  micro: 'text-xs leading-tight font-semibold',
} as const

const toneClasses = {
  normal: 'text-foreground',
  muted: 'text-foreground/80',
  soft: 'text-foreground/60',
} as const

type TypographyVariant = keyof typeof variantClasses
type TypographyTone = keyof typeof toneClasses

type TypographyProps<T extends ElementType = 'p'> = {
  as?: T
  variant?: TypographyVariant
  tone?: TypographyTone
  children?: ReactNode
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children'>

export function Typography<T extends ElementType = 'p'>({
  as,
  variant = 'body',
  tone = 'normal',
  className,
  children,
  ...props
}: TypographyProps<T>) {
  const Component = as ?? 'p'

  return (
    <Component className={cn(variantClasses[variant], toneClasses[tone], className)} {...props}>
      {children}
    </Component>
  )
}
