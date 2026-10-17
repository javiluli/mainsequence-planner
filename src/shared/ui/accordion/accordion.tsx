import { Accordion as AccordionHeroUI, type AccordionProps } from '@heroui/react'

export const Accordion = ({ className, ...props }: AccordionProps) => {
  return <AccordionHeroUI {...props} variant="light" selectionMode="multiple" className={`gap-4 ${className ?? ''}`} />
}
