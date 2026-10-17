import { useMemo } from 'react'
import type { ItemTableRow } from '@/features/items/types'
import { filterItems } from '@/features/items/filter-items'
import { itemsSelectors, useItemsStore } from '@/store/items.store'

/** Recalculates visible rows only when the catalog rows or current filter values change. */
export const useFilteredItemRows = (items: ItemTableRow[]) => {
  const filters = useItemsStore(itemsSelectors.filters)

  return useMemo(() => filterItems(items, filters), [items, filters])
}
