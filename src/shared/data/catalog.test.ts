import type { Building } from '@/shared/@types/building.type'
import { describe, expect, it } from 'vitest'
import { buildingById, buildings, indexProducerBuildingsByItemId, itemById, items, producerBuildingsByItemId } from './index'

describe('derived game catalog', () => {
  it('normalizes source omissions and indexes every item and building exactly once', () => {
    expect(buildings.every((building) => Array.isArray(building.recipes))).toBe(true)
    expect(itemById.size).toBe(items.length)
    expect(buildingById.size).toBe(buildings.length)
  })

  it('indexes zero, one and multiple producers without changing catalog order', () => {
    const fixtures: readonly Building[] = [
      {
        id: 'furnace',
        name: 'Furnace',
        power: 10,
        type: 'production',
        recipes: [{ output: { id: 'ceramics', amount_per_minute: 60 }, inputs: [] }],
      },
      {
        id: 'furnace_v2',
        name: 'Furnace v.2',
        power: 20,
        type: 'production',
        recipes: [{ output: { id: 'ceramics', amount_per_minute: 120 }, inputs: [] }],
      },
      {
        id: 'smelter',
        name: 'Smelter',
        power: 10,
        type: 'production',
        recipes: [{ output: { id: 'ingot', amount_per_minute: 30 }, inputs: [] }],
      },
    ]
    const producers = indexProducerBuildingsByItemId(fixtures)

    expect(producers.get('raw')).toBeUndefined()
    expect(producers.get('ingot')?.map((building) => building.id)).toEqual(['smelter'])
    expect(producers.get('ceramics')?.map((building) => building.id)).toEqual(['furnace', 'furnace_v2'])
  })

  it('keeps the shared producer index aligned with every derived recipe', () => {
    for (const building of buildings) {
      for (const recipe of building.recipes) {
        expect(producerBuildingsByItemId.get(recipe.output.id)).toContain(building)
      }
    }
  })

  it('preserves missing power as unknown instead of manufacturing a zero value', async () => {
    const { normalizeBuildings } = await import('./catalog-normalization')
    const [building] = normalizeBuildings([
      {
        id: 'unknown-power',
        name: 'Unknown power machine',
        type: 'production',
        recipes: [],
      },
    ])

    expect(building.power).toBeUndefined()
  })
})
