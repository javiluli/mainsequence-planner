import {
  PlannerSidebar,
  PlannerToolbar,
  ProductionDiagramTabs,
  ProductionPlanProvider,
  RandomItemMarquee,
  useProductionPlan,
} from '@/features/planner'
import { Flex, Grid, PageContainer, PageContent, PageHeader, Panel, Typography } from '@/shared/ui'
import { Suspense } from 'react'
import './page-planner.css'

const PlannerToolbarFallback = () => (
  <div role="status" className="min-h-10 w-full sm:min-h-8">
    <span className="sr-only">Loading planner controls</span>
  </div>
)

const PlannerPanels = () => (
  <Grid
    gap="lg"
    className="h-full min-h-0 min-w-0 grid-cols-1 grid-rows-[minmax(32rem,1fr)_22rem] items-stretch lg:grid-cols-[minmax(0,1fr)_24rem] lg:grid-rows-1"
  >
    <Panel padding="none" variant="muted" className="min-h-0 min-w-0 overflow-hidden">
      <Suspense fallback={null}>
        <ProductionDiagramTabs />
      </Suspense>
    </Panel>
    <Panel padding="none" variant="muted" className="min-h-0 min-w-0 overflow-hidden">
      <Suspense fallback={null}>
        <PlannerSidebar />
      </Suspense>
    </Panel>
  </Grid>
)

const PlannerPageContent = () => {
  const plan = useProductionPlan()

  return (
    <PageContainer>
      <PageHeader>
        <Typography as="h1" variant="h2" className="sr-only">
          Planner
        </Typography>
        <Suspense fallback={<PlannerToolbarFallback />}>
          <PlannerToolbar />
        </Suspense>
      </PageHeader>

      <PageContent className="lg:overflow-hidden">
        {plan ? (
          <PlannerPanels />
        ) : (
          <Flex
            direction="col"
            align="center"
            justify="center"
            className="planner-empty-surface h-full min-h-0 overflow-hidden text-center"
          >
            <Typography variant="h2">Select an object to begin production</Typography>
            <Typography tone="soft">
              Choose any item to see its production chain, or select a raw material to use it as a terminal target.
            </Typography>
            <div className="order-first w-full">
              <RandomItemMarquee />
            </div>
          </Flex>
        )}
      </PageContent>
    </PageContainer>
  )
}

export const PagePlanner = () => (
  <ProductionPlanProvider>
    <PlannerPageContent />
  </ProductionPlanProvider>
)
