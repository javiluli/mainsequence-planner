import { useProductionPlan } from '@/features/planner/hooks/use-production-plan'
import { getRecipeChoicesForItem, type RecipeChoice } from '@/features/planner/lib/recipe-options'
import { buildings, itemNameById } from '@/shared/data'
import { AssetImage, Typography } from '@/shared/ui'
import { plannerSelectors, usePlannerStore } from '@/store/planner.store'
import { Button, Card, CardBody, Chip, Popover, PopoverContent, PopoverTrigger, Radio, RadioGroup } from '@heroui/react'
import { ChevronDown } from 'lucide-react'
import { useMemo } from 'react'

const getInputName = (id: string) => itemNameById.get(id) ?? id

/** Machine names can repeat across routes, so the input summary distinguishes each choice. */
const getRouteName = (choice: RecipeChoice) => {
  const inputNames = choice.inputs.map((input) => getInputName(input.id))
  if (!inputNames.length) return choice.id.replaceAll('_', ' ')
  return inputNames.length <= 2 ? inputNames.join(' + ') : `${inputNames.slice(0, 2).join(' + ')} +${inputNames.length - 2}`
}

export const RecipeOptionsPopover = () => {
  const plan = useProductionPlan()
  const savedRecipes = usePlannerStore(plannerSelectors.recipeIdByItemId)
  const setRecipeForItem = usePlannerStore(plannerSelectors.setRecipeForItem)

  const choicesByStep = useMemo(
    () =>
      (plan?.steps ?? [])
        .map((step) => ({ step, choices: getRecipeChoicesForItem(buildings, step.itemId) }))
        .filter(({ choices }) => choices.length > 1),
    [plan?.steps],
  )
  const activeCount = choicesByStep.filter(({ step, choices }) =>
    choices.some((choice, index) => index > 0 && choice.id === savedRecipes[step.itemId]),
  ).length

  return (
    <Popover placement="bottom-end">
      <PopoverTrigger>
        <Button
          size="sm"
          variant="light"
          isDisabled={!choicesByStep.length}
          aria-label={`Recipes: ${activeCount} of ${choicesByStep.length} alternative routes active`}
        >
          <span>Recipes</span>
          <Chip size="sm" variant="flat" color={activeCount ? 'primary' : 'default'} className="h-5 min-w-5 px-1 text-[11px] tabular-nums">
            {activeCount}/{choicesByStep.length}
          </Chip>
          <ChevronDown size={16} aria-hidden />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-[min(32rem,calc(100vw-2rem))] p-0">
        <div className="max-h-[70vh] w-full overflow-y-auto p-2.5">
          <div className="mb-2 px-0.5">
            <Typography className="font-semibold">Recipe selection</Typography>

            <Typography variant="small" tone="soft">
              Choose the production route used for each item.
            </Typography>
          </div>

          <div className="flex flex-col gap-1.5">
            {choicesByStep.map(({ step, choices }) => {
              const savedRecipeId = savedRecipes[step.itemId]
              const defaultRecipeId = choices[0].id

              const selectedRecipeId =
                savedRecipeId && choices.some((choice) => choice.id === savedRecipeId) ? savedRecipeId : defaultRecipeId

              const itemName = itemNameById.get(step.itemId) ?? step.itemId

              return (
                <Card key={step.itemId} as="section" shadow="none" radius="sm" className="border border-divider/70 bg-content1">
                  <CardBody className="min-w-0 gap-1.5 p-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <AssetImage kind="items" id={step.itemId} width={24} alt="" />

                      <Typography variant="small" className="min-w-0 flex-1 truncate font-semibold">
                        {itemName}
                      </Typography>

                      <Chip
                        size="sm"
                        variant="flat"
                        color="primary"
                        className="h-5 shrink-0 text-[11px] tabular-nums"
                        aria-label={`Plan target ${step.targetIpm.toFixed(2)} items per minute`}
                      >
                        {step.targetIpm.toFixed(2)}/min
                      </Chip>
                    </div>

                    <RadioGroup
                      aria-label={`Recipe for ${itemName}`}
                      value={selectedRecipeId}
                      onValueChange={(recipeId) => {
                        // The default is derived from catalog order, so only explicit alternatives are persisted.
                        setRecipeForItem(step.itemId, recipeId === defaultRecipeId ? '' : recipeId)
                      }}
                      size="sm"
                      color="primary"
                      classNames={{
                        wrapper: 'grid grid-cols-2 gap-1',
                      }}
                    >
                      {choices.map((choice) => {
                        const routeName = getRouteName(choice)

                        return (
                          <Radio
                            key={choice.id}
                            value={choice.id}
                            aria-label={`${choice.buildingName}, ${routeName}, ${choice.outputPerMinute} per minute`}
                            classNames={{
                              base: [
                                'm-0 min-h-9 min-w-0 max-w-none',
                                'rounded-sm border border-transparent',
                                'px-1 py-1',
                                'transition-colors',
                                'hover:bg-content2',
                                'data-[selected=true]:border-primary/40',
                                'data-[selected=true]:bg-primary/15',
                                'focus-within:ring-2',
                                'focus-within:ring-primary/40',
                              ].join(' '),

                              wrapper: 'hidden',

                              labelWrapper: 'min-w-0 flex-1',

                              label: 'min-w-0',
                            }}
                          >
                            <span className="flex min-w-0 items-center gap-1.5">
                              <AssetImage kind="buildings" id={choice.buildingId} width={26} alt="" />

                              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                                <span className="truncate text-xs font-medium" title={choice.buildingName}>
                                  {choice.buildingName}
                                </span>

                                <span
                                  className="truncate text-[11px] text-foreground/70"
                                  title={`${routeName} · ${choice.outputPerMinute}/min`}
                                >
                                  {routeName}
                                </span>
                              </span>
                            </span>
                          </Radio>
                        )
                      })}
                    </RadioGroup>
                  </CardBody>
                </Card>
              )
            })}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
