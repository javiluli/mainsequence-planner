import { useProductionPlan } from '@/features/planner/hooks/use-production-plan'
import { getRecipeChoicesForItem } from '@/features/planner/lib/recipe-options'
import { ResearchRequirement } from '@/features/research'
import { buildings, itemNameById } from '@/shared/data'
import { AssetImage, Typography } from '@/shared/ui'
import { plannerSelectors, usePlannerStore } from '@/store/planner.store'
import { Card, CardBody, CardHeader, Chip } from '@heroui/react'

/** Recipe selection follows actual IDs and remains independent from image filenames or machine ordering. */
export const RecipeOptionsPanel = () => {
  const plan = useProductionPlan()
  const savedRecipes = usePlannerStore(plannerSelectors.recipeIdByItemId)
  const setRecipeForItem = usePlannerStore(plannerSelectors.setRecipeForItem)
  const choicesByStep = (plan?.steps ?? [])
    .map((step) => ({ step, choices: getRecipeChoicesForItem(buildings, step.itemId) }))
    .filter(({ choices }) => choices.length > 1)

  if (!choicesByStep.length) {
    return (
      <div className="p-5 text-center">
        <Typography tone="soft">Select a target with alternative recipes to choose a production route.</Typography>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto px-3 py-3">
      <div className="space-y-3">
        {choicesByStep.map(({ step, choices }) => {
          const saved = savedRecipes[step.itemId]
          const selected = choices.some((choice) => choice.id === saved) ? saved : ''
          const inputId = 'recipe-' + step.itemId
          const displayedRecipeId = selected || choices[0].id

          return (
            <Card key={step.itemId} className="border border-default-200">
              <CardHeader className="flex items-center gap-2 p-3 pb-1">
                <AssetImage kind="items" id={step.itemId} width={32} alt="" />
                <Typography variant="small" className="min-w-0 flex-1">
                  {itemNameById.get(step.itemId) ?? step.itemId}
                </Typography>
                <Chip size="sm" variant="flat" color="primary">
                  {step.targetIpm.toFixed(2)}/min
                </Chip>
              </CardHeader>
              <CardBody className="gap-2 p-3 pt-1">
                <label htmlFor={inputId} className="text-xs text-default-500">
                  Production recipe
                </label>
                <select
                  id={inputId}
                  className="min-h-10 w-full rounded-lg border border-default-300 bg-content2 px-2 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                  value={selected}
                  onChange={(event) => setRecipeForItem(step.itemId, event.target.value)}
                >
                  <option value="">Default: {choices[0].id.replaceAll('_', ' ')}</option>
                  {choices.map((choice) => (
                    <option key={choice.id} value={choice.id}>
                      {choice.id.replaceAll('_', ' ')} · {choice.buildingName} · {choice.outputPerMinute}/min
                    </option>
                  ))}
                </select>
                <ResearchRequirement recipeId={displayedRecipeId} compact />
              </CardBody>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
