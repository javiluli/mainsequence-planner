import type { Building } from '@/shared/@types/building.type'
import { AssetImage, Flex, Typography } from '@/shared/ui'
import { handleSpotlightPointerMove } from '@/shared/ui/spotlight'
import { RecipeAccordionMeta } from './recipe-accordion-meta'

/** Preserves title typography while leaving the semantic heading to the owning Accordion. */
export const RecipeAccordionHeader = ({ building }: { building: Building }) => (
  <Flex gap="lg" className="min-w-0" onPointerMove={handleSpotlightPointerMove}>
    <AssetImage kind="buildings" id={building.id} width={96} alt="" />
    <div className="min-w-0 flex-1 space-y-2">
      <Typography as="span" variant="h3" className="block">
        {building.name}
      </Typography>
      <RecipeAccordionMeta building={building} />
    </div>
  </Flex>
)
