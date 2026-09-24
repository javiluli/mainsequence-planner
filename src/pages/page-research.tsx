import { ResearchGraph } from '@/features/research'
import { PageContainer, PageContent, PageHeader, Typography } from '@/shared/ui'

export const PageResearch = () => (
  <PageContainer>
    <PageHeader>
      <Typography as="h1" variant="h2">
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
