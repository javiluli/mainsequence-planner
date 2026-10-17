import { ItemNetworkBackground, PlannerToolbar, ProductionDiagramTabs, ProductionPlanProvider, useProductionPlan } from '@/features/planner'
import { Flex, PageContainer, PageContent, PageHeader, Typography } from '@/shared/ui'
import { Suspense } from 'react'

import './page-planner.css'

const PlannerDiagram = () => (
  <div className="h-full min-h-0 min-w-0 overflow-hidden">
    <ProductionDiagramTabs />
  </div>
)

const PlannerEmptyState = () => (
  <Flex
    direction="col"
    align="center"
    justify="center"
    className="planner-empty-surface relative h-full min-h-0 min-w-0 overflow-hidden text-center"
  >
    <Suspense fallback={null}>
      <ItemNetworkBackground />
    </Suspense>

    <div className="planner-empty-content pointer-events-none relative z-10 mx-auto flex max-w-2xl flex-col items-center gap-2 px-6">
      <Typography variant="h2">Select an object to begin production</Typography>

      <Typography tone="soft">
        Choose any Main Sequence item to see its production chain, or select a raw material to use it as a terminal target.
      </Typography>
    </div>
  </Flex>
)

const PlannerPageContent = () => {
  const plan = useProductionPlan()

  return (
    <PageContainer>
      <PageHeader variant="plain" padding="none" className="mb-2 border-b border-divider/60 bg-content1 p-3 sm:p-4 lg:px-6">
        <Typography as="h1" variant="h2" className="sr-only">
          Main Sequence Production Planner
        </Typography>

        <PlannerToolbar />
      </PageHeader>

      <PageContent overflow="hidden">{plan ? <PlannerDiagram /> : <PlannerEmptyState />}</PageContent>
    </PageContainer>
  )
}

export const PagePlanner = () => (
  <ProductionPlanProvider>
    <PlannerPageContent />
  </ProductionPlanProvider>
)
