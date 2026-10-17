import type { RawBuilding } from '@/shared/@types/building.type'
import type { RawItem } from '@/shared/@types/item.type'
import { describe, expect, it } from 'vitest'
import buildingsCatalog from '@/shared/data/main-sequence/buildings_and_recipes.json'
import itemsCatalog from '@/shared/data/main-sequence/items.json'
import { inspectCatalog } from './catalog-integrity'
import { normalizeBuildings, normalizeItems } from '@/shared/data/catalog-normalization'
import { getExternallyAcquiredItemIds } from '@/shared/data/building-production'

const items: readonly RawItem[] = itemsCatalog
const rawBuildings: readonly RawBuilding[] = buildingsCatalog

describe('game catalog source integrity', () => {
  it('preserves the source catalog, stable IDs and verified ratios through normalization', () => {
    expect(inspectCatalog(items, rawBuildings)).toEqual([])
    expect(inspectCatalog(items, normalizeBuildings(rawBuildings))).toEqual([])
    expect(items).toHaveLength(70)
    expect(rawBuildings).toHaveLength(8)
    expect(rawBuildings.reduce((total, building) => total + (building.recipes?.length ?? 0), 0)).toBe(63)
    expect(rawBuildings.every((building) => building.type === 'production' && building.name && building.recipes?.length)).toBe(true)
    expect(items.find((item) => item.name === 'Nickel Ore')).toEqual({ id: 'T_NickelOre', name: 'Nickel Ore', type: 'raw' })
    expect(items.find((item) => item.name === 'Nickel Plates')).toEqual({ id: 'T_NickelPlates1', name: 'Nickel Plates', type: 'processed' })
    const refinery = rawBuildings.find((building) => building.id === 'refinery')
    expect(refinery).toMatchObject({ name: 'Refinery', power: 4.5 })
    expect(refinery?.recipes?.find((recipe) => recipe.id === 'nickel_plates')).toMatchObject({
      output: { id: 'T_NickelPlates1', amount_per_minute: 20 },
      inputs: [{ id: 'T_NickelOre', amount_per_minute: 20 }],
    })
    expect(rawBuildings.find((building) => building.id === 'fabricator')).toMatchObject({ name: 'Assembler', power: 6 })
    expect(rawBuildings.find((building) => building.id === 'armoury')).not.toHaveProperty('power')
  })

  it('distinguishes externally acquired items from the real Biomass coproduct', () => {
    const acquired = getExternallyAcquiredItemIds(normalizeItems(items), normalizeBuildings(rawBuildings))
    expect([...acquired].sort()).toEqual(['T_RelicCore', 'T_StellarSurveyData'])
    const producedIds = new Set(
      rawBuildings.flatMap((building) =>
        (building.recipes ?? []).flatMap((recipe) => [recipe.output.id, ...(recipe.extra_outputs ?? []).map((output) => output.id)]),
      ),
    )
    expect(items.filter((item) => !producedIds.has(item.id)).map((item) => item.id)).toEqual([
      'T_CobaltOre',
      'T_Graphite',
      'T_IridiumOre',
      'T_Lonsdaleite',
      'T_NitrogenGas',
      'T_RelicCore',
      'T_Silica',
      'T_StellarSurveyData',
      'T_WaterIce1',
    ])
  })

  it('reports duplicate identifiers, invalid rates and missing outputs in isolated fixtures', () => {
    const invalid: readonly RawBuilding[] = [
      {
        id: 'machine',
        name: 'Machine',
        type: 'production',
        recipes: [{ id: 'bad', output: { id: 'missing', amount_per_minute: 0 }, inputs: [] }],
      },
      {
        id: 'machine',
        name: 'Duplicate',
        type: 'production',
        recipes: [{ id: 'bad', output: { id: 'missing', amount_per_minute: -1 }, inputs: [] }],
      },
    ]
    const issues = inspectCatalog([{ id: 'known', name: 'Known', type: 'raw' }], invalid)
    expect(issues.filter((issue) => issue.code === 'duplicate-building')).toHaveLength(1)
    expect(issues.filter((issue) => issue.code === 'duplicate-recipe')).toHaveLength(1)
    expect(issues.filter((issue) => issue.code === 'missing-item')).toHaveLength(2)
    expect(issues.filter((issue) => issue.code === 'invalid-rate')).toHaveLength(2)
  })

  it('normalizes repeated cost materials and rejects unknown IDs or invalid unit quantities at the data boundary', () => {
    const base = { id: 'machine', name: 'Machine', type: 'production', recipes: [] }
    const itemIds = new Set(['known'])
    const normalized = normalizeBuildings(
      [
        {
          ...base,
          construction_cost: [
            { id: 'known', amount: 2 },
            { id: 'known', amount: 3 },
          ],
        },
        { ...base, id: 'free', construction_cost: [] },
        { ...base, id: 'unknown' },
      ],
      itemIds,
    )
    expect(normalized.map((building) => building.construction_cost)).toEqual([[{ id: 'known', amount: 5 }], [], undefined])
    for (const material of [
      { id: 'missing', amount: 1 },
      { id: 'known', amount: 0 },
      { id: 'known', amount: -1 },
      { id: 'known', amount: Number.NaN },
      { id: 'known', amount: Infinity },
    ]) {
      const invalid = { ...base, construction_cost: [material] }
      expect(inspectCatalog([{ id: 'known', name: 'Known', type: 'raw' }], [invalid])).not.toEqual([])
      expect(() => normalizeBuildings([invalid], itemIds)).toThrow()
    }
  })
})
