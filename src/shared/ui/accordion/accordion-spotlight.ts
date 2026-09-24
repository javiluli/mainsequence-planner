import type { PointerEvent } from 'react'
import { accordionItemStyles } from './accordion-item.styles'
import './accordion-spotlight.css'

export const accordionSpotlightItemStyles = {
  ...accordionItemStyles,
  trigger: `${accordionItemStyles?.trigger ?? ''} accordion-spotlight-trigger`,
}

export const handleAccordionSpotlightPointerMove = (event: PointerEvent<HTMLDivElement>) => {
  if (event.pointerType !== 'mouse') return

  const trigger = event.currentTarget.closest<HTMLButtonElement>('.accordion-spotlight-trigger')
  if (!trigger) return

  const { left, top } = trigger.getBoundingClientRect()
  trigger.style.setProperty('--spotlight-x', `${event.clientX - left}px`)
  trigger.style.setProperty('--spotlight-y', `${event.clientY - top}px`)
}
