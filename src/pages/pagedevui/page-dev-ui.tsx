import { Flex, PageContainer, PageContent, PageHeader, Typography } from '@/shared/ui'

import {
  AccordionPlayground,
  AutocompletePlayground,
  ButtonPlayground,
  CardsPlayground,
  CheckboxPlayground,
  ChipPlayground,
  DropdownPlayground,
  InputPlayground,
  LinkPlayground,
  ModalPlayground,
  NumberInputPlayground,
  SelectsPlayground,
  TablePlayground,
  TabsPlayground,
  TooltipPlayground,
  TypographyPlayground,
} from './playground'

import { Theme, TreeListPlayground } from './playground/custom'

const playgrounds = [
  <Theme />,
  <TypographyPlayground />,
  <TreeListPlayground />,
  <AccordionPlayground />,
  <AutocompletePlayground />,
  <ButtonPlayground />,
  <CardsPlayground />,
  <CheckboxPlayground />,
  <ChipPlayground />,
  <DropdownPlayground />,
  <InputPlayground />,
  <LinkPlayground />,
  <ModalPlayground />,
  <NumberInputPlayground />,
  <SelectsPlayground />,
  <TablePlayground />,
  <TabsPlayground />,
  <TooltipPlayground />,
]

const PageDevUI = () => {
  return (
    <PageContainer className="mx-auto">
      <PageHeader>
        <Flex direction="col" align="center" gap="sm">
          <Typography as="h1" variant="h2">
            UI Playground
          </Typography>

          <Typography tone="soft">Dev-only page to preview typography, components, and theme cohesion.</Typography>
        </Flex>
      </PageHeader>

      <PageContent>
        <div className="columns-1 gap-4 pb-12 md:columns-2 lg:columns-3 xl:columns-4">
          {playgrounds.map((playground, index) => (
            <div key={index} className="mb-4 w-full break-inside-avoid">
              {playground}
            </div>
          ))}
        </div>
      </PageContent>
    </PageContainer>
  )
}

export default PageDevUI
