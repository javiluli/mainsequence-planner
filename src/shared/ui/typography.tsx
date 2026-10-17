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
  label: 'text-sm leading-5 font-semibold',
  caption: 'text-xs leading-4 font-normal',
  total: 'text-lg leading-7 font-semibold',
} as const

const toneClasses = {
  normal: 'text-foreground',
  muted: 'text-foreground/80',
  soft: 'text-foreground/60',
} as const

type TypographyVariant = keyof typeof variantClasses
type TypographyTone = keyof typeof toneClasses

/** Native element props plus independent visual roles; layout and domain-specific overrides stay with the caller. */
type TypographyProps<T extends ElementType = 'p'> = {
  /** Semantic element, independent of appearance; defaults to a paragraph. */
  as?: T
  /** Visual hierarchy; label emphasizes names, caption carries supporting text, total emphasizes aggregate quantities. */
  variant?: TypographyVariant
  tone?: TypographyTone
  children?: ReactNode
} & Omit<ComponentPropsWithoutRef<T>, 'as' | 'children'>

/**
 * Renders shared type roles without inferring HTML semantics from their appearance.
 * Defaults to p/body/normal; native attributes are forwarded and className takes precedence
 * for composition, truncation, domain colors or deliberate local exceptions.
 */
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
