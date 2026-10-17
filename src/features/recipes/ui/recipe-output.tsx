import type { Item } from '@/shared/@types/item.type'
import type { Recipe } from '@/shared/@types/building.type'
import { AssetImage, Typography } from '@/shared/ui'
import { useOpenPlanner } from '@/features/planner'
import { Button } from '@heroui/react'

interface Props {
  recipe: Recipe
  outputItem?: Item
}

/** Shows the catalog's gross output and opens this exact recipe with Planner's net one-machine preset. */
export const RecipeOutput = ({ recipe, outputItem }: Props) => {
  const { output } = recipe
  const openPlanner = useOpenPlanner()

  return (
    <div className="flex min-w-30 flex-col items-center gap-2">
      <Typography as="span" variant="micro" tone="soft">
        Output
      </Typography>
      <AssetImage kind="items" id={output.id} width={64} alt="" />
      <Typography as="span" variant="label" className="text-center">
        {outputItem?.name ?? output.id}
      </Typography>
      <Typography as="span" variant="micro" tone="soft">
        {output.amount_per_minute}/min
      </Typography>
      {recipe.id && (
        <Button variant="flat" size="sm" color="primary" onPress={() => openPlanner(output.id, recipe.id)}>
          Plan this recipe
        </Button>
      )}
    </div>
  )
}
