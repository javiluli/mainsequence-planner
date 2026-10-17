// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { HeroUIProvider } from '@heroui/react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RecipeOutput } from '@/features/recipes/ui/recipe-output'
import type { Recipe } from '@/shared/@types/building.type'
import { buildings, itemById } from '@/shared/data'
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

/** Exercises the catalog shortcut with the real HeroUI button, router and Planner store. */
const renderOutput = (recipe: Recipe) =>
  render(
    <MemoryRouter initialEntries={['/recipes']}>
      <HeroUIProvider disableAnimation>
        <Routes>
          <Route path="/recipes" element={<RecipeOutput recipe={recipe} outputItem={itemById.get(recipe.output.id)} />} />
          <Route path="/" element={<h1>Planner route</h1>} />
        </Routes>
      </HeroUIProvider>
    </MemoryRouter>,
  )

/** Reads fixtures from the catalog so the shortcut tests protect stable recipe IDs and source rates. */
const catalogRecipe = (id: string) => {
  const recipe = buildings.flatMap((building) => building.recipes).find((entry) => entry.id === id)
  if (!recipe) throw new Error('Missing catalog recipe: ' + id)
  return recipe
}

describe('Recipes to Planner intent (F15/F16)', () => {
  it.each([
    ['nickel_plates', 20],
    ['enriched_nickel_plates', 30],
    ['xeno_eukarya_recycling', 30],
    ['nickel_synthesis', 60],
  ])('opens the concrete %s card at %s/min without discarding other saved inputs', async (recipeId, netRate) => {
    usePlannerStore.getState().setRecipeForItem('T_TitaniumPlates1', 'enriched_titanium_plates')
    usePlannerStore.getState().setSupply('T_CobaltOre', 3)
    const recipe = catalogRecipe(recipeId)
    renderOutput(recipe)
    expect(screen.getByText(recipe.output.amount_per_minute + '/min')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Plan this recipe' }))
    await screen.findByRole('heading', { name: 'Planner route' })
    expect(usePlannerStore.getState()).toMatchObject({
      targetId: recipe.output.id,
      targetIpm: netRate,
      supplyCountByItem: { T_CobaltOre: 3 },
      recipeIdByItemId: { [recipe.output.id]: recipeId, T_TitaniumPlates1: 'enriched_titanium_plates' },
    })
  })

  it('does not offer an exact recipe shortcut for an unidentified fixture', () => {
    const recipe = catalogRecipe('nickel_synthesis')
    renderOutput({ ...recipe, id: undefined })
    expect(screen.queryByRole('button', { name: 'Plan this recipe' })).not.toBeInTheDocument()
  })

  it('stays on Recipes with the current plan intact if an explicit recipe no longer exists', async () => {
    usePlannerStore.getState().selectTargetItem('T_TitaniumPlates1', 'titanium_plates')
    const before = usePlannerStore.getState()
    const recipe = catalogRecipe('nickel_plates')
    renderOutput({ ...recipe, id: 'removed_recipe' })
    fireEvent.click(screen.getByRole('button', { name: 'Plan this recipe' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Plan this recipe' })).toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: 'Planner route' })).not.toBeInTheDocument()
    expect(usePlannerStore.getState()).toBe(before)
  })
})
