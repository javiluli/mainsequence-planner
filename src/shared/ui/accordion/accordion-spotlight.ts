import { accordionItemStyles } from './accordion-item.styles'
import './accordion-spotlight.css'

/** Adds the shared decorative border while keeping Accordion-specific slots and corners. */
export const accordionSpotlightItemStyles = {
  ...accordionItemStyles,
  trigger: `${accordionItemStyles?.trigger ?? ''} accordion-spotlight-trigger spotlight-surface`,
}
