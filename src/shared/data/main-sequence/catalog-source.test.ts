import { describe, expect, it } from 'vitest'
import buildings from './buildings_and_recipes.json'
import items from './items.json'
import research from './research.json'

describe('compact Main Sequence planner catalog', () => {
  it('keeps items intentionally minimal and compatible with the existing icon IDs', () => {
    expect(items).toHaveLength(70)

    for (const item of items) expect(Object.keys(item).sort()).toEqual(['id', 'name', 'type'])

    expect(items.find((item) => item.name === 'Nickel Ore')).toEqual({ id: 'T_NickelOre', name: 'Nickel Ore', type: 'raw' })
    expect(items.find((item) => item.name === 'Nickel Plates')).toEqual({
      id: 'T_NickelPlates1',
      name: 'Nickel Plates',
      type: 'processed',
    })
  })

  it('contains only the eight source crafters, their verified power and their 63 source recipes', () => {
    expect(buildings).toHaveLength(8)
    expect(buildings.reduce((total, building) => total + building.recipes.length, 0)).toBe(63)

    for (const building of buildings) {
      expect(building.type).toBe('production')
      expect(building.name).not.toHaveLength(0)
      expect(building.recipes.length).toBeGreaterThan(0)
    }

    expect(buildings.find((building) => building.id === 'refinery')).toMatchObject({ name: 'Refinery', power: 4.5 })
    expect(buildings.find((building) => building.id === 'fabricator')).toMatchObject({ name: 'Assembler', power: 6 })
    expect(buildings.find((building) => building.id === 'armoury')).not.toHaveProperty('power')
  })

  it('resolves every recipe item and preserves verified per-minute ratios', () => {
    const itemIds = new Set(items.map((item) => item.id))

    for (const building of buildings) {
      for (const recipe of building.recipes) {
        const extraOutputs = 'extra_outputs' in recipe ? (recipe.extra_outputs ?? []) : []

        for (const amount of [recipe.output, ...recipe.inputs, ...extraOutputs]) {
          expect(itemIds.has(amount.id), `${recipe.id} -> ${amount.id}`).toBe(true)
          expect(amount.amount_per_minute).toBeGreaterThan(0)
        }
      }
    }

    const refinery = buildings.find((building) => building.id === 'refinery')
    const nickelPlates = refinery?.recipes.find((recipe) => recipe.id === 'nickel_plates')
    expect(nickelPlates?.output).toEqual({ id: 'T_NickelPlates1', amount_per_minute: 20 })
    expect(nickelPlates?.inputs).toEqual([{ id: 'T_NickelOre', amount_per_minute: 20 }])
  })

  it('accounts for every Códice item as a recipe product, coproduct or externally obtained item', () => {
    const producedIds = new Set(
      buildings.flatMap((building) =>
        building.recipes.flatMap((recipe) => [
          recipe.output.id,
          ...('extra_outputs' in recipe ? (recipe.extra_outputs ?? []) : []).map((output) => output.id),
        ]),
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

  it('groups research by science branch with item values, costs and rewards', () => {
    const branches = Object.values(research)
    const itemIds = new Set(items.map((item) => item.id))
    const uniqueTechnologyIds = new Set(branches.flatMap((branch) => branch.technologies.map((technology) => technology.id)))

    expect(branches).toHaveLength(8)
    expect(uniqueTechnologyIds.size).toBe(97)

    for (const branch of branches) {
      for (const component of branch.components) {
        expect(itemIds.has(component.id), `${branch.id} -> ${component.id}`).toBe(true)
        expect(component.points).toBeGreaterThan(0)
      }

      for (const technology of branch.technologies) {
        const primary = 'primary_prerequisite' in technology ? technology.primary_prerequisite : undefined
        const additional = 'prerequisites' in technology ? technology.prerequisites : undefined
        const requirements = [primary, ...(additional ?? [])].filter((requirement): requirement is string => Boolean(requirement))

        for (const requirement of requirements) {
          expect(uniqueTechnologyIds.has(requirement), `${technology.id} -> ${requirement}`).toBe(true)
        }
      }
    }

    expect(research['Material Science'].components).toEqual([
      { id: 'T_HullPlate', points: 1 },
      { id: 'T_Servomotor', points: 3 },
    ])
    expect(research['Material Science'].technologies.find((technology) => technology.id === 'RSC_Servomotors')?.xp).toBe(15)
    expect(branches.flatMap((branch) => branch.technologies).filter((technology) => 'start_unlocked' in technology).length).toBe(7)
  })
})
