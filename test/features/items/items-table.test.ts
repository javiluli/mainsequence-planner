import type { Building } from '@/shared/@types/building.type'
import type { Item } from '@/shared/@types/item.type'
import { indexByproductBuildingsByItemId, indexProducerBuildingsByItemId } from '@/shared/data'
import { describe, expect, it } from 'vitest'
import { buildItemsTableRows } from '@/features/items/lib/build-items-table-rows'
import { filterItems } from '@/features/items/filter-items'
import type { ItemFilterInput } from '@/features/items/types'

const items = [
  { id: 'ceramics', name: 'Ceramics', type: 'processed' },
  { id: 'ore_calcium', name: 'Calcium Ore', type: 'raw' },
  { id: 'plate', name: 'Plate', type: 'component' },
  { id: 'residue', name: 'Residue', type: 'component' },
] satisfies Item[]

const buildings = [
  {
    id: 'furnace',
    name: 'Furnace',
    power: 20,
    type: 'production',
    recipes: [{ output: { id: 'ceramics', amount_per_minute: 60 }, inputs: [] }],
  },
  {
    id: 'furnacetier2',
    name: 'Furnace v.2',
    power: 40,
    type: 'production',
    recipes: [{ output: { id: 'ceramics', amount_per_minute: 120 }, inputs: [] }],
  },
  {
    id: 'assembler',
    name: 'Assembler',
    power: 10,
    type: 'production',
    recipes: [{ output: { id: 'plate', amount_per_minute: 30 }, extra_outputs: [{ id: 'residue', amount_per_minute: 5 }], inputs: [] }],
  },
] satisfies Building[]

const emptyFilters: ItemFilterInput = { selectedCategory: '', selectedBuildingId: '', searchQuery: '' }

describe('Items table rows and filters', () => {
  it('preserves zero, one or multiple producers without changing the presentation order', () => {
    const rows = buildItemsTableRows(items, indexProducerBuildingsByItemId(buildings))

    expect(rows).toEqual([
      expect.objectContaining({ id: 'ore_calcium', producerBuildingIds: [], primaryProducerName: undefined }),
      expect.objectContaining({
        id: 'ceramics',
        producerBuildingIds: ['furnace', 'furnacetier2'],
        primaryProducerName: 'Furnace',
      }),
      expect.objectContaining({ id: 'plate', producerBuildingIds: ['assembler'], primaryProducerName: 'Assembler' }),
      expect.objectContaining({ id: 'residue', producerBuildingIds: [], primaryProducerName: undefined }),
    ])
  })

  it('lists source-backed byproduct machines without treating the byproduct as a standalone recipe', () => {
    const rows = buildItemsTableRows(items, indexProducerBuildingsByItemId(buildings), indexByproductBuildingsByItemId(buildings))

    expect(rows.find((row) => row.id === 'residue')).toEqual(
      expect.objectContaining({ producerBuildingIds: ['assembler'], primaryProducerName: undefined, byproductProducerName: 'Assembler' }),
    )
    expect(indexProducerBuildingsByItemId(buildings).has('residue')).toBe(false)
  })

  it('keeps unfiltered rows and matches category or any producing building', () => {
    const rows = buildItemsTableRows(items, indexProducerBuildingsByItemId(buildings))
    expect(filterItems(rows, emptyFilters)).toEqual(rows)
    expect(filterItems(rows, { ...emptyFilters, selectedCategory: 'raw' }).map((item) => item.id)).toEqual(['ore_calcium'])
    for (const selectedBuildingId of ['furnace', 'furnacetier2']) {
      expect(filterItems(rows, { ...emptyFilters, selectedBuildingId }).map((item) => item.id)).toEqual(['ceramics'])
    }
  })

  it('combines filters and searches names without case sensitivity', () => {
    const rows = buildItemsTableRows(items, indexProducerBuildingsByItemId(buildings))
    expect(filterItems(rows, { ...emptyFilters, searchQuery: 'cErAm' }).map((item) => item.id)).toEqual(['ceramics'])
    expect(
      filterItems(rows, { selectedCategory: 'processed', selectedBuildingId: 'furnace', searchQuery: 'cErAm' }).map((item) => item.id),
    ).toEqual(['ceramics'])
    expect(filterItems(rows, { ...emptyFilters, selectedCategory: 'raw', selectedBuildingId: 'furnace' })).toEqual([])
  })
})
