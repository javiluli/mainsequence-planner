import { planToFlow } from '@/features/planner/flow/plan-to-flow'
import { buildProductionPlan } from '@/features/planner/lib/production-plan'
import { buildTree } from '@/features/planner/ui/treelist-diagram'
import { buildings, indexProducerBuildingsByItemId, items, researchItemById, researchTechnologyById } from '@/shared/data'
import { describe, expect, it } from 'vitest'

const producerBuildingsByItemId = indexProducerBuildingsByItemId(buildings)
const rawItemIds = new Set(items.filter((item) => item.type === 'raw').map((item) => item.id))

const buildPlan = (targetId: string, targetIpm: number, options: Partial<Parameters<typeof buildProductionPlan>[0]> = {}) =>
  buildProductionPlan({
    buildings,
    producerBuildingsByItemId,
    targetId,
    targetIpm,
    isRawTarget: false,
    rawItemIds,
    supplyCountByItem: {},
    ...options,
  })

describe('Main Sequence catalog integration', () => {
  it('can resolve every exported crafting recipe with its exact machine, rates and external ingredients', () => {
    for (const building of buildings) {
      for (const recipe of building.recipes) {
        if (!recipe.id) throw new Error(`A recipe in ${building.id} has no stable ID`)
        const outputId = recipe.output.id
        const netRate =
          recipe.output.amount_per_minute -
          recipe.inputs.filter((input) => input.id === outputId).reduce((total, input) => total + input.amount_per_minute, 0)
        const externalInputs = recipe.inputs.filter((input) => input.id !== outputId)
        const plan = buildPlan(outputId, netRate, {
          externalItemIds: new Set(externalInputs.map((input) => input.id)),
          recipeIdByItemId: { [outputId]: recipe.id },
        })

        expect(plan.issues, recipe.id).toEqual([])
        expect(plan.steps, recipe.id).toEqual([
          expect.objectContaining({ itemId: outputId, recipeId: recipe.id, buildingId: building.id, recipeOutputIpm: netRate }),
        ])
        expect(plan.rawInputs, recipe.id).toEqual(
          externalInputs.map((input) => ({ itemId: input.id, amountPerMinute: input.amount_per_minute })),
        )
      }
    }
  })

  it('keeps the real cobalt plate alternatives explicit and preserves their different rates', () => {
    const normal = buildPlan('T_CobaltPlates', 15, {
      supplyCountByItem: { T_CobaltOre: 15 },
    })
    const enriched = buildPlan('T_CobaltPlates', 15, {
      supplyCountByItem: { T_EnrichedCobalt: 5 },
      recipeIdByItemId: { T_CobaltPlates: 'enriched_cobalt_plates' },
    })

    expect(normal.issues).toEqual([])
    expect(normal.steps).toEqual([
      expect.objectContaining({
        itemId: 'T_CobaltPlates',
        recipeId: 'cobalt_plates',
        targetIpm: 15,
        buildingLoad: 0.75,
      }),
    ])

    expect(enriched.issues).toEqual([])
    expect(enriched.steps).toEqual([
      expect.objectContaining({
        itemId: 'T_CobaltPlates',
        recipeId: 'enriched_cobalt_plates',
        targetIpm: 15,
        buildingLoad: 0.5,
      }),
    ])
  })

  it('keeps the real growth-chamber biomass byproduct attached to its producer', () => {
    const plan = buildPlan('T_AlphaProtein', 15, {
      supplyCountByItem: {
        T_Xenoeukarya: 15,
        T_Enzyme: 15,
        T_Nutrients: 30,
      },
      recipeIdByItemId: { T_AlphaProtein: 'alpha_protein' },
    })

    expect(plan.issues).toEqual([])
    expect(plan.steps).toEqual([
      expect.objectContaining({
        itemId: 'T_AlphaProtein',
        recipeId: 'alpha_protein',
        targetIpm: 15,
        extraOutputs: [{ id: 'T_LeavesIcon', amount_per_minute: 15 }],
      }),
    ])
    expect(plan.steps.some((step) => step.itemId === 'T_LeavesIcon')).toBe(false)
  })

  it('keeps research science metadata separate from production recipes', () => {
    expect(researchItemById.get('T_Servomotor')?.points_per_item).toBe(3)
    expect(researchTechnologyById.get('RSC_Servomotors')).toEqual(
      expect.objectContaining({
        costs: [{ type: 'material_science', points: 15 }],
        unlocks: expect.arrayContaining([expect.objectContaining({ type: 'recipe', id: 'servomotor' })]),
      }),
    )
    expect(items.some((item) => item.id === 'material_science_points')).toBe(false)
    expect(buildings.some((building) => building.id === 'material_science_lab')).toBe(false)
  })

  it('keeps the Supercomputer route when scanned survey data has no machine recipe', () => {
    const plan = buildPlan('T_EncodedSimulationMatrix', 2, {
      externalItemIds: new Set(['T_StellarSurveyData', 'T_RelicCore']),
    })

    expect(plan.issues).toEqual([])
    expect(plan.steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemId: 'T_EncodedSimulationMatrix',
          buildingId: 'supercomputer',
          recipeId: 'encoded_simulation_matrix',
        }),
      ]),
    )
    expect(plan.rawInputs).toContainEqual({ itemId: 'T_StellarSurveyData', amountPerMinute: 2 })
    expect(planToFlow({ plan, items }).nodes).toContainEqual(
      expect.objectContaining({
        id: 'T_StellarSurveyData',
        type: 'rawResourceNode',
        data: expect.objectContaining({ isRawMaterial: false, demandIpm: 2 }),
      }),
    )
  })

  it('treats a salvaged Relic Core as an external target, without creating a machine', () => {
    const plan = buildPlan('T_RelicCore', 1, { externalItemIds: new Set(['T_RelicCore']) })
    expect(plan.issues).toEqual([])
    expect(plan.steps).toEqual([])
    expect(plan.rawInputs).toEqual([{ itemId: 'T_RelicCore', amountPerMinute: 1 }])
  })

  it('keeps Biomass as a real coproduct, not a fictitious standalone recipe', () => {
    const growthChamber = buildings.find((building) => building.id === 'growth_chamber')
    expect(growthChamber?.recipes.some((recipe) => recipe.extra_outputs?.some((output) => output.id === 'T_LeavesIcon'))).toBe(true)
    expect(producerBuildingsByItemId.has('T_LeavesIcon')).toBe(false)
  })

  it('shows the Xenoeukarya route with Biomass as an external leaf, never a fictitious recipe', () => {
    const unresolved = buildPlan('T_Xenoeukarya', 30)
    const supplied = buildPlan('T_Xenoeukarya', 30, { supplyCountByItem: { T_LeavesIcon: 30 } })

    expect(unresolved.issues).toEqual([])
    expect(unresolved.rawInputs).toContainEqual({ itemId: 'T_LeavesIcon', amountPerMinute: 30 })
    expect(unresolved.steps).toContainEqual(
      expect.objectContaining({ itemId: 'T_Xenoeukarya', recipeId: 'xeno_eukarya_recycling', recipeOutputIpm: 30 }),
    )
    expect(planToFlow({ plan: unresolved, items }).nodes).toContainEqual(
      expect.objectContaining({
        id: 'T_LeavesIcon',
        type: 'rawResourceNode',
        data: expect.objectContaining({ isRawMaterial: false, demandIpm: 30 }),
      }),
    )
    expect(supplied.issues).toEqual([])
    expect(supplied.steps).toContainEqual(
      expect.objectContaining({ itemId: 'T_Xenoeukarya', recipeId: 'xeno_eukarya_recycling', recipeOutputIpm: 30 }),
    )
  })

  it('treats raw ore as external demand without creating a supply machine', () => {
    const plan = buildPlan('T_CobaltPlates', 20)

    expect(plan.issues).toEqual([])
    expect(plan.rawInputs).toEqual([{ itemId: 'T_CobaltOre', amountPerMinute: 20 }])
    expect(plan.steps).toEqual([expect.objectContaining({ itemId: 'T_CobaltPlates', buildingId: 'refinery' })])
    expect(buildings.some((building) => building.id.endsWith('_supply'))).toBe(false)

    const flow = planToFlow({ plan, items })
    expect(flow.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'T_CobaltOre',
          type: 'rawResourceNode',
          data: expect.objectContaining({ demandIpm: 20 }),
        }),
      ]),
    )
  })

  it('does not count real ore-synthesis recipes as machines in an ordinary Servomotor plan', () => {
    const plan = buildPlan('T_Servomotor', 15)

    expect(plan.issues).toEqual([])
    expect(plan.rawInputs).toHaveLength(2)
    expect(plan.rawInputs).toEqual(
      expect.arrayContaining([
        { itemId: 'T_NickelOre', amountPerMinute: 30 },
        { itemId: 'T_TitaniumOre', amountPerMinute: 60 },
      ]),
    )
    expect(plan.steps.some((step) => step.buildingId === 'enrichment')).toBe(false)
    expect(plan.stats).toEqual({ buildings: 9, power: 46.5 })

    const flow = planToFlow({ plan, items })
    expect(new Set(flow.nodes.map((node) => node.id)).size).toBe(flow.nodes.length)
    expect(
      flow.nodes
        .filter((node) => node.type === 'rawResourceNode')
        .map((node) => node.id)
        .sort(),
    ).toEqual(['T_NickelOre', 'T_TitaniumOre'])
  })

  it('connects every Chromatic Alloy recipe input through its real producer or raw-resource leaf', () => {
    const plan = buildPlan('T_ChromaticAlloy', 10)

    expect(plan.issues).toEqual([])
    const flow = planToFlow({ plan, items })
    const connectedPairs = new Set(flow.edges.map((edge) => `${edge.source}->${edge.target}`))
    expect(connectedPairs).toEqual(
      new Set([
        'T_IridiumPlates2->T_ChromaticAlloy',
        'T_Superalloy->T_ChromaticAlloy',
        'T_IridiumOre->T_IridiumPlates2',
        'T_TitaniumOre->T_IridiumPlates2',
        'T_EnrichedTitanium->T_Superalloy',
        'T_EnrichedNickel->T_Superalloy',
        'T_EnrichedCobalt->T_Superalloy',
        'T_TitaniumOre->T_EnrichedTitanium',
        'T_NickelOre->T_EnrichedNickel',
        'T_CobaltOre->T_EnrichedCobalt',
      ]),
    )
    const tree = buildTree(new Map(plan.steps.map((step) => [step.itemId, step])), plan.targetId, true, plan.targetIpm)
    const leaves = (node: typeof tree): string[] => (node?.children?.length ? node.children.flatMap(leaves) : node ? [node.itemId] : [])
    expect(leaves(tree).sort()).toEqual(['T_CobaltOre', 'T_IridiumOre', 'T_NickelOre', 'T_TitaniumOre', 'T_TitaniumOre'])
  })
})
