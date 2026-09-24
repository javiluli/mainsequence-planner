import { ROUTE } from '@/router/routes'
import { Flex, PageContainer, PageContent, Typography } from '@/shared/ui'
import { Button } from '@heroui/react'
import { NavLink } from 'react-router-dom'

export const NotFound = () => {
  return (
    <PageContainer>
      <PageContent overflow="hidden">
        <Flex className="h-full" justify="center" align="center">
          <Flex direction="col" align="center" gap="lg" className="text-center">
            <Typography aria-hidden variant="display" className="text-9xl font-extralight">
              404
            </Typography>
            <Typography as="h1" variant="h2">
              Page not found
            </Typography>
            <Typography tone="soft">The requested address does not match any page in Main Sequence Planner.</Typography>
            <Button as={NavLink} to={ROUTE.HOME}>
              Back to Planner
            </Button>
          </Flex>
        </Flex>
      </PageContent>
    </PageContainer>
  )
}
