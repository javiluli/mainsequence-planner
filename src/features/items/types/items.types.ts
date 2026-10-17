import type { Item } from '@/shared/@types/item.type'

/** Empty values disable individual filters; producer selections use stable building IDs. */
export type ItemFilterInput = {
  selectedCategory: string
  selectedBuildingId: string
  searchQuery: string
}

/** Catalog item with all primary/coproducing machine IDs and the first display label for each role. */
export type ItemTableRow = Item & {
  producerBuildingIds: string[]
  primaryProducerName?: string
  byproductProducerName?: string
}
