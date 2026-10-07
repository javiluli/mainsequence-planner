import {
  BuildingSelect,
  CategorySelect,
  ClearFiltersButton,
  ItemsTable,
  SearchInput,
  useFilteredItemRows,
  useItemsTableRows,
} from '@/features/items'
import { Flex, PageContainer, PageContent, PageHeader, StatLabel, Typography } from '@/shared/ui'

export const PageItems = () => {
  const itemRows = useItemsTableRows()
  const filteredItems = useFilteredItemRows(itemRows)

  return (
    <PageContainer className="gap-0 p-0 sm:p-0 lg:p-0">
      <PageHeader variant="plain" padding="none" className="border-b border-divider/60 bg-content1 p-3 sm:p-4 lg:px-6">
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
  )
}
