import { BaseDesigner } from '@/features/base-designer'
import { ProductionPlanProvider, useProductionPlan } from '@/features/planner'
import { useSearchParams } from 'react-router-dom'
import { PageContainer, PageContent, PageHeader, Typography } from '@/shared/ui'

/** Adapt the current plan through its public provider; comparison never resets Planner inputs or replaces the base. */
function ComparedBaseDesigner() {
  const plan = useProductionPlan()
  return <BaseDesigner referencePlan={plan} comparisonRequested />
}

/** Enables the optional Planner comparison from the URL without giving the page ownership of either feature's state. */
export function PageBases() {
  const [search] = useSearchParams()
  return (
    <PageContainer>
      <PageHeader
        variant="plain"
        padding="none"
        className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-divider/60 bg-content1 px-3 py-2 sm:px-4"
      >
        <Typography as="h1" variant="h4">
          Base designer
        </Typography>
        <Typography tone="muted" variant="caption" className="max-w-3xl">
          Arrange buildings and belt paths on station floors before building in-game.
        </Typography>
      </PageHeader>
      <PageContent overflow="hidden" surface="muted" className="flex flex-col">
        {search.get('compare') === 'planner' ? (
          <ProductionPlanProvider>
            <ComparedBaseDesigner />
          </ProductionPlanProvider>
        ) : (
          <BaseDesigner />
        )}
      </PageContent>
    </PageContainer>
  )
}
