import type { Item } from '@/shared/@types/item.type'
import type { Recipe } from '@/shared/@types/building.type'
import { AssetImage, Typography } from '@/shared/ui'
import { useOpenPlanner } from '@/features/planner'
import { Button } from '@heroui/react'

interface Props {
  output: Recipe['output']
  outputItem?: Item
}

export const RecipeOutput = ({ output, outputItem }: Props) => {
  const openPlanner = useOpenPlanner()

  return (
    <div className="flex min-w-30 flex-col items-center gap-2">
      <Typography as="span" variant="micro" tone="soft">
        Output
      </Typography>
      <AssetImage kind="items" id={output.id} width={64} alt="" />
      <Typography as="span" variant="small" tone="normal" className="font-semibold text-center">
        {outputItem?.name ?? output.id}
      </Typography>
      <Typography as="span" variant="micro" tone="soft">
        {output.amount_per_minute}/min
      </Typography>
      {outputItem?.type !== 'raw' && (
        <Button variant="flat" size="sm" onPress={() => openPlanner(output.id)}>
          Open on planner
        </Button>
      )}
    </div>
  )
}
