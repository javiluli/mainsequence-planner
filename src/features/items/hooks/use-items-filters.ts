import { itemsSelectors, useItemsStore } from '@/store/items.store'

export const useItemsFilters = () => {
  const filters = useItemsStore(itemsSelectors.filters)
  const setSelectedCategory = useItemsStore(itemsSelectors.setSelectedCategory)
  const setSelectedBuildingId = useItemsStore(itemsSelectors.setSelectedBuildingId)
  const setSearchQuery = useItemsStore(itemsSelectors.setSearchQuery)
  const resetFilter = useItemsStore(itemsSelectors.resetFilter)

  const hasActiveFilters = Boolean(filters.selectedCategory || filters.selectedBuildingId || filters.searchQuery)

  return {
    filters,
    setSelectedCategory,
    setSelectedBuildingId,
    setSearchQuery,
    resetFilter,
    hasActiveFilters,
  }
}
