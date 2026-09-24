import { getRecipeYield } from '@/features/planner/lib/production-plan/recipe-yields'
import { buildPlanResolver } from '@/features/planner/lib/production-plan/plan-resolver'
import { useProductionPlan } from '@/features/planner/hooks/use-production-plan'
import { buildings, byproductBuildingsByItemId, itemById, producerBuildingsByItemId } from '@/shared/data'
import { AssetImage } from '@/shared/ui'
import { plannerSelectors, usePlannerStore } from '@/store/planner.store'

/** Keeps source-backed recipe information visible while refusing to display an incomplete calculation. */
export function NoProductionRoute() {
  const plan = useProductionPlan()
  const recipeIdByItemId = usePlannerStore(plannerSelectors.recipeIdByItemId)

  if (!plan) return null

  const resolver = buildPlanResolver(buildings, producerBuildingsByItemId, recipeIdByItemId)
  const recipe = resolver.getRecipeForItem(plan.targetId)
  const building = resolver.getBuildingForItem(plan.targetId)
  const targetName = itemById.get(plan.targetId)?.name ?? plan.targetId
  const recipeYield = recipe ? getRecipeYield(recipe, plan.targetId) : null
  const missingItems = [...new Set(plan.issues.filter((issue) => issue.code === 'missing-recipe').map((issue) => issue.itemId))]
  const hasOtherIssues = plan.issues.some((issue) => issue.code !== 'missing-recipe')

  return (
    <div className="h-full overflow-auto px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-xl space-y-5">
        <div>
          <h2 className="text-lg font-semibold">Plan incomplete for {targetName}</h2>
          <p className="mt-1 text-sm text-foreground/70">
            The Network graph shows verified recipe links. Factory totals and this calculated view need a confirmed source for every input.
          </p>
        </div>

        {recipe && building && (
          <div className="rounded-md border border-divider bg-content1 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-foreground/60">Game recipe</p>
            <div className="mt-3 flex items-center gap-3">
              <AssetImage kind="buildings" id={building.id} width={48} alt="" />
              <div>
                <p className="font-semibold">{building.name}</p>
                <p className="text-sm text-foreground/70">
                  {recipe.output.amount_per_minute}/min {targetName}
                  {recipeYield && recipeYield.recycledRate > 0 && ` · ${recipeYield.netOutputRate}/min net after recycling`}
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-foreground/60">Inputs per machine</p>
            <ul className="mt-2 space-y-2">
              {recipe.inputs.map((input) => (
                <li key={input.id} className="flex items-center gap-2 text-sm">
                  <AssetImage kind="items" id={input.id} width={28} alt="" />
                  <span className="flex-1">{itemById.get(input.id)?.name ?? input.id}</span>
                  <span className="tabular-nums text-foreground/70">{input.amount_per_minute}/min</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {missingItems.length > 0 && (
          <div className="rounded-md border border-warning/50 bg-warning/10 p-4 text-sm">
            <p className="font-semibold">Input source not confirmed</p>
            <ul className="mt-2 space-y-1 text-foreground/80">
              {missingItems.map((itemId) => {
                const name = itemById.get(itemId)?.name ?? itemId
                const byproductBuilding = byproductBuildingsByItemId.get(itemId)?.[0]

                return (
                  <li key={itemId}>
                    {name} has no standalone production recipe in the exported catalog.
                    {byproductBuilding &&
                      ` It is a byproduct of ${byproductBuilding.name}, but the planner cannot establish an independent continuous source for this route.`}
                  </li>
                )
              })}
            </ul>
            <p className="mt-2 text-foreground/80">
              If you can supply the missing item continuously in the game, add its rate in the Supply section to calculate this plan.
            </p>
          </div>
        )}
        {hasOtherIssues && (
          <div className="rounded-md border border-danger/50 bg-danger/10 p-4 text-sm">
            <p className="font-semibold">The selected production route cannot be calculated</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-foreground/80">
              {plan.issues
                .filter((issue) => issue.code !== 'missing-recipe')
                .map((issue) => (
                  <li key={`${issue.code}:${issue.itemId}`}>{issue.message}</li>
                ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
