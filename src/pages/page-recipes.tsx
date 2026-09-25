import { RecipesAccordion, useRecipesSummary } from '@/features/recipes'
import { Seo } from '@/shared/seo'
import { Flex, PageContainer, PageContent, PageHeader, StatLabel, Typography } from '@/shared/ui'

export const PageRecipes = () => {
  const stats = useRecipesSummary()

  return (
    <>
      <Seo
        title="Main Sequence Buildings & Recipes — Planner"
        description="Browse Main Sequence buildings, machines, and recipes, including production inputs, outputs, and available crafting relationships."
        path="/recipes"
      />
      <PageContainer>
        <PageHeader>
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
          <RecipesAccordion />
        </PageContent>
      </PageContainer>
    </>
  )
}
