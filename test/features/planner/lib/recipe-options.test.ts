import { describe, expect, it } from 'vitest'
import type { Building } from '@/shared/@types/building.type'
import { getPlanRecipeGroups } from '@/features/planner/lib/recipe-options'
import { buildProductionPlan } from '@/features/planner/lib/production-plan'
import {
  buildings,
  externallyAcquiredItemIds,
  itemById,
  items,
  producerBuildingsByItemId,
  indexProducerBuildingsByItemId,
} from '@/shared/data'

const rawItemIds = new Set(items.filter((item) => item.type === 'raw').map((item) => item.id))

/** Uses source-backed rates and routes to check the new UI projection without changing calculation inputs. */
const buildCatalog = (targetId: string, recipeIdByItemId: Record<string, string> = {}, supplyCountByItem: Record<string, number> = {}) =>
  buildProductionPlan({
    buildings,
    producerBuildingsByItemId,
    targetId,
    targetIpm: 20,
    isRawTarget: itemById.get(targetId)?.type === 'raw',
    rawItemIds,
    externalItemIds: externallyAcquiredItemIds,
    recipeIdByItemId,
    supplyCountByItem,
  })

describe('Planner recipe option groups (F16)', () => {
  it.each([
    ['T_NickelOre', 'nickel_synthesis'],
    ['T_TitaniumOre', 'titanium_synthesis'],
  ])('offers external input before the real synthesis of raw target %s', (itemId, recipeId) => {
    const plan = buildCatalog(itemId)
    expect(plan.steps).toEqual([])
    const groups = getPlanRecipeGroups(plan, buildings, itemById)
    expect(groups).toEqual([
      expect.objectContaining({
        itemId,
        choices: [{ kind: 'external', id: '' }, expect.objectContaining({ kind: 'recipe', id: recipeId, buildingId: 'enrichment' })],
      }),
    ])
    expect(groups[0]).not.toHaveProperty('targetIpm')
  })

  it('keeps ordinary plate alternatives and adds synthesis for an external raw ingredient', () => {
    const groups = getPlanRecipeGroups(buildCatalog('T_NickelPlates1'), buildings, itemById)
    expect(groups.map((group) => group.itemId)).toEqual(['T_NickelPlates1', 'T_NickelOre'])
    expect(groups[0]).toMatchObject({
      targetIpm: 20,
      choices: [expect.objectContaining({ id: 'nickel_plates' }), expect.objectContaining({ id: 'enriched_nickel_plates' })],
    })
    expect(groups[1].choices.map((choice) => choice.id)).toEqual(['', 'nickel_synthesis'])
  })

  it('does not invent synthesis for raw Cobalt or expose a choice without an alternative', () => {
    expect(getPlanRecipeGroups(buildCatalog('T_CobaltOre'), buildings, itemById)).toEqual([])
    expect(getPlanRecipeGroups(buildCatalog('T_CobaltPlates'), buildings, itemById).map((group) => group.itemId)).toEqual([
      'T_CobaltPlates',
    ])
  })

  it.each(['T_NickelOre', 'T_NickelPlates1'])('keeps the raw choice available when supply covers it for target %s', (targetId) => {
    const plan = buildCatalog(targetId, { T_NickelOre: 'nickel_synthesis' }, { T_NickelOre: 20 })
    expect(plan.rawInputs.some((input) => input.itemId === 'T_NickelOre')).toBe(false)
    expect(plan.steps.some((step) => step.itemId === 'T_NickelOre')).toBe(false)
    expect(getPlanRecipeGroups(plan, buildings, itemById)).toContainEqual(
      expect.objectContaining({
        itemId: 'T_NickelOre',
        choices: [expect.objectContaining({ kind: 'external' }), expect.objectContaining({ id: 'nickel_synthesis' })],
      }),
    )
  })

  it('retains the raw route selector when a verified coproduct covers all of its demand', () => {
    // Isolated domain fixture: this does not assert a new recipe or coproduct in the game catalog.
    const factory: Building[] = [
      ...buildings,
      {
        id: 'fixture_source',
        name: 'Fixture source',
        type: 'production',
        recipes: [
          {
            id: 'fixture_coproduct',
            output: { id: 'fixture_component', amount_per_minute: 1 },
            inputs: [],
            extra_outputs: [{ id: 'T_NickelOre', amount_per_minute: 20 }],
          },
        ],
      },
      {
        id: 'fixture_assembler',
        name: 'Fixture assembler',
        type: 'production',
        recipes: [
          {
            id: 'fixture_assembly',
            output: { id: 'fixture_target', amount_per_minute: 1 },
            inputs: [
              { id: 'fixture_component', amount_per_minute: 1 },
              { id: 'T_NickelOre', amount_per_minute: 20 },
            ],
          },
        ],
      },
    ]
    const plan = buildProductionPlan({
      buildings: factory,
      producerBuildingsByItemId: indexProducerBuildingsByItemId(factory),
      targetId: 'fixture_target',
      targetIpm: 1,
      isRawTarget: false,
      rawItemIds,
      supplyCountByItem: {},
    })
    expect(plan.issues).toEqual([])
    expect(plan.rawInputs).toEqual([])
    expect(plan.byproductAllocations).toContainEqual(expect.objectContaining({ itemId: 'T_NickelOre', amountPerMinute: 20 }))
    const before = structuredClone(plan)
    expect(getPlanRecipeGroups(plan, factory, itemById)).toContainEqual(expect.objectContaining({ itemId: 'T_NickelOre' }))
    expect(plan).toEqual(before)
  })
  it('deduplicates a synthesized raw group and never mutates plan quantities or supply', () => {
    const plan = buildCatalog('T_NickelPlates1', { T_NickelOre: 'nickel_synthesis' }, { T_NickelOre: 5 })
    const before = structuredClone(plan)
    const groups = getPlanRecipeGroups(plan, buildings, itemById)
    expect(groups.filter((group) => group.itemId === 'T_NickelOre')).toHaveLength(1)
    expect(groups.find((group) => group.itemId === 'T_NickelOre')?.choices[0]).toEqual({ kind: 'external', id: '' })
    expect(plan).toEqual(before)
    expect(plan.steps.find((step) => step.itemId === 'T_NickelOre')?.targetIpm).toBe(15)
  })
})
