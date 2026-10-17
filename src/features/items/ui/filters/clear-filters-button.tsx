import { Button } from '@heroui/react'
import { useItemsFilters } from '@/features/items/hooks/use-items-filters'

/** Resets the current catalog filters; visibility remains derived from active filters. */
export const ClearFiltersButton = () => {
  const { resetFilter, hasActiveFilters } = useItemsFilters()

  return (
    <>
      {hasActiveFilters && (
        <Button size="sm" variant="light" onPress={resetFilter} isDisabled={!hasActiveFilters}>
          Clear filters
        </Button>
      )}
    </>
  )
}
