import type { ItemTableRow } from '@/features/items/types'
import type { Building } from '@/shared/@types/building.type'
import type { Item } from '@/shared/@types/item.type'

/** Builds the read-only rows consumed by the Items table. */
export const buildItemsTableRows = (
  items: readonly Item[],
  producersByItemId: ReadonlyMap<string, readonly Building[]>,
  byproductBuildingsByItemId: ReadonlyMap<string, readonly Building[]> = new Map(),
): ItemTableRow[] => {
  return items
    .map((item) => {
      const producers = producersByItemId.get(item.id) ?? []
      const byproductProducers = byproductBuildingsByItemId.get(item.id) ?? []

      return {
        ...item,
        producerBuildingIds: [...new Set([...producers, ...byproductProducers].map((producer) => producer.id))],
        primaryProducerName: producers[0]?.name,
        byproductProducerName: byproductProducers[0]?.name,
      }
    })
    .sort((firstItem, secondItem) => firstItem.name.localeCompare(secondItem.name))
}
