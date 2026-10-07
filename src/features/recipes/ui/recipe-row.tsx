import { useOpenBases } from '@/features/planner'
import { ResearchRequirement } from '@/features/research'
import type { Recipe } from '@/shared/@types/building.type'
import type { Item } from '@/shared/@types/item.type'
import { AssetImage, Flex, Panel, Typography } from '@/shared/ui'
import { Button } from '@heroui/react'
import { ChevronLeft } from 'lucide-react'
import { memo } from 'react'
import { RecipeInputs } from './recipe-inputs'
import { RecipeOutput } from './recipe-output'

interface Props {
  recipe: Recipe
  outputItem?: Item
  itemMap: ReadonlyMap<string, Item>
}

const RecipeRowComponent = ({ recipe, outputItem, itemMap }: Props) => {
  const openBases = useOpenBases()

  return (
    <Panel variant="subtle" padding="none" className="min-w-0">
      <Flex direction="col" align="stretch" gap="md" className="p-4 lg:flex-row lg:items-center lg:gap-4">
        <RecipeOutput output={recipe.output} outputItem={outputItem} />
        <ChevronLeft aria-hidden size={24} className="mx-auto shrink-0 rotate-90 text-foreground/70 lg:mx-0 lg:rotate-0" />
        <RecipeInputs inputs={recipe.inputs} itemMap={itemMap} />
      </Flex>
      {Boolean(recipe.extra_outputs?.length) && (
        <div className="border-t border-divider/60 px-4 py-3">
          <Typography as="span" variant="micro" tone="soft">
            Also produces
          </Typography>
          <div className="mt-2 flex flex-wrap gap-3">
            {recipe.extra_outputs?.map((output) => (
              <div key={output.id} className="flex items-center gap-2 text-sm">
                <AssetImage kind="items" id={output.id} width={32} alt="" />
                <span>{itemMap.get(output.id)?.name ?? output.id}</span>
                <span className="text-foreground/65">{output.amount_per_minute}/min</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex justify-end border-t border-divider/60 px-4 py-2">
        <Button
          size="sm"
          variant="flat"
          title="Compare this output item using the Planner's selected recipe"
          onPress={() => openBases(recipe.output.id)}
        >
          Compare output in Bases
        </Button>
      </div>
      <ResearchRequirement recipeId={recipe.id} />
    </Panel>
  )
}

export const RecipeRow = memo(RecipeRowComponent)
