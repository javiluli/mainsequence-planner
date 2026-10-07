import type { Building } from '@/shared/@types/building.type'
import { AssetImage, Flex, Typography } from '@/shared/ui'
import { handleAccordionSpotlightPointerMove } from '@/shared/ui/accordion/accordion-spotlight'
import { RecipeAccordionMeta } from './recipe-accordion-meta'

export const RecipeAccordionHeader = ({ building }: { building: Building }) => (
  <Flex gap="lg" className="min-w-0" onPointerMove={handleAccordionSpotlightPointerMove}>
    <AssetImage kind="buildings" id={building.id} width={96} alt="" />
    <div className="min-w-0 flex-1 space-y-2">
      <Typography as="h3" variant="h3">
        {building.name}
      </Typography>
      <RecipeAccordionMeta building={building} />
    </div>
  </Flex>
)
