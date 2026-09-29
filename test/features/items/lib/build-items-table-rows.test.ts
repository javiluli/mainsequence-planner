import type { Building } from '@/shared/@types/building.type'
import type { ResearchItem, ResearchScienceType } from '@/shared/@types/research.type'
import type { Item } from '@/shared/@types/item.type'
import { indexByproductBuildingsByItemId, indexProducerBuildingsByItemId } from '@/shared/data'
import { describe, expect, it } from 'vitest'
import { buildItemsTableRows } from '@/features/items/lib/build-items-table-rows'

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

const researchItems = new Map<string, ResearchItem>([['plate', { item_id: 'plate', type: 'material_science', points_per_item: 3 }]])

const researchScienceTypes = new Map<string, ResearchScienceType>([
  ['material_science', { id: 'material_science', name: 'Material Science' }],
])

describe('buildItemsTableRows', () => {
  it('preserves zero, one or multiple producers without changing the presentation order', () => {
    const rows = buildItemsTableRows(items, indexProducerBuildingsByItemId(buildings), researchItems, researchScienceTypes)

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
    const rows = buildItemsTableRows(
      items,
      indexProducerBuildingsByItemId(buildings),
      researchItems,
      researchScienceTypes,
      indexByproductBuildingsByItemId(buildings),
    )

    expect(rows.find((row) => row.id === 'residue')).toEqual(
      expect.objectContaining({ producerBuildingIds: ['assembler'], primaryProducerName: undefined, byproductProducerName: 'Assembler' }),
    )
    expect(indexProducerBuildingsByItemId(buildings).has('residue')).toBe(false)
  })

  it('attaches only source-backed research information to point-bearing items', () => {
    const rows = buildItemsTableRows(items, indexProducerBuildingsByItemId(buildings), researchItems, researchScienceTypes)

    expect(rows.find((row) => row.id === 'plate')?.research).toEqual({
      scienceType: { id: 'material_science', name: 'Material Science' },
      pointsPerItem: 3,
    })
    expect(rows.find((row) => row.id === 'ceramics')?.research).toBeUndefined()
    expect(rows.find((row) => row.id === 'ore_calcium')?.research).toBeUndefined()
  })
})
