import type { AccordionItemProps } from '@heroui/react'

/** Shared accordion layout and row hover; native focus and expansion remain owned by HeroUI. */
export const accordionItemStyles: AccordionItemProps['classNames'] = {
  base: 'deferred-render',
  // Override the native transition slot, including reduced motion, so background hover also fades on exit.
  trigger: 'surface-hover min-w-0 px-2 pr-10 transition-colors motion-reduce:transition-none sm:px-4 sm:pr-12',
  content: 'min-w-0 px-2 pb-4 sm:px-4',
  indicator: 'text-foreground/60 text-2xl',
}
