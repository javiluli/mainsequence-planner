import {
  BuildingSelect,
  CategorySelect,
  ClearFiltersButton,
  ItemsTable,
  SearchInput,
  useFilteredItemRows,
  useItemsTableRows,
} from '@/features/items'
import { Seo } from '@/shared/seo'
import { Flex, PageContainer, PageContent, PageHeader, StatLabel, Typography } from '@/shared/ui'

export const PageItems = () => {
  const itemRows = useItemsTableRows()
  const filteredItems = useFilteredItemRows(itemRows)

  return (
    <>
      <Seo
        title="Main Sequence Items & Resources — Planner"
        description="Browse Main Sequence items and resources, filter the production catalog, and open any item directly in the production planner."
        path="/items"
      />
      <PageContainer>
        <PageHeader>
          <Typography as="h1" variant="h2" className="sr-only">
            Main Sequence Items & Resources
          </Typography>
          <Flex wrap="wrap" justify="between" align="end" gap="lg">
            <Flex wrap="wrap" gap="sm" className="w-full lg:w-auto">
              <CategorySelect />
              <BuildingSelect />
              <SearchInput />
              <ClearFiltersButton />
            </Flex>

            <StatLabel value={filteredItems.length} label="Item" />
          </Flex>
        </PageHeader>

        <PageContent overflow="hidden" surface="muted">
          <ItemsTable items={filteredItems} />
        </PageContent>
      </PageContainer>
    </>
  )
}
