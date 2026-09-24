import { RecipesAccordion, useRecipesSummary } from '@/features/recipes'
import { Flex, PageContainer, PageContent, PageHeader, StatLabel, Typography } from '@/shared/ui'

export const PageRecipes = () => {
  const stats = useRecipesSummary()

  return (
    <PageContainer>
      <PageHeader>
        <Flex align="center" justify="between" gap="lg" wrap="wrap">
          <Typography as="h1" variant="h2">
            Buildings & Recipes
          </Typography>
          <Flex gap="md" align="center">
            <StatLabel value={stats.buildingsCount} label="Building" />
            <StatLabel value={stats.recipesCount} label="Recipe" />
          </Flex>
        </Flex>
      </PageHeader>

      <PageContent>
        <RecipesAccordion />
      </PageContent>
    </PageContainer>
  )
}
