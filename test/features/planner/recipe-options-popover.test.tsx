// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { HeroUIProvider } from '@heroui/react'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProductionPlanProvider } from '@/features/planner/providers/production-plan-provider'
import { RecipeOptionsPopover } from '@/features/planner/ui/toolbar/recipe-options-popover'
import { buildProductionPlan } from '@/features/planner/lib/production-plan'
import { buildings, externallyAcquiredItemIds, itemById, items, producerBuildingsByItemId } from '@/shared/data'
import { usePlannerStore } from '@/store/planner.store'

beforeEach(() => {
  sessionStorage.clear()
  usePlannerStore.setState({ targetId: '', targetIpm: 0, recipeIdByItemId: {}, supplyCountByItem: {} })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => window.setTimeout(() => callback(performance.now()), 0))
  vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

/** Exercises the real popover/radios, derived provider and persistent store rather than mocking the route-selection contract. */
const openOptions = async () => {
  render(
    <HeroUIProvider disableAnimation>
      <ProductionPlanProvider>
        <RecipeOptionsPopover />
      </ProductionPlanProvider>
    </HeroUIProvider>,
  )
  fireEvent.click(screen.getByRole('button', { name: /^Recipes:/ }))
  await screen.findByText('Recipe selection')
}

/** Calculates the resulting domain plan independently of the component's display. */
const selectedPlan = () => {
  const state = usePlannerStore.getState()
  return buildProductionPlan({
    buildings,
    producerBuildingsByItemId,
    targetId: state.targetId,
    targetIpm: state.targetIpm,
    isRawTarget: itemById.get(state.targetId)?.type === 'raw',
    rawItemIds: new Set(items.filter((item) => item.type === 'raw').map((item) => item.id)),
    externalItemIds: externallyAcquiredItemIds,
    supplyCountByItem: state.supplyCountByItem,
    recipeIdByItemId: state.recipeIdByItemId,
  })
}

/** Native radios use their visible card content as their name; the group identifies the product. */
const radioFor = (itemName: string, route: RegExp) =>
  within(screen.getByRole('radiogroup', { name: 'Recipe for ' + itemName })).getByRole('radio', { name: route })
describe('Explicit raw synthesis controls (F16)', () => {
  it('switches a raw target between external input and synthesis without changing its rate', async () => {
    const itemId = 'T_NickelOre'
    const name = 'Nickel Ore'
    const recipeId = 'nickel_synthesis'
    usePlannerStore.setState({ targetId: itemId, targetIpm: 20 })
    await openOptions()
    const external = radioFor(name, /External input/)
    expect(external).toBeChecked()
    expect(usePlannerStore.getState().recipeIdByItemId).toEqual({})
    fireEvent.click(radioFor(name, /Enrichment Chamber/))
    await waitFor(() => expect(usePlannerStore.getState().recipeIdByItemId[itemId]).toBe(recipeId))
    expect(selectedPlan().issues).toEqual([])
    expect(selectedPlan().steps).toContainEqual(expect.objectContaining({ itemId, recipeId, buildingId: 'enrichment', targetIpm: 20 }))
    expect(usePlannerStore.getState().targetIpm).toBe(20)
    fireEvent.click(radioFor(name, /External input/))
    await waitFor(() => expect(usePlannerStore.getState().recipeIdByItemId).toEqual({}))
    expect(selectedPlan()).toMatchObject({ steps: [], rawInputs: [{ itemId, amountPerMinute: 20 }] })
  })

  it('changes only the raw ingredient route while preserving plate selection, supply and unrelated recipes', async () => {
    const actions = usePlannerStore.getState()
    actions.selectTargetItem('T_NickelPlates1', 'nickel_plates')
    actions.setRecipeForItem('T_TitaniumPlates1', 'enriched_titanium_plates')
    actions.setSupply('T_NickelOre', 5)
    await openOptions()
    fireEvent.click(radioFor('Nickel Ore', /Enrichment Chamber/))
    await waitFor(() => expect(usePlannerStore.getState().recipeIdByItemId.T_NickelOre).toBe('nickel_synthesis'))
    expect(usePlannerStore.getState()).toMatchObject({
      targetId: 'T_NickelPlates1',
      targetIpm: 20,
      supplyCountByItem: { T_NickelOre: 5 },
      recipeIdByItemId: {
        T_NickelPlates1: 'nickel_plates',
        T_NickelOre: 'nickel_synthesis',
        T_TitaniumPlates1: 'enriched_titanium_plates',
      },
    })
    expect(selectedPlan().steps).toContainEqual(expect.objectContaining({ itemId: 'T_NickelOre', targetIpm: 15 }))
    fireEvent.click(radioFor('Nickel Ore', /External input/))
    await waitFor(() => expect(usePlannerStore.getState().recipeIdByItemId).not.toHaveProperty('T_NickelOre'))
    expect(selectedPlan().rawInputs).toContainEqual({ itemId: 'T_NickelOre', amountPerMinute: 15 })
    expect(usePlannerStore.getState().recipeIdByItemId.T_TitaniumPlates1).toBe('enriched_titanium_plates')
  })

  it('allows restoring external input when supply leaves no raw production step', async () => {
    usePlannerStore.setState({
      targetId: 'T_NickelOre',
      targetIpm: 20,
      recipeIdByItemId: { T_NickelOre: 'nickel_synthesis' },
      supplyCountByItem: { T_NickelOre: 20 },
    })
    await openOptions()
    expect(radioFor('Nickel Ore', /Enrichment Chamber/)).toBeChecked()
    expect(selectedPlan().steps).toEqual([])
    fireEvent.click(radioFor('Nickel Ore', /External input/))
    await waitFor(() => expect(usePlannerStore.getState().recipeIdByItemId).toEqual({}))
    expect(usePlannerStore.getState().supplyCountByItem).toEqual({ T_NickelOre: 20 })
    expect(selectedPlan()).toMatchObject({ steps: [], rawInputs: [] })
  })

  it('shows a restored recipe for another output as external without deleting it on mount', async () => {
    const recipeId = 'titanium_synthesis'
    usePlannerStore.setState({ targetId: 'T_NickelOre', targetIpm: 20, recipeIdByItemId: { T_NickelOre: recipeId } })
    await openOptions()
    expect(radioFor('Nickel Ore', /External input/)).toBeChecked()
    expect(usePlannerStore.getState().recipeIdByItemId).toEqual({ T_NickelOre: recipeId })
    expect(selectedPlan()).toMatchObject({ steps: [], rawInputs: [{ itemId: 'T_NickelOre', amountPerMinute: 20 }] })
  })

  it('keeps the selector disabled for Cobalt Ore, which has no catalog synthesis', () => {
    usePlannerStore.setState({ targetId: 'T_CobaltOre', targetIpm: 20 })
    render(
      <HeroUIProvider disableAnimation>
        <ProductionPlanProvider>
          <RecipeOptionsPopover />
        </ProductionPlanProvider>
      </HeroUIProvider>,
    )
    expect(screen.getByRole('button', { name: /^Recipes:/ })).toBeDisabled()
    expect(screen.queryByRole('radio')).not.toBeInTheDocument()
  })
})
