import { ROUTE } from '@/router/routes'
import { Flex, PageContainer, PageContent, Typography } from '@/shared/ui'
import { Button } from '@heroui/react'
import { isRouteErrorResponse, NavLink, useRouteError } from 'react-router-dom'
import { NotFound } from './not-found'

/** Returns a useful development detail without exposing internal errors in production. */
const getDevelopmentErrorMessage = (error: unknown) => {
  if (!import.meta.env.DEV) return undefined
  if (error instanceof Error) return error.message
  if (isRouteErrorResponse(error)) return `${error.status} ${error.statusText}`
  return 'Unknown route error'
}

/** Distinguishes missing routes from unexpected route or render failures. */
export const RouteError = () => {
  const error = useRouteError()

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFound />

  const developmentDetail = getDevelopmentErrorMessage(error)

  return (
    <PageContainer>
      <PageContent overflow="hidden">
        <Flex className="h-full" justify="center" align="center">
          <Flex direction="col" align="center" gap="lg" className="max-w-xl text-center">
            <Typography as="h1" variant="h2">
              Something went wrong
            </Typography>
            <Typography tone="soft">Main Sequence Planner could not display this page. You can retry or return to the Planner.</Typography>
            {developmentDetail ? (
              <Typography as="code" variant="small" tone="muted" className="max-w-full wrap-break-word rounded-lg bg-content1 p-3">
                {developmentDetail}
              </Typography>
            ) : null}
            <Flex justify="center" gap="sm" wrap="wrap">
              <Button onPress={() => window.location.reload()}>Try again</Button>
              <Button as={NavLink} to={ROUTE.HOME} variant="bordered">
                Back to Planner
              </Button>
            </Flex>
          </Flex>
        </Flex>
      </PageContent>
    </PageContainer>
  )
}
