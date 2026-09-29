import { BaseDesigner } from '@/features/base-designer'
import { PageContainer, PageContent, PageHeader, Typography } from '@/shared/ui'

export function PageBases() {
  return (
    <PageContainer className="gap-0 p-0 sm:p-0 lg:p-0">
      <PageHeader variant="plain" padding="none" className="border-b border-divider/60 bg-content1 p-3 sm:p-4 lg:px-6">
        <Typography as="h1" variant="h2">
          Base designer
        </Typography>
        <Typography tone="soft" className="mt-1 max-w-3xl">
          Arrange stations, machines and belt paths on a measured grid before building in-game.
        </Typography>
      </PageHeader>
      <PageContent overflow="hidden" surface="muted">
        <BaseDesigner />
      </PageContent>
    </PageContainer>
  )
}
