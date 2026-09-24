import { useMemo } from 'react'
import type { ItemTableRow } from '@/features/items/types'
import { filterItems } from '@/features/items/filter-items'
import { itemsSelectors, useItemsStore } from '@/store/items.store'

export const useFilteredItemRows = (items: ItemTableRow[]) => {
  const filters = useItemsStore(itemsSelectors.filters)

  return useMemo(() => filterItems(items, filters), [items, filters])
}
