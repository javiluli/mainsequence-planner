import { ResearchGraph } from '@/features/research'
import { Seo } from '@/shared/seo'
import { PageContainer, PageContent, PageHeader, Typography } from '@/shared/ui'

export const PageResearch = () => (
  <>
    <Seo
      title="Main Sequence Research Tree — Planner"
      description="Explore the Main Sequence research tree, technologies, prerequisites, science costs, progression paths, and unlock relationships."
      path="/research"
    />
    <PageContainer>
      <PageHeader>
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
  </>
)
