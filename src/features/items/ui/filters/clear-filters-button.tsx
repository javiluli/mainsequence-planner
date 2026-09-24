import { Button } from '@heroui/react'
import { useItemsFilters } from '@/features/items/hooks/use-items-filters'

export const ClearFiltersButton = () => {
  const { resetFilter, hasActiveFilters } = useItemsFilters()

  return (
    <>
      {hasActiveFilters && (
        <Button size="sm" variant="solid" onPress={resetFilter} isDisabled={!hasActiveFilters}>
          Clear filters
        </Button>
      )}
    </>
  )
}
