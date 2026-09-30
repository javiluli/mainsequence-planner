import { RecipesAccordion, useRecipesSummary } from '@/features/recipes'
import { Flex, PageContainer, PageContent, PageHeader, StatLabel, Typography } from '@/shared/ui'

export const PageRecipes = () => {
  const stats = useRecipesSummary()

  return (
    <PageContainer className="gap-0 p-0 sm:p-0 lg:p-0">
      <PageHeader variant="plain" padding="none" className="border-b border-divider/60 bg-content1 p-3 sm:p-4 lg:px-6">
        <Flex align="center" justify="between" gap="lg" wrap="wrap">
          <Typography as="h1" variant="h2">
            <span className="sr-only">Main Sequence </span>
            Buildings & Recipes
          </Typography>
          <Flex gap="md" align="center">
            <StatLabel value={stats.buildingsCount} label="Building" />
            <StatLabel value={stats.recipesCount} label="Recipe" />
          </Flex>
        </Flex>
      </PageHeader>

      <PageContent>
        <div className="p-3 sm:p-4 lg:p-6">
          <RecipesAccordion />
        </div>
      </PageContent>
    </PageContainer>
  )
}
