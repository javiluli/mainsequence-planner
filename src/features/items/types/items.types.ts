import type { Item } from '@/shared/@types/item.type'

export type ItemFilterInput = {
  selectedCategory: string
  selectedBuildingId: string
  searchQuery: string
}

export type ItemTableRow = Item & {
  producerBuildingIds: string[]
  primaryProducerName?: string
  byproductProducerName?: string
}
