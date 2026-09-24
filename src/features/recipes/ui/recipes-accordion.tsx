import { Accordion, AccordionItemContent } from '@/shared/ui'
import { accordionSpotlightItemStyles } from '@/shared/ui/accordion/accordion-spotlight'
import { AccordionItem } from '@heroui/react'
import { useRecipesAccordionData } from '../hooks/use-recipes-accordion-data'
import { RecipeRow } from './recipe-row'
import { RecipeAccordionHeader } from './recipe-accordion-header'

export const RecipesAccordion = () => {
  const { buildingsWithRecipes, itemMap } = useRecipesAccordionData()

  return (
    <Accordion>
      {buildingsWithRecipes.map((building) => (
        <AccordionItem
          key={building.id}
          aria-label={building.name}
          classNames={accordionSpotlightItemStyles}
          title={<RecipeAccordionHeader building={building} />}
        >
          <AccordionItemContent>
            <div className="grid gap-4 xl:grid-cols-2">
              {building.recipes.map((recipe, index) => (
                <RecipeRow key={`${building.id}-${index}`} recipe={recipe} outputItem={itemMap.get(recipe.output.id)} itemMap={itemMap} />
              ))}
            </div>
          </AccordionItemContent>
        </AccordionItem>
      ))}
    </Accordion>
  )
}
