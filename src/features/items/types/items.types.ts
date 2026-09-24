import type { ResearchScienceType } from '@/shared/@types/research.type'
import type { Item } from '@/shared/@types/item.type'

export type ItemFilterInput = {
  selectedCategory: string
  selectedBuildingId: string
  searchQuery: string
}

export type ItemResearchInfo = {
  scienceType: ResearchScienceType
  pointsPerItem: number
}

export type ItemTableRow = Item & {
  producerBuildingIds: string[]
  primaryProducerName?: string
  byproductProducerName?: string
  research?: ItemResearchInfo
}
