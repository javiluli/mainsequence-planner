import { useProductionPlan } from '@/features/planner/hooks/use-production-plan'
import { getPlanRecipeGroups, type RecipeChoice } from '@/features/planner/lib/recipe-options'
import { buildings, itemById, itemNameById } from '@/shared/data'
import { AssetImage, Typography } from '@/shared/ui'
import { plannerSelectors, usePlannerStore } from '@/store/planner.store'
import { button, Button, Card, CardBody, Chip, Popover, PopoverContent, PopoverTrigger, Radio, RadioGroup } from '@heroui/react'
import { ArrowDownToLine, ChevronDown } from 'lucide-react'
import { useMemo } from 'react'

const getInputName = (id: string) => itemNameById.get(id) ?? id

/** Machine names can repeat across routes, so the input summary distinguishes each choice. */
const getRouteName = (choice: RecipeChoice) => {
  const inputNames = choice.inputs.map((input) => getInputName(input.id))
  if (!inputNames.length) return choice.id.replaceAll('_', ' ')
  return inputNames.length <= 2 ? inputNames.join(' + ') : `${inputNames.slice(0, 2).join(' + ')} +${inputNames.length - 2}`
}

/** Keeps raw inputs external by default and exposes only real synthesis routes in the existing native radio cards. */
export const RecipeOptionsPopover = () => {
  const plan = useProductionPlan()
  const savedRecipes = usePlannerStore(plannerSelectors.recipeIdByItemId)
  const setRecipeForItem = usePlannerStore(plannerSelectors.setRecipeForItem)

  const groups = useMemo(() => (plan ? getPlanRecipeGroups(plan, buildings, itemById) : []), [plan])
  const activeCount = groups.filter(({ itemId, choices }) =>
    choices.some((choice, index) => index > 0 && choice.id === savedRecipes[itemId]),
  ).length

  return (
    <Popover placement="bottom-end">
      <PopoverTrigger>
        <Button
          size="sm"
          variant="flat"
          isDisabled={!groups.length}
          aria-label={`Recipes: ${activeCount} of ${groups.length} alternative routes active`}
        >
          <span>Recipes</span>
          <Chip size="sm" variant="flat" color={activeCount ? 'primary' : 'default'} className="tabular-nums">
            {activeCount}/{groups.length}
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
            {groups.map(({ itemId, targetIpm, choices }) => {
              const savedRecipeId = savedRecipes[itemId]
              const defaultRecipeId = choices[0].id

              const selectedRecipeId =
                savedRecipeId && choices.some((choice) => choice.id === savedRecipeId) ? savedRecipeId : defaultRecipeId

              const itemName = itemNameById.get(itemId) ?? itemId

              return (
                <Card key={itemId} as="section" shadow="sm" radius="sm">
                  <CardBody className="min-w-0 gap-1.5 p-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                      <AssetImage kind="items" id={itemId} width={24} alt="" />

                      <Typography variant="label" className="min-w-0 flex-1 truncate">
                        {itemName}
                      </Typography>

                      {targetIpm !== undefined && (
                        <Chip
                          size="sm"
                          variant="flat"
                          color="primary"
                          className="shrink-0 tabular-nums"
                          aria-label={`Plan target ${targetIpm.toFixed(2)} items per minute`}
                        >
                          {targetIpm.toFixed(2)}/min
                        </Chip>
                      )}
                    </div>

                    <RadioGroup
                      aria-label={`Recipe for ${itemName}`}
                      value={selectedRecipeId}
                      onValueChange={(recipeId) => {
                        // Empty ID restores external raw input; ordinary defaults remain derived from the catalog.
                        setRecipeForItem(itemId, recipeId === defaultRecipeId ? '' : recipeId)
                      }}
                      size="sm"
                      color="primary"
                      classNames={{
                        wrapper: 'grid grid-cols-2 gap-1',
                      }}
                    >
                      {choices.map((choice) => {
                        const routeName = choice.kind === 'external' ? 'No synthesis' : getRouteName(choice)
                        const routeLabel = choice.kind === 'external' ? 'External input' : choice.buildingName

                        return (
                          <Radio
                            key={choice.id}
                            value={choice.id}
                            aria-label={
                              choice.kind === 'external'
                                ? 'External input for ' + itemName
                                : `${routeLabel}, ${routeName}, ${choice.outputPerMinute} per minute`
                            }
                            classNames={{
                              // Use the native button theme for the surface; the underlying control stays a radio.
                              base: button({
                                variant: 'flat',
                                color: choice.id === selectedRecipeId ? 'primary' : 'default',
                                size: 'sm',
                                radius: 'sm',
                                fullWidth: true,
                                disableAnimation: false,
                                class: 'm-0 h-auto min-h-11 min-w-0 max-w-none justify-start px-2 py-1.5',
                              }),
                              wrapper: 'hidden',
                              labelWrapper: 'm-0 min-w-0 flex-1',
                              label: 'min-w-0 text-inherit',
                            }}
                          >
                            <span className="flex min-w-0 items-center gap-1.5">
                              {choice.kind === 'external' ? (
                                <ArrowDownToLine size={26} aria-hidden />
                              ) : (
                                <AssetImage kind="buildings" id={choice.buildingId} width={26} alt="" />
                              )}

                              <span className="flex min-w-0 flex-1 flex-col leading-tight">
                                <span className="truncate text-xs font-medium" title={routeLabel}>
                                  {routeLabel}
                                </span>

                                <span
                                  className="truncate text-[11px] text-foreground/70"
                                  title={choice.kind === 'external' ? routeName : `${routeName} · ${choice.outputPerMinute}/min`}
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
