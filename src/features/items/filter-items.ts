import type { ItemFilterInput } from '@/features/items/types'

type ItemFilterTarget = {
  name: string
  type: string
  producerBuildingIds: readonly string[]
}

export const filterItems = <T extends ItemFilterTarget>(items: readonly T[], filters: ItemFilterInput): T[] => {
  const { selectedCategory, selectedBuildingId, searchQuery } = filters
  const normalizedQuery = searchQuery.toLowerCase()

  return items
    .filter((item) => (selectedCategory ? item.type === selectedCategory : true))
    .filter((item) => (selectedBuildingId ? item.producerBuildingIds.includes(selectedBuildingId) : true))
    .filter((item) => (normalizedQuery ? item.name.toLowerCase().includes(normalizedQuery) : true))
}
