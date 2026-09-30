import { BaseDesigner } from '@/features/base-designer'
import { ProductionPlanProvider } from '@/features/planner'
import { PageContainer, PageContent, PageHeader, Typography } from '@/shared/ui'

export function PageBases() {
  return (
    <PageContainer className="gap-0 p-0 sm:p-0 lg:p-0">
      <PageHeader
        variant="plain"
        padding="none"
        className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-divider/60 bg-content1 px-3 py-2 sm:px-4"
      >
        <Typography as="h1" variant="h4">
          Base designer
        </Typography>
        <Typography tone="muted" variant="small" className="max-w-3xl text-xs font-normal">
          Arrange stations, machines and belt paths on a measured grid before building in-game.
        </Typography>
      </PageHeader>
      <PageContent overflow="hidden" surface="muted">
        <ProductionPlanProvider>
          <BaseDesigner />
        </ProductionPlanProvider>
      </PageContent>
    </PageContainer>
  )
}
