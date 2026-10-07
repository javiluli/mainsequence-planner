import { Accordion, AccordionItem } from '@heroui/react'
import { ComponentPlayground, PlaygroundPreview } from '../components'
import { Flex, Typography } from '@/shared/ui'

const variants = ['bordered', 'light', 'shadow', 'splitted'] as const
const defaultContent =
  'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.'

export const AccordionPlayground = () => (
  <ComponentPlayground id="accordion" title="Accordion">
    <PlaygroundPreview>
      <Flex direction="col" gap="xl" className="flex-1">
        {variants.map((variant) => (
          <Flex direction="col" align="start" className="w-full" gap="md">
            <Typography variant="h4">{variant}</Typography>
            <Accordion variant={variant}>
              <AccordionItem key="1" aria-label="Accordion 1" title="Accordion 1">
                {defaultContent}
              </AccordionItem>
              <AccordionItem key="2" aria-label="Accordion 2" title="Accordion 2">
                {defaultContent}
              </AccordionItem>
            </Accordion>
          </Flex>
        ))}
      </Flex>
    </PlaygroundPreview>
  </ComponentPlayground>
)
