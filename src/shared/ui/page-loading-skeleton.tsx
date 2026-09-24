import { Skeleton } from '@heroui/react'
import { Flex } from './layout/flex'
import { PageContainer } from './layout/page-container'
import { PageContent } from './layout/page-content'
import { PageHeader } from './layout/page-header'

const ROWS = Array.from({ length: 8 }, (_, index) => index)

/** Route fallback that preserves the shared page geometry while a lazy page loads. */
export const PageLoadingSkeleton = () => (
  <PageContainer aria-busy="true" aria-label="Loading page">
    <PageHeader>
      <Flex justify="between" gap="lg">
        <Skeleton className="h-8 w-72 rounded-lg" />
        <Flex>
          <Skeleton className="h-8 w-24 rounded-lg" />
          <Skeleton className="h-8 w-24 rounded-lg" />
        </Flex>
      </Flex>
    </PageHeader>
    <PageContent surface="muted" padding="sm">
      <Flex direction="col" align="stretch" gap="sm">
        {ROWS.map((row) => (
          <Skeleton key={row} className="h-16 w-full rounded-xl" />
        ))}
      </Flex>
    </PageContent>
  </PageContainer>
)
