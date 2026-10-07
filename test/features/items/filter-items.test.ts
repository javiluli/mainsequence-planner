import { describe, expect, it } from 'vitest'
import type { ItemFilterInput } from '@/features/items/types'
import { filterItems } from '@/features/items/filter-items'

const items = [
  {
    id: 'titanium_plate',
    name: 'Titanium Plate',
    type: 'component',
    producerBuildingIds: ['fabricator', 'factorytier2'],
  },
  {
    id: 'wolfram_powder',
    name: 'Wolfram Powder',
    type: 'processed',
    producerBuildingIds: ['furnace'],
  },
  {
    id: 'calcium_ore',
    name: 'Calcium Ore',
    type: 'raw',
    producerBuildingIds: [],
  },
]

const EMPTY_FILTERS: ItemFilterInput = {
  selectedCategory: '',
  selectedBuildingId: '',
  searchQuery: '',
}

describe('filterItems', () => {
  it('returns every item when no filter is active', () => {
    expect(filterItems(items, EMPTY_FILTERS)).toEqual(items)
  })

  it('filters by category and every producing building', () => {
    expect(filterItems(items, { ...EMPTY_FILTERS, selectedCategory: 'processed' }).map((item) => item.id)).toEqual(['wolfram_powder'])
    expect(filterItems(items, { ...EMPTY_FILTERS, selectedBuildingId: 'fabricator' }).map((item) => item.id)).toEqual(['titanium_plate'])
    expect(filterItems(items, { ...EMPTY_FILTERS, selectedBuildingId: 'factorytier2' }).map((item) => item.id)).toEqual(['titanium_plate'])
  })

  it('matches search text without case sensitivity', () => {
    const result = filterItems(items, { ...EMPTY_FILTERS, searchQuery: 'tItAnIuM' })

    expect(result.map((item) => item.id)).toEqual(['titanium_plate'])
  })

  it('combines active filters instead of applying them independently', () => {
    const result = filterItems(items, {
      selectedCategory: 'component',
      selectedBuildingId: 'fabricator',
      searchQuery: 'plate',
    })

    expect(result.map((item) => item.id)).toEqual(['titanium_plate'])
    expect(filterItems(items, { ...EMPTY_FILTERS, selectedCategory: 'raw', selectedBuildingId: 'fabricator' })).toEqual([])
  })
})
