import { ResearchGraph } from '@/features/research'
import { PageContainer, PageContent, PageHeader, Typography } from '@/shared/ui'

export const PageResearch = () => (
  <PageContainer className="gap-0 p-0 sm:p-0 lg:p-0">
    <PageHeader variant="plain" padding="none" className="border-b border-divider/60 bg-content1 p-3 sm:p-4 lg:px-6">
      <Typography as="h1" variant="h2">
        <span className="sr-only">Main Sequence </span>
        Research
      </Typography>
      <Typography tone="soft" className="mt-1 max-w-3xl">
        Select a technology to open its prerequisite and progression tree, using relationships extracted from the game catalog.
      </Typography>
    </PageHeader>

    <PageContent overflow="hidden" surface="muted">
      <ResearchGraph />
    </PageContent>
  </PageContainer>
)
