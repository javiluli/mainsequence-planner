import type { AccordionItemProps } from '@heroui/react'

export const accordionItemStyles: AccordionItemProps['classNames'] = {
  base: 'deferred-render',
  trigger: 'min-w-0 px-2 pr-10 hover:bg-content1/30 sm:px-4 sm:pr-12',
  content: 'min-w-0 px-2 pb-4 sm:px-4',
  indicator: 'text-foreground/60 text-2xl',
}
